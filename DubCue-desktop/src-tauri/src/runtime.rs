use flate2::read::GzDecoder;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    net::TcpListener,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

const PRODUCT: &str = "DubCue";
const RUNTIME_VERSION: &str = "1";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeSnapshot {
    pub status: String,
    pub version: Option<String>,
    pub message: String,
    pub progress: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub backend_url: Option<String>,
    pub session_token: Option<String>,
    pub model_installed: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInstallSnapshot {
    pub provider_id: String,
    pub status: String,
    pub stage: String,
    pub message: String,
    pub human_message: String,
    pub progress: f64,
    pub install_dir: Option<String>,
    pub error_code: Option<String>,
}

impl Default for ProviderInstallSnapshot {
    fn default() -> Self {
        Self {
            provider_id: String::new(),
            status: "idle".into(),
            stage: String::new(),
            message: String::new(),
            human_message: String::new(),
            progress: 0.0,
            install_dir: None,
            error_code: None,
        }
    }
}

impl Default for RuntimeSnapshot {
    fn default() -> Self {
        Self { status: "notInstalled".into(), version: None, message: String::new(), progress: 0.0, downloaded_bytes: 0, total_bytes: 0, backend_url: None, session_token: None, model_installed: false }
    }
}

#[derive(Default)]
pub struct DesktopState {
    snapshot: Mutex<RuntimeSnapshot>,
    provider_snapshot: Mutex<ProviderInstallSnapshot>,
    paused: AtomicBool,
    child: Mutex<Option<Child>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallManifest {
    version: String,
    required_free_bytes: u64,
    artifacts: Vec<Artifact>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Artifact {
    name: String,
    url: String,
    sha256: String,
    size: u64,
    kind: String,
    destination: String,
}

fn roots(app: &AppHandle) -> Result<(PathBuf, PathBuf, PathBuf, PathBuf), String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok((root.join("runtime"), root.join("models"), root.join("cache"), root.join("logs")))
}

fn provider_roots(app: &AppHandle, provider_id: &str) -> Result<(PathBuf, PathBuf), String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?.join("providers").join(provider_id);
    let logs = roots(app)?.3;
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    fs::create_dir_all(&logs).map_err(|e| e.to_string())?;
    Ok((root, logs))
}

fn provider_marker(app: &AppHandle, provider_id: &str) -> Result<PathBuf, String> {
    Ok(provider_roots(app, provider_id)?.0.join("provider.json"))
}

fn log_provider_line(log_path: &Path, line: &str) {
    if let Ok(mut log) = OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(log, "{line}");
    }
}

fn provider_error_human(message: &str) -> (String, String) {
    let value = message.to_ascii_lowercase();
    if value.contains("license") || value.contains("confirm") {
        return ("licenseRequired".into(), "需要先确认模型授权与音色克隆使用风险，然后才能自动安装。".into());
    }
    if value.contains("no space") || value.contains("space") || value.contains("disk") {
        return ("diskSpace".into(), "磁盘空间不足。请清理空间，建议为 Spark-TTS 预留 16GB 以上可用空间。".into());
    }
    if value.contains("gh") && (value.contains("not found") || value.contains("no such file")) {
        return ("githubCliMissing".into(), "没有找到 GitHub CLI。请先安装 GitHub CLI，或在手动接入中选择你已经 clone 好的官方仓库目录。".into());
    }
    if value.contains("git") && (value.contains("not found") || value.contains("no such file")) {
        return ("gitMissing".into(), "没有找到 Git。GitHub CLI clone 仓库时仍需要 Git，请先安装 Git 后重试。".into());
    }
    if value.contains("python") || value.contains("venv") || value.contains("pip") {
        return ("pythonFailed".into(), "Python 环境创建或依赖安装失败。建议安装 Python 3.12 后重试，或查看故障排查日志。".into());
    }
    if value.contains("network") || value.contains("dns") || value.contains("timed out") || value.contains("connection") || value.contains("resolve") {
        return ("network".into(), "网络连接失败。请检查网络、代理或稍后重试；模型下载也可以后续改为手动接入。".into());
    }
    if value.contains("memory") || value.contains("killed") || value.contains("mps") || value.contains("cuda") {
        return ("resource".into(), "本机内存或加速环境不足。请关闭其他程序，或先使用 VoxCPM2 / 手动轻量配置。".into());
    }
    if value.contains("missing") || value.contains("not found") || value.contains("incomplete") {
        return ("missingFiles".into(), "安装文件不完整。可以重试自动安装，或在手动接入中选择已有模型目录。".into());
    }
    ("unknown".into(), "安装失败。请打开故障排查日志查看最后一步的详细输出。".into())
}

