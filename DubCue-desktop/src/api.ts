export type BackendHealth = {
  ok: boolean;
  modelLoaded: boolean;
  modelId: string;
  outputDirectory: string;
};

export type GenerateSegmentRequest = {
  text: string;
  direction: string;
  targetCpm: number;
  cfgValue: number;
  inferenceTimesteps: number;
  promptText?: string;
  referenceAudio?: {
    name: string;
    base64: string;
  };
};

export type GeneratedAudio = {
  audioUrl: string;
  audioFile: string;
  durationSeconds: number;
  actualCpm: number;
  targetCpm: number;
};

export type ReferenceAudioPayload = {
  name: string;
  base64: string;
};

export type MergeRequestItem = {
  audioFile: string;
  pauseSeconds: number;
};

export type MergedAudio = {
  audioUrl: string;
  audioFile: string;
  durationSeconds: number;
};

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8810";
let desktopBackend: { url: string; token: string } | null = null;

export function configureDesktopBackend(url?: string, token?: string) {
  desktopBackend = url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function backendUrl() {
  return desktopBackend?.url || window.localStorage.getItem("dubcue.backend-url") || DEFAULT_BACKEND_URL;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${backendUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(desktopBackend ? { Authorization: `Bearer ${desktopBackend.token}` } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `DubCue backend returned ${response.status}`);
  }
  return payload as T;
}

export function getBackendHealth() {
  return request<BackendHealth>("/health");
}

export function generateSegment(payload: GenerateSegmentRequest) {
  return request<GeneratedAudio>("/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function transcribeReference(referenceAudio: ReferenceAudioPayload) {
  return request<{ text: string }>("/transcribe-reference", {
    method: "POST",
    body: JSON.stringify({ referenceAudio }),
  });
}

export function mergeSegments(items: MergeRequestItem[]) {
  return request<MergedAudio>("/merge", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export function absoluteAudioUrl(path: string) {
  return path.startsWith("http") ? path : `${backendUrl()}${path}`;
}
