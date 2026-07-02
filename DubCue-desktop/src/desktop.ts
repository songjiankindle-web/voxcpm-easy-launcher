import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";

export type RuntimeStatus = {
  status: "notInstalled" | "downloading" | "verifying" | "ready" | "starting" | "running" | "error" | "updateRequired";
  version?: string;
  message: string;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  backendUrl?: string;
  sessionToken?: string;
  modelInstalled: boolean;
};

export type ProviderInstallStatus = {
  providerId: string;
  status: "idle" | "checking" | "downloading" | "installing" | "starting" | "testing" | "ready" | "error";
  stage: string;
  message: string;
  humanMessage: string;
  progress: number;
  installDir?: string;
  errorCode?: string;
};

export const isDesktopApp = () => "__TAURI_INTERNALS__" in window;
export const runtimeStatus = () => invoke<RuntimeStatus>("runtime_status");
export const installRuntime = () => invoke<RuntimeStatus>("install_runtime", { manifestUrl: null });
export const pauseInstall = () => invoke<void>("pause_install");
export const resumeInstall = () => invoke<void>("resume_install");
export const startBackend = () => invoke<RuntimeStatus>("start_backend");
export const repairRuntime = () => invoke<RuntimeStatus>("repair_runtime");
export const uninstallModel = () => invoke<RuntimeStatus>("uninstall_model");
export const openLogs = () => invoke<string>("open_logs");
export const providerInstallStatus = () => invoke<ProviderInstallStatus>("provider_install_status");
export const installModelProvider = (providerId: string, licenseConfirmed: boolean) => (
  invoke<ProviderInstallStatus>("install_model_provider", { providerId, licenseConfirmed })
);

export const openExternalUrl = (url: string) => (
  isDesktopApp()
    ? openUrl(url)
    : Promise.resolve(window.open(url, "_blank", "noopener,noreferrer"))
);

export function watchRuntime(callback: (status: RuntimeStatus) => void): Promise<UnlistenFn> {
  return listen<RuntimeStatus>("runtime-progress", ({ payload }) => callback(payload));
}

export function watchProviderInstall(callback: (status: ProviderInstallStatus) => void): Promise<UnlistenFn> {
  return listen<ProviderInstallStatus>("provider-install-progress", ({ payload }) => callback(payload));
}

export type NativeWorkspace<T> = {
  format?: string;
  formatVersion?: number;
  savedAt: string;
  currentProjectId: string;
  projects: T[];
};

export async function saveProjectFile<T>(workspace: NativeWorkspace<T>, currentPath?: string) {
  if (!isDesktopApp()) return null;
  const path = currentPath || await save({ title: "保存 DubCue 工程", defaultPath: "Untitled.dubcue", filters: [{ name: "DubCue Project", extensions: ["dubcue"] }] });
  if (!path) return null;
  return invoke<string>("save_project", { path, payload: workspace });
}

export async function openProjectFile<T>() {
  if (!isDesktopApp()) return null;
  const path = await open({ title: "打开 DubCue 工程", multiple: false, filters: [{ name: "DubCue Project", extensions: ["dubcue"] }] });
  if (!path || Array.isArray(path)) return null;
  return { path, payload: await invoke<NativeWorkspace<T>>("open_project", { path }) };
}

export async function saveAudioFile(filename: string, data: number[], defaultDirectory?: string) {
  if (!isDesktopApp()) return null;
  const separator = defaultDirectory?.includes("\\") ? "\\" : "/";
  const path = await save({
    title: "保存音频",
    defaultPath: defaultDirectory ? `${defaultDirectory.replace(/[\\/]$/, "")}${separator}${filename}` : filename,
    filters: [{ name: "WAV Audio", extensions: ["wav"] }],
  });
  if (!path) return null;
  await invoke<string>("save_audio", { path, data });
  return path;
}

export const autosaveWorkspace = <T>(workspace: NativeWorkspace<T>) => isDesktopApp() ? invoke<void>("autosave_project", { payload: workspace }) : Promise.resolve();
export const loadAutosave = <T>() => isDesktopApp() ? invoke<NativeWorkspace<T> | null>("load_autosave") : Promise.resolve(null);