fn publish_provider_install(app: &AppHandle, state: &DesktopState, snapshot: ProviderInstallSnapshot) -> ProviderInstallSnapshot {
    *state.provider_snapshot.lock().expect("provider install state poisoned") = snapshot.clone();
    let _ = app.emit("provider-install-progress", snapshot.clone());
    snapshot
}

fn provider_snapshot(provider_id: &str, status: &str, stage: &str, message: &str, human_message: &str, progress: f64, install_dir: Option<&Path>) -> ProviderInstallSnapshot {
    ProviderInstallSnapshot {
        provider_id: provider_id.into(),
        status: status.into(),
        stage: stage.into(),
        message: message.into(),
        human_message: human_message.into(),
        progress,
        install_dir: install_dir.map(|path| path.to_string_lossy().into_owned()),
        error_code: None,
    }
}

fn run_logged(mut command: Command, label: &str, log_path: &Path) -> Result<(), String> {
    let command_line = format!(
        "{} {}",
        command.get_program().to_string_lossy(),
        command.get_args().map(|arg| arg.to_string_lossy()).collect::<Vec<_>>().join(" ")
    );
    log_provider_line(log_path, &format!("\n== {label} ==\n$ {command_line}"));
    let output = command.output().map_err(|e| format!("{label}: {e}"))?;
    log_provider_line(log_path, &String::from_utf8_lossy(&output.stdout));
    log_provider_line(log_path, &String::from_utf8_lossy(&output.stderr));
    if output.status.success() {
        Ok(())
    } else {
        Err(format!("{label} failed with {}", output.status))
    }
}

fn marker(app: &AppHandle) -> Result<PathBuf, String> { Ok(roots(app)?.0.join("current/install.json")) }

fn home_dir() -> Option<PathBuf> { std::env::var_os("HOME").map(PathBuf::from) }

fn external_voxcpm_dir() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(value) = std::env::var_os("DUBCUE_VOXCPM_DIR") { candidates.push(PathBuf::from(value)); }
    candidates.push(Path::new(env!("CARGO_MANIFEST_DIR")).join("../../VoxCPM-main"));
    if let Some(home) = home_dir() {
        candidates.push(home.join("Documents/DubCue/dubcue-app/VoxCPM-main"));
        candidates.push(home.join("Documents/DubCue/VoxCPM-main"));
    }
    candidates.into_iter().find(|path| path.join(".venv/bin/python").exists() && path.join("src/voxcpm").exists())
}

fn find_local_model(app: &AppHandle) -> Option<PathBuf> {
    if let Ok((_, models, _, _)) = roots(app) {
        let installed = models.join("VoxCPM2");
        if installed.join("model.safetensors").exists() { return Some(installed); }
    }
    if let Some(value) = std::env::var_os("DUBCUE_MODEL_ID") {
        let path = PathBuf::from(value);
        if path.join("model.safetensors").exists() { return Some(path); }
    }
    let home = home_dir()?;
    let snapshots = home.join(".cache/huggingface/hub/models--openbmb--VoxCPM2/snapshots");
    if let Ok(entries) = fs::read_dir(snapshots) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.join("model.safetensors").exists() && path.join("audiovae.pth").exists() && path.join("config.json").exists() { return Some(path); }
        }
    }
    let modelscope = home.join(".cache/modelscope/hub/models/OpenBMB/VoxCPM2");
    if modelscope.join("model.safetensors").exists() { return Some(modelscope); }
    None
}

