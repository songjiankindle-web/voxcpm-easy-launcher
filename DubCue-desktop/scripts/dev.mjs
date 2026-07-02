import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendUrl = process.env.DUBCUE_BACKEND_URL || "http://127.0.0.1:8810";
const pythonCandidates = [
  process.env.DUBCUE_PYTHON,
  path.resolve(desktopDir, "../VoxCPM-main/.venv/bin/python"),
  path.resolve(desktopDir, "../VoxCPM-main/.venv/Scripts/python.exe"),
].filter(Boolean);
const python = pythonCandidates.find(existsSync);
const server = path.resolve(desktopDir, "backend/server.py");
const vite = path.resolve(desktopDir, "node_modules/vite/bin/vite.js");

let backend;
let frontend;
let shuttingDown = false;

async function backendReady() {
  try {
    const response = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(500) });
    return response.ok;
  } catch {
    return false;
  }
}

function stop(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  frontend?.kill("SIGTERM");
  backend?.kill("SIGTERM");
  process.exitCode = exitCode;
}

process.on("SIGINT", () => stop(130));
process.on("SIGTERM", () => stop(143));

if (!(await backendReady())) {
  if (!python) {
    console.error("[DubCue] VoxCPM Python environment was not found. Expected ../VoxCPM-main/.venv.");
    process.exit(1);
  }
  backend = spawn(python, [server], { cwd: desktopDir, env: process.env, stdio: "inherit" });
  backend.once("exit", (code) => {
    if (!shuttingDown) {
      console.error(`[DubCue] Backend stopped before the UI (exit ${code ?? "unknown"}).`);
      stop(code || 1);
    }
  });

  const deadline = Date.now() + 30_000;
  while (!(await backendReady())) {
    if (backend.exitCode !== null) process.exit(backend.exitCode || 1);
    if (Date.now() >= deadline) {
      console.error("[DubCue] Backend did not become ready within 30 seconds.");
      stop(1);
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

frontend = spawn(process.execPath, [vite, ...process.argv.slice(2)], {
  cwd: desktopDir,
  env: process.env,
  stdio: "inherit",
});
frontend.once("exit", (code) => stop(code || 0));
