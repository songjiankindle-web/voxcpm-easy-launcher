# DubCue Desktop

Offline desktop workspace for directing long-form narration with VoxCPM.

This directory contains the DubCue desktop workspace. It connects to a local
Python service for VoxCPM2 generation while keeping project data and audio on
the user's machine.

## Development

```bash
npm install
npm run dev
npm run build
npm run tauri dev
```

`npm run dev` starts both the local VoxCPM bridge and the browser UI. Use
`npm run dev:ui` only when the backend is already running separately.

The desktop workspace includes:

- Editable director table with row-level audio states
- Enter-to-split and start-of-row Backspace-to-merge editing
- Segment inspector for pacing, direction, pause, and reference voice
- Real local row and batch generation through VoxCPM2
- Quantified target pacing in characters per minute
- Drag-and-drop column and segment ordering
- Local project autosave with undo and redo
- Light/dark themes and Chinese/English interface switching
- Desktop project, chapter, render, and export shell