fn bundled_server(app: &AppHandle) -> Option<PathBuf> {
    let resources = app.path().resource_dir().ok()?;
    [resources.join("backend/server.py"), resources.join("_up_/backend/server.py")].into_iter().find(|path| path.exists())
}

fn installed_snapshot(app: &AppHandle) -> RuntimeSnapshot {
    let mut result = RuntimeSnapshot::default();
    if let Ok(path) = marker(app) {
        if let Ok(value) = fs::read_to_string(path) {
            let version = serde_json::from_str::<serde_json::Value>(&value).ok().and_then(|v| v.get("version")?.as_str().map(str::to_owned));
            result.status = if version.as_deref() == Some(RUNTIME_VERSION) { "ready" } else { "updateRequired" }.into();
            result.version = version;
        }
    }
    result.model_installed = find_local_model(app).is_some();
    if external_voxcpm_dir().is_some() {
        result.status = "ready".into();
        result.version = Some("existing-local".into());
        result.message = if result.model_installed { "Detected existing VoxCPM2".into() } else { "Detected local VoxCPM runtime".into() };
    }
    result
}

fn publish(app: &AppHandle, state: &DesktopState, snapshot: RuntimeSnapshot) -> RuntimeSnapshot {
    *state.snapshot.lock().expect("runtime state poisoned") = snapshot.clone();
    let _ = app.emit("runtime-progress", snapshot.clone());
    snapshot
}

#[tauri::command]
pub fn runtime_status(app: AppHandle, state: State<'_, Arc<DesktopState>>) -> RuntimeSnapshot {
    let current = state.snapshot.lock().expect("runtime state poisoned").clone();
    if current.status == "running" || matches!(current.status.as_str(), "downloading" | "verifying" | "starting") { current } else { installed_snapshot(&app) }
}

#[tauri::command]
pub fn provider_install_status(state: State<'_, Arc<DesktopState>>) -> ProviderInstallSnapshot {
    state.provider_snapshot.lock().expect("provider install state poisoned").clone()
}

fn installed_provider_snapshot(app: &AppHandle, provider_id: &str) -> Option<ProviderInstallSnapshot> {
    let marker = provider_marker(app, provider_id).ok()?;
    if !marker.exists() { return None; }
    let install_dir = marker.parent().map(|path| path.to_string_lossy().into_owned());
    Some(ProviderInstallSnapshot {
        provider_id: provider_id.into(),
        status: "ready".into(),
        stage: "ready".into(),
        message: "Provider is installed".into(),
        human_message: "模型已经安装完成，可以在后续版本中连接为当前生成后端。".into(),
        progress: 1.0,
        install_dir,
        error_code: None,
    })
}

#[tauri::command]
pub async fn install_model_provider(app: AppHandle, state: State<'_, Arc<DesktopState>>, provider_id: String, license_confirmed: bool) -> Result<ProviderInstallSnapshot, String> {
    match provider_id.as_str() {
        "spark-tts" => install_spark_tts(app, state, license_confirmed).await,
        "voxcpm2" => Ok(provider_snapshot(
            "voxcpm2",
            "ready",
            "connected",
            "VoxCPM2 uses the existing DubCue runtime detector.",
            "VoxCPM2 已由现有运行时检测与连接流程管理。",
            1.0,
            None,
        )),
        _ => Err("managed installation for this provider is not available yet".into()),
    }
}

