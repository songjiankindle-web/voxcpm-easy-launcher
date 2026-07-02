use serde_json::Value;
use std::{collections::BTreeSet, fs::{self, File}, io::{Read, Write}, path::{Path, PathBuf}};
use tauri::{AppHandle, Manager};
use zip::{write::FileOptions, CompressionMethod, ZipArchive, ZipWriter};

const FORMAT: &str = "dubcue-project";
const EXTENSION: &str = "dubcue";

fn root(app: &AppHandle) -> Result<PathBuf, String> { app.path().app_data_dir().map_err(|e| e.to_string()) }

fn collect_audio(value: &Value, result: &mut BTreeSet<String>) {
    match value {
        Value::Object(map) => { if let Some(name) = map.get("audioFile").and_then(Value::as_str) { result.insert(name.to_owned()); } for child in map.values() { collect_audio(child, result); } }
        Value::Array(items) => for child in items { collect_audio(child, result); },
        _ => {}
    }
}

fn validate_path(path: &Path) -> Result<(), String> {
    if path.extension().and_then(|v| v.to_str()).map(|v| v.eq_ignore_ascii_case(EXTENSION)) != Some(true) { Err(format!("project must use .{EXTENSION}")) } else { Ok(()) }
}

fn add_recent(app: &AppHandle, path: &Path) -> Result<(), String> {
    let recent_path = root(app)?.join("projects/recent.json");
    if let Some(parent) = recent_path.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    let mut values: Vec<String> = fs::read_to_string(&recent_path).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
    let value = path.to_string_lossy().into_owned(); values.retain(|item| item != &value); values.insert(0, value); values.truncate(12);
    fs::write(recent_path, serde_json::to_vec_pretty(&values).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_project(app: AppHandle, path: String, mut payload: Value) -> Result<String, String> {
    let path = PathBuf::from(path); validate_path(&path)?;
    if let Some(object) = payload.as_object_mut() { object.insert("format".into(), FORMAT.into()); object.insert("formatVersion".into(), 1.into()); }
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    let temp = path.with_extension(format!("{EXTENSION}.tmp"));
    let file = File::create(&temp).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default().compression_method(CompressionMethod::Deflated);
    zip.start_file("manifest.json", options).map_err(|e| e.to_string())?;
    zip.write_all(&serde_json::to_vec_pretty(&payload).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let mut audio = BTreeSet::new(); collect_audio(&payload, &mut audio);
    let outputs = root(&app)?.join("outputs");
    for name in audio { let safe = Path::new(&name).file_name().and_then(|v| v.to_str()).ok_or("invalid audio filename")?; let source = outputs.join(safe); if source.exists() { zip.start_file(format!("media/{safe}"), options).map_err(|e| e.to_string())?; std::io::copy(&mut File::open(source).map_err(|e| e.to_string())?, &mut zip).map_err(|e| e.to_string())?; } }
    zip.finish().map_err(|e| e.to_string())?;
    fs::rename(&temp, &path).map_err(|e| e.to_string())?; add_recent(&app, &path)?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn open_project(app: AppHandle, path: String) -> Result<Value, String> {
    let path = PathBuf::from(path); validate_path(&path)?;
    let mut archive = ZipArchive::new(File::open(&path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let mut json = String::new(); archive.by_name("manifest.json").map_err(|_| "project manifest is missing".to_string())?.read_to_string(&mut json).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    if value.get("format").and_then(Value::as_str) != Some(FORMAT) { return Err("this is not a DubCue project".into()); }
    let outputs = root(&app)?.join("outputs"); fs::create_dir_all(&outputs).map_err(|e| e.to_string())?;
    for index in 0..archive.len() { let mut entry = archive.by_index(index).map_err(|e| e.to_string())?; let name = entry.name().to_owned(); if let Some(safe) = name.strip_prefix("media/").and_then(|v| Path::new(v).file_name()).and_then(|v| v.to_str()) { std::io::copy(&mut entry, &mut File::create(outputs.join(safe)).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?; } }
    add_recent(&app, &path)?; Ok(value)
}

#[tauri::command]
pub fn autosave_project(app: AppHandle, payload: Value) -> Result<(), String> {
    let path = root(&app)?.join("projects/autosave.json"); if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
    let temp = path.with_extension("tmp"); fs::write(&temp, serde_json::to_vec_pretty(&payload).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?; fs::rename(temp, path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_autosave(app: AppHandle) -> Result<Option<Value>, String> {
    let path = root(&app)?.join("projects/autosave.json"); if !path.exists() { return Ok(None); }
    Ok(Some(serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?))
}

#[tauri::command]
pub fn recent_projects(app: AppHandle) -> Result<Vec<String>, String> {
    let path = root(&app)?.join("projects/recent.json"); Ok(fs::read_to_string(path).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default())
}

#[tauri::command]
pub fn save_audio(path: String, data: Vec<u8>) -> Result<String, String> {
    let path = PathBuf::from(path);
    if path.extension().and_then(|value| value.to_str()).map(|value| value.eq_ignore_ascii_case("wav")) != Some(true) {
        return Err("audio must use .wav".into());
    }
    if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|error| error.to_string())?; }
    fs::write(&path, data).map_err(|error| error.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}
