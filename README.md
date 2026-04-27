# Running Sheet Transcriber

An offline desktop application for creating match incident running sheets from audio recordings. Built for football match official coaches to transcribe, review, and publish incident reports with precision.

---

## Features

- **Transcribe** — Import audio recordings and annotate match incidents with timestamps and notes
- **Review** — Review and refine transcribed entries before publishing
- **Publish** — Export polished running sheets as PDF
- **Browse** — Manage all running sheet projects in one place
- **Text Highlighting** — Highlight entries in yellow or red for quick visual classification
- **Undo / Redo** — Full undo/redo support for text edits and highlights (Ctrl+Z / Ctrl+Y)
- **Mark as Complete** — Flag finished sheets and queue them for automatic deletion after a configurable retention period
- **Audio Hotkeys** — Fully configurable keyboard shortcuts for playback control

---

## Installation

### Windows
Download the latest `Running Sheet Transcriber Setup x.x.x.exe` from the [Releases](../../releases) page and run the installer. Administrator privileges are required.

### Linux
Download the `.AppImage` or `.deb` file from the [Releases](../../releases) page.

**AppImage:**
```bash
chmod +x "Running Sheet Transcriber-x.x.x.AppImage"
./"Running Sheet Transcriber-x.x.x.AppImage"
```

**Debian/Ubuntu:**
```bash
sudo dpkg -i running-sheet-transcriber_x.x.x_amd64.deb
```

---

## Building from Source

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- npm

### Setup
```bash
git clone https://github.com/JarlOfSunAndRain/RunningSheetTranscriber.git
cd RunningSheetTranscriber
npm install
```

### Run (development)
```bash
npm start
```

### Build installer

**Windows:**
```bash
npm run build:win
```

**Linux:**
```bash
npm run build:linux
```

Build output is placed in the `dist/` directory.

---

## Usage

1. **Set storage folder** — On first launch, select a folder to store your running sheet projects
2. **Create a running sheet** — Enter match details (teams, date, competition, officials)
3. **Import audio** — Import your match audio recordings into the sheet
4. **Transcribe** — Play back audio and add timestamped incident entries
5. **Review** — Check entries, adjust highlights, and finalize the sheet
6. **Publish** — Export as PDF for distribution
7. **Mark as Complete** — Flag the sheet as done; it will be auto-deleted after your configured retention period

---

## Configuration

Open **Settings** (gear icon) to configure:
- **Storage Directory** — Where running sheet data is saved
- **Audio Hotkeys** — Keyboard shortcuts for playback (Play/Pause, Skip, etc.)
- **Completed Sheets** — Auto-delete retention period (default: 30 days after completion)

---

## License

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the [GNU Affero General Public License](LICENSE) for more details.

The full license text is available at: https://www.gnu.org/licenses/agpl-3.0.html