async fn install_spark_tts(app: AppHandle, state: State<'_, Arc<DesktopState>>, license_confirmed: bool) -> Result<ProviderInstallSnapshot, String> {
    const PROVIDER_ID: &str = "spark-tts";
    const REQUIRED_FREE_BYTES: u64 = 16 * 1024 * 1024 * 1024;
    if !license_confirmed {
        let (code, human_message) = provider_error_human("license not confirmed");
        let mut snapshot = provider_snapshot(PROVIDER_ID, "error", "license", "license confirmation is required", &human_message, 0.0, None);
        snapshot.error_code = Some(code);
        publish_provider_install(&app, &state, snapshot.clone());
        return Err(human_message);
    }
    if let Some(snapshot) = installed_provider_snapshot(&app, PROVIDER_ID) {
        publish_provider_install(&app, &state, snapshot.clone());
        return Ok(snapshot);
    }

    let (root, logs) = provider_roots(&app, PROVIDER_ID)?;
    let log_path = logs.join("provider-install.log");
    let repo_dir = root.join("Spark-TTS");
    let venv_dir = root.join(".venv");
    let model_dir = root.join("models").join("Spark-TTS-0.5B");
    log_provider_line(&log_path, "\n\n# Spark-TTS managed install");

    publish_provider_install(&app, &state, provider_snapshot(
        PROVIDER_ID,
        "checking",
        "environment",
        "Checking disk, GitHub CLI, Git, and Python.",
        "正在检查磁盘空间、GitHub CLI、Git 和 Python 环境。",
        0.05,
        Some(&root),
    ));

    let free = fs2::available_space(&root).map_err(|e| e.to_string())?;
    if free < REQUIRED_FREE_BYTES {
        let raw = format!("insufficient disk space: need {REQUIRED_FREE_BYTES} bytes");
        let (code, human_message) = provider_error_human(&raw);
        let mut snapshot = provider_snapshot(PROVIDER_ID, "error", "environment", &raw, &human_message, 0.05, Some(&root));
        snapshot.error_code = Some(code);
        publish_provider_install(&app, &state, snapshot.clone());
        return Err(human_message);
    }

    let mut git_check = Command::new("git");
    git_check.arg("--version");
    if let Err(error) = run_logged(git_check, "check git", &log_path) {
        let (code, human_message) = provider_error_human(&error);
        let mut snapshot = provider_snapshot(PROVIDER_ID, "error", "environment", &error, &human_message, 0.05, Some(&root));
        snapshot.error_code = Some(code);
        publish_provider_install(&app, &state, snapshot.clone());
        return Err(human_message);
    }
    let mut gh_check = Command::new("gh");
    gh_check.arg("--version");
    if let Err(error) = run_logged(gh_check, "check GitHub CLI", &log_path) {
        let (code, human_message) = provider_error_human(&error);
        let mut snapshot = provider_snapshot(PROVIDER_ID, "error", "environment", &error, &human_message, 0.05, Some(&root));
        snapshot.error_code = Some(code);
        publish_provider_install(&app, &state, snapshot.clone());
        return Err(human_message);
    }
    let mut python_check = Command::new("python3");
    python_check.arg("--version");
    if let Err(error) = run_logged(python_check, "check python3", &log_path) {
        let (code, human_message) = provider_error_human(&error);
        let mut snapshot = provider_snapshot(PROVIDER_ID, "error", "environment", &error, &human_message, 0.05, Some(&root));
        snapshot.error_code = Some(code);
        publish_provider_install(&app, &state, snapshot.clone());
        return Err(human_message);
    }

    publish_provider_install(&app, &state, provider_snapshot(
        PROVIDER_ID,
        "downloading",
        "source",
        "Cloning official Spark-TTS GitHub repository with GitHub CLI.",
        "正在通过 GitHub CLI 克隆 Spark-TTS 官方仓库。",
        0.18,
        Some(&root),
    ));
    if !repo_dir.join(".git").exists() {
        let mut command = Command::new("gh");
        command.arg("repo").arg("clone").arg("SparkAudio/Spark-TTS").arg(&repo_dir).arg("--").arg("--depth").arg("1");
        if let Err(error) = run_logged(command, "gh repo clone Spark-TTS", &log_path) {
            let (code, human_message) = provider_error_human(&error);
            let mut snapshot = provider_snapshot(PROVIDER_ID, "error", "source", &error, &human_message, 0.18, Some(&root));
            snapshot.error_code = Some(code);
            publish_provider_install(&app, &state, snapshot.clone());
            return Err(human_message);
        }
    } else {
        log_provider_line(&log_path, "Spark-TTS repository already exists; skipping clone.");
    }

    publish_provider_install(&app, &state, provider_snapshot(
        PROVIDER_ID,
        "installing",
        "python",
        "Creating isolated Python environment.",
        "正在创建独立 Python 环境。",
        0.34,
        Some(&root),
    ));
    if !venv_dir.join("bin").join("python").exists() {
        let mut command = Command::new("python3");
        command.arg("-m").arg("venv").arg(&venv_dir);
        if let Err(error) = run_logged(command, "create venv", &log_path) {
            let (code, human_message) = provider_error_human(&error);
            let mut snapshot = provider_snapshot(PROVIDER_ID, "error", "python", &error, &human_message, 0.34, Some(&root));
            snapshot.error_code = Some(code);
            publish_provider_install(&app, &state, snapshot.clone());
            return Err(human_message);
        }
    } else {
        log_provider_line(&log_path, "Python virtual environment already exists; skipping creation.");
    }

    let python = venv_dir.join("bin").join("python");
    publish_provider_install(&app, &state, provider_snapshot(
        PROVIDER_ID,
        "installing",
        "dependencies",
        "Installing Spark-TTS dependencies.",
        "正在安装 Spark-TTS 依赖。这一步首次运行可能较慢。",
        0.52,
        Some(&root),
    ));
    for (label, args) in [
        ("upgrade pip", vec!["-m", "pip", "install", "-U", "pip", "setuptools", "wheel"]),
        ("install requirements", vec!["-m", "pip", "install", "-r"]),
        ("install huggingface hub", vec!["-m", "pip", "install", "-U", "huggingface_hub"]),
    ] {
        let mut command = Command::new(&python);
        if label == "install requirements" {
            command.args(args).arg(repo_dir.join("requirements.txt"));
        } else {
            command.args(args);
        }
        if let Err(error) = run_logged(command, label, &log_path) {
            let (code, human_message) = provider_error_human(&error);
            let mut snapshot = provider_snapshot(PROVIDER_ID, "error", "dependencies", &error, &human_message, 0.52, Some(&root));
            snapshot.error_code = Some(code);
            publish_provider_install(&app, &state, snapshot.clone());
            return Err(human_message);
        }
    }

    publish_provider_install(&app, &state, provider_snapshot(
        PROVIDER_ID,
        "downloading",
        "model",
        "Downloading Spark-TTS-0.5B weights.",
        "正在下载 Spark-TTS-0.5B 模型权重。",
        0.74,
        Some(&root),
    ));
    fs::create_dir_all(&model_dir).map_err(|e| e.to_string())?;
    let download_code = format!(
        "from huggingface_hub import snapshot_download\nsnapshot_download(repo_id='SparkAudio/Spark-TTS-0.5B', local_dir=r'{}')\n",
        model_dir.to_string_lossy().replace('\\', "\\\\").replace('\'', "\\'")
    );
    let mut download = Command::new(&python);
    download.arg("-c").arg(download_code);
    if let Err(error) = run_logged(download, "download Spark-TTS-0.5B", &log_path) {
        let (code, human_message) = provider_error_human(&error);
        let mut snapshot = provider_snapshot(PROVIDER_ID, "error", "model", &error, &human_message, 0.74, Some(&root));
        snapshot.error_code = Some(code);
        publish_provider_install(&app, &state, snapshot.clone());
        return Err(human_message);
    }

    publish_provider_install(&app, &state, provider_snapshot(
        PROVIDER_ID,
        "testing",
        "smokeTest",
        "Testing installed files.",
        "正在检查安装文件是否完整。",
        0.9,
        Some(&root),
    ));
    let test_code = format!(
        "import pathlib\np = pathlib.Path(r'{}')\nassert p.exists() and any(p.iterdir()), 'model files missing'\nprint('Spark-TTS provider files are present')\n",
        model_dir.to_string_lossy().replace('\\', "\\\\").replace('\'', "\\'")
    );
    let mut test = Command::new(&python);
    test.arg("-c").arg(test_code);
    if let Err(error) = run_logged(test, "test Spark-TTS install", &log_path) {
        let (code, human_message) = provider_error_human(&error);
        let mut snapshot = provider_snapshot(PROVIDER_ID, "error", "smokeTest", &error, &human_message, 0.9, Some(&root));
        snapshot.error_code = Some(code);
        publish_provider_install(&app, &state, snapshot.clone());
        return Err(human_message);
    }

    fs::write(
        root.join("provider.json"),
        serde_json::json!({
            "providerId": PROVIDER_ID,
            "name": "Spark-TTS",
            "source": "https://github.com/SparkAudio/Spark-TTS",
            "modelRepo": "SparkAudio/Spark-TTS-0.5B",
            "installedAt": chrono_like_timestamp(),
            "status": "installed",
            "version": "experimental-0.6"
        }).to_string(),
    ).map_err(|e| e.to_string())?;

    let snapshot = provider_snapshot(
        PROVIDER_ID,
        "ready",
        "ready",
        "Spark-TTS installed.",
        "Spark-TTS 已安装完成。当前版本先完成安装与能力登记，生成后端适配会在下一步接入。",
        1.0,
        Some(&root),
    );
    Ok(publish_provider_install(&app, &state, snapshot))
}

