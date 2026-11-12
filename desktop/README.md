# RowCraft for Windows

For the Apple Silicon macOS QA build, see [macOS DMG instructions](MACOS.md). Windows packaging commands and data locations below remain unchanged.

The desktop app shares the existing React/Vite frontend, Express API, planners and Illustrator JSX renderer. The browser version remains available with `npm run dev` and `npm run start` after a web build.

## Install and use

1. Install Adobe Illustrator through Adobe Creative Cloud. The RowCraft installer requires Illustrator's executable and Windows automation registration.
2. Run `RowCraft-Setup-0.2.1-x64.exe`. Follow the prerequisite and destination pages, then launch RowCraft.
3. Complete any Adobe sign-in/activation prompts. RowCraft checks the native connection before opening the workspace.
4. Upload your workbook and artwork, select records, map fields or sections, and generate. Use a ZIP containing one AI file plus its linked images when the design uses external assets.
5. Download the AI, PDF or ZIP from Batch History. Electron opens a Save dialog. The File menu also opens the local artwork folder.

Node.js is embedded in Electron; no separate Node, npm, Python, API key, or manually started server is needed. Adobe licensing and required Adobe internet checks are separate. This private pilot is unsigned, so Windows may show an unknown-publisher/SmartScreen warning; verify the installer source and SHA-256 before running it. Code signing is required before a polished client release.

For optional image URLs, local folders, shared photos and crop controls, see [Card images](../CARD-IMAGES.md).

## Local files and upgrades

- Desktop files: `%APPDATA%\RowCraft\data` (uploads, parsed workbooks, templates, images and jobs).
- Desktop log: `%APPDATA%\RowCraft\desktop.log`.
- Browser development data stays in the project's `.local` directory. Existing web history is neither moved nor deleted automatically.
- The source workbook and artwork are copied into job storage before edits; generated output is saved separately.
- Exports downloaded with Save are separate copies in the folder you choose.
- Upgrades and uninstall retain user data and saved artwork. RowCraft never uninstalls Illustrator.
- Closing during generation offers to wait until the queue finishes. RowCraft does not quit Illustrator or close the user's other documents.

To test from an empty state, close RowCraft and wait for artwork jobs to finish. Back up `%APPDATA%\RowCraft`, then rename that folder to `RowCraft-backup`. Start RowCraft to create a fresh folder. This does not remove separately downloaded exports or the web app's `.local` data. Do not perform this reset while an export is running.

## Build from source

Use Node.js 22.12 or newer (Node 24 recommended) on Windows x64, then:

```powershell
npm ci
npm run desktop:dev   # Build the same Vite UI and launch Electron
npm run desktop:pack  # Create release/win-unpacked/RowCraft.exe
npm run desktop:dist  # Create the self-contained NSIS installer in release/
npm test
npm run desktop:smoke # Launch and check the packaged app in an isolated data folder
```

`node scripts/desktop-smoke.mjs --native` additionally tests a real template import and native AI/PDF/ZIP export if the private sample design is present beside this repository. It writes evidence under `.local/desktop-check/<id>` and leaves original artwork untouched. No private sample designs or spreadsheets are included in the installer.

## Engineering

Electron main starts a Node utility process with `desktop/backend.mjs`. That process imports the existing server with an injected per-user data directory and listens on `127.0.0.1` using a free port. Main loads the packaged Vite interface from that same origin. Existing `/api` routes and CSRF tokens remain in use. The renderer has no Node access, no arbitrary native IPC, and no remote navigation permissions.

The backend copies `server/illustrator.jsx` out of the packaged resources into a real job directory. Hidden Windows PowerShell calls Illustrator's COM interface and executes that worker. Illustrator produces PNG previews, native AI and optional PDF. Streaming Node ZIP libraries handle asset uploads and archive downloads without Python. Heavy Illustrator operations remain queued sequentially.

The NSIS prerequisite page and the runtime use the same PowerShell detection source. The installer checks the registered executable, including nonstandard paths and both registry views. It blocks missing/broken installations and offers Adobe setup plus retry; silent installation exits with code 3 when the prerequisite is missing. Runtime additionally tests the actual COM connection. Presence alone is not a license/activation check.

For releases, record the Illustrator and operating-system versions actually tested. The verified pilot targets Windows x64; the new macOS implementation still requires Mac build and Illustrator QA. Linux, cloud rendering, public auto-updates and Adobe redistribution are outside this build.