fn chrono_like_timestamp() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".into())
}

async fn download_artifact(app: &AppHandle, state: &DesktopState, artifact: &Artifact, target: &Path, completed: u64, grand_total: u64) -> Result<(), String> {
    if artifact.sha256.len() != 64 || artifact.sha256.chars().all(|c| c == '0') { return Err(format!("{} has no valid SHA-256", artifact.name)); }
    if let Some(parent) = target.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    let existing = target.metadata().map(|m| m.len()).unwrap_or(0);
    let client = reqwest::Client::new();
    let mut request = client.get(&artifact.url);
    if existing > 0 { request = request.header(reqwest::header::RANGE, format!("bytes={existing}-")); }
    let response = request.send().await.map_err(|e| format!("{}: {e}", artifact.name))?;
    if !response.status().is_success() && response.status() != reqwest::StatusCode::PARTIAL_CONTENT { return Err(format!("{} returned {}", artifact.name, response.status())); }
    let append = existing > 0 && response.status() == reqwest::StatusCode::PARTIAL_CONTENT;
    let mut file = OpenOptions::new().create(true).write(true).append(append).truncate(!append).open(target).map_err(|e| e.to_string())?;
    let mut received = if append { existing } else { 0 };
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        while state.paused.load(Ordering::SeqCst) { tokio::time::sleep(Duration::from_millis(180)).await; }
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        received += chunk.len() as u64;
        let done = completed + received;
        publish(app, state, RuntimeSnapshot { status: "downloading".into(), version: None, message: artifact.name.clone(), progress: done as f64 / grand_total.max(1) as f64, downloaded_bytes: done, total_bytes: grand_total, backend_url: None, session_token: None, model_installed: false });
    }
    Ok(())
}

fn verify(path: &Path, expected: &str) -> Result<(), String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut digest = Sha256::new();
    let mut buffer = vec![0; 1024 * 1024];
    loop { let count = file.read(&mut buffer).map_err(|e| e.to_string())?; if count == 0 { break; } digest.update(&buffer[..count]); }
    let actual = format!("{:x}", digest.finalize());
    if actual != expected.to_ascii_lowercase() { Err(format!("checksum mismatch for {}", path.display())) } else { Ok(()) }
}

fn install_artifact(artifact: &Artifact, archive: &Path, runtime_root: &Path, model_root: &Path) -> Result<(), String> {
    let base = if artifact.destination == "model" { model_root } else { runtime_root };
    fs::create_dir_all(base).map_err(|e| e.to_string())?;
    match artifact.kind.as_str() {
        "tar.gz" => tar::Archive::new(GzDecoder::new(File::open(archive).map_err(|e| e.to_string())?)).unpack(base).map_err(|e| e.to_string()),
        "file" => { let destination = base.join(&artifact.name); fs::copy(archive, destination).map(|_| ()).map_err(|e| e.to_string()) }
        other => Err(format!("unsupported artifact type: {other}")),
    }
}

#[tauri::command]
pub async fn install_runtime(app: AppHandle, state: State<'_, Arc<DesktopState>>, manifest_url: Option<String>) -> Result<RuntimeSnapshot, String> {
    state.paused.store(false, Ordering::SeqCst);
    let url = manifest_url
        .or_else(|| std::env::var("DUBCUE_RUNTIME_MANIFEST_URL").ok())
        .ok_or("DubCue runtime distribution is not configured. VoxCPM models must be installed from the official OpenBMB Hugging Face or ModelScope repository.")?;
    publish(&app, &state, RuntimeSnapshot { status: "downloading".into(), message: "manifest".into(), ..Default::default() });
    let manifest: InstallManifest = reqwest::get(url).await.map_err(|e| e.to_string())?.error_for_status().map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;
    let (runtime_root, model_root, cache_root, _) = roots(&app)?;
    fs::create_dir_all(&cache_root).map_err(|e| e.to_string())?;
    let free = fs2::available_space(&cache_root).map_err(|e| e.to_string())?;
    if free < manifest.required_free_bytes { return Err(format!("insufficient disk space: need {} bytes", manifest.required_free_bytes)); }
    let total = manifest.artifacts.iter().map(|a| a.size).sum::<u64>().max(1);
    let mut completed = 0;
    for artifact in &manifest.artifacts {
        let archive = cache_root.join(format!("{}.download", artifact.name));
        download_artifact(&app, &state, artifact, &archive, completed, total).await?;
        publish(&app, &state, RuntimeSnapshot { status: "verifying".into(), version: None, message: artifact.name.clone(), progress: completed as f64 / total as f64, downloaded_bytes: completed, total_bytes: total, backend_url: None, session_token: None, model_installed: false });
        if let Err(error) = verify(&archive, &artifact.sha256) { let _ = fs::remove_file(&archive); return Err(error); }
        install_artifact(artifact, &archive, &runtime_root.join("current"), &model_root.join("VoxCPM2"))?;
        completed += artifact.size;
    }
    fs::create_dir_all(runtime_root.join("current")).map_err(|e| e.to_string())?;
    fs::write(runtime_root.join("current/install.json"), serde_json::json!({"version": manifest.version, "product": PRODUCT}).to_string()).map_err(|e| e.to_string())?;
    let result = installed_snapshot(&app);
    publish(&app, &state, result.clone());
    Ok(result)
}

#[tauri::command]
pub fn pause_install(state: State<'_, Arc<DesktopState>>) { state.paused.store(true, Ordering::SeqCst); }

#[tauri::command]
pub fn resume_install(state: State<'_, Arc<DesktopState>>) { state.paused.store(false, Ordering::SeqCst); }

fn runtime_command(app: &AppHandle) -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let (runtime, _, _, _) = roots(app)?;
    let installed_python = runtime.join("current/bin/python3");
    let installed_server = runtime.join("current/backend/server.py");
    if installed_python.exists() && installed_server.exists() {
        return Ok((installed_python, installed_server, runtime.join("current/VoxCPM-main")));
    }
    if let Some(voxcpm) = external_voxcpm_dir() {
        let source_server = Path::new(env!("CARGO_MANIFEST_DIR")).join("../backend/server.py");
        let server = if source_server.exists() { source_server } else { bundled_server(app).ok_or("bundled backend is missing")? };
        return Ok((voxcpm.join(".venv/bin/python"), server, voxcpm));
    }
    Err("no compatible local VoxCPM runtime was detected".into())
}

#[tauri::command]
pub async fn start_backend(app: AppHandle, state: State<'_, Arc<DesktopState>>) -> Result<RuntimeSnapshot, String> {
    stop_backend_process(&state);
    let current = installed_snapshot(&app);
    if !matches!(current.status.as_str(), "ready" | "updateRequired") { return Err("runtime is not installed".into()); }
    publish(&app, &state, RuntimeSnapshot { status: "starting".into(), message: "Starting VoxCPM".into(), ..current.clone() });
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    drop(listener);
    let token = Uuid::new_v4().to_string();
    let (python, server, voxcpm) = runtime_command(&app)?;
    if !python.exists() || !server.exists() { return Err("installed runtime is incomplete".into()); }
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let log_dir = root.join("logs"); fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;
    let log = OpenOptions::new().create(true).append(true).open(log_dir.join("backend.log")).map_err(|e| e.to_string())?;
    let mut command = Command::new(python);
    command.arg(server).env("DUBCUE_BACKEND_HOST", "127.0.0.1").env("DUBCUE_BACKEND_PORT", port.to_string())
        .env("DUBCUE_SESSION_TOKEN", &token).env("DUBCUE_VOXCPM_DIR", voxcpm).env("DUBCUE_OUTPUT_DIR", root.join("outputs"))
        .stdout(Stdio::from(log.try_clone().map_err(|e| e.to_string())?)).stderr(Stdio::from(log));
    if let Some(model) = find_local_model(&app) { command.env("DUBCUE_MODEL_ID", model); }
    let child = command.spawn().map_err(|e| e.to_string())?;
    *state.child.lock().expect("child state poisoned") = Some(child);
    let url = format!("http://127.0.0.1:{port}");
    let client = reqwest::Client::new();
    for _ in 0..80 {
        if client.get(format!("{url}/health")).bearer_auth(&token).send().await.map(|r| r.status().is_success()).unwrap_or(false) {
            let result = RuntimeSnapshot { status: "running".into(), version: current.version, message: String::new(), progress: 1.0, downloaded_bytes: 0, total_bytes: 0, backend_url: Some(url), session_token: Some(token), model_installed: current.model_installed };
            return Ok(publish(&app, &state, result));
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
    stop_backend_process(&state);
    Err("VoxCPM backend did not become ready; see backend.log".into())
}

pub fn stop_backend_process(state: &DesktopState) {
    if let Some(mut child) = state.child.lock().expect("child state poisoned").take() { let _ = child.kill(); let _ = child.wait(); }
}

#[tauri::command]
pub fn stop_backend(app: AppHandle, state: State<'_, Arc<DesktopState>>) -> RuntimeSnapshot { stop_backend_process(&state); let result = installed_snapshot(&app); publish(&app, &state, result) }

#[tauri::command]
pub fn repair_runtime(app: AppHandle, state: State<'_, Arc<DesktopState>>) -> Result<RuntimeSnapshot, String> {
    stop_backend_process(&state);
    let marker = marker(&app)?; if marker.exists() { fs::remove_file(marker).map_err(|e| e.to_string())?; }
    let result = installed_snapshot(&app); Ok(publish(&app, &state, result))
}

#[tauri::command]
pub fn uninstall_model(app: AppHandle, state: State<'_, Arc<DesktopState>>) -> Result<RuntimeSnapshot, String> {
    stop_backend_process(&state);
    let model = roots(&app)?.1.join("VoxCPM2"); if model.exists() { fs::remove_dir_all(model).map_err(|e| e.to_string())?; }
    let result = installed_snapshot(&app); Ok(publish(&app, &state, result))
}

#[tauri::command]
pub fn open_logs(app: AppHandle) -> Result<String, String> {
    let logs = roots(&app)?.3; fs::create_dir_all(&logs).map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    Command::new("open").arg(&logs).spawn().map_err(|e| e.to_string())?;
    Ok(logs.to_string_lossy().into_owned())
}
