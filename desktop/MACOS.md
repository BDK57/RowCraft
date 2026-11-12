# RowCraft for macOS — QA build

**Target: Apple Silicon (ARM64). Status: implementation prepared on Windows; a macOS build and real Illustrator QA are still required. No Mac compatibility claim is made until those checks pass.**

The React interface, local backend, planners and Illustrator JSX remain shared with Windows. Windows continues using PowerShell/COM. macOS discovers Illustrator through Launch Services and invokes the same JSX through AppleScript (`osascript`). No separate Node.js installation is needed by the person installing the app.

## Produce the DMG from Windows using GitHub Actions

1. Review and commit the app changes and `.github/workflows/macos-dmg.yml` to the RowCraft repository. Push to a dedicated branch named `qa/macos-arm64-<build-name>` to start its QA build without changing the default branch. Do not commit source artwork, customer spreadsheets, `.local`, release binaries, signing keys or passwords.
2. On GitHub, open **Actions → Build macOS DMG (Apple Silicon)** and select the run for that QA branch. Once this workflow is also on the default branch, you can alternatively use **Run workflow** and select the source branch.
3. The ARM64 macOS runner installs dependencies, runs non-Illustrator tests, builds the app and DMG, checks the packaged files and ad-hoc signature, verifies the disk image and calculates its SHA-256.
4. When the job succeeds, download **RowCraft-mac-arm64-QA** from that run’s Artifacts section. Extract the archive and send the `.dmg` and checksum file to QA. The workflow does not publish a GitHub release; it runs for explicit QA-branch pushes or manual dispatches.

Expected file: `release/RowCraft-0.2.1-mac-arm64.dmg` (version follows `package.json`). The runner does not contain licensed Illustrator, so packaging checks are not an Illustrator export test. GitHub Actions quotas, availability and any charges depend on the repository/account plan.

## Build directly on a Mac

Use Node.js 24 and this source checkout:

```sh
npm ci
npm test
npm run desktop:dist:mac -- arm64
node scripts/verify-packaged-source.mjs
```

Windows packaging stays `npm run desktop:dist`. The Mac build command deliberately stops on Windows. It must not generate an EXE and rename it to DMG. `x64` and `both` are optional build arguments for later Intel testing; the configured QA target is ARM64.

## QA installation

1. Use an Apple Silicon Mac with a supported macOS version for the bundled Electron and an installed, licensed Adobe Illustrator. Complete Illustrator’s first launch and Adobe sign-in first.
2. Open the DMG, drag **RowCraft.app** into **Applications**, eject the image, then launch the app from Applications.
3. When macOS asks whether RowCraft can control Adobe Illustrator, allow it. If permission was denied, use **System Settings → Privacy & Security → Automation → RowCraft → Adobe Illustrator**, then retry. A source build may identify the requesting app as Electron or Terminal. RowCraft does not change these permissions automatically.
4. Upload your XLSX/CSV and AI/ZIP, map a known compatible sample card, render a proof, then generate a small AI/PDF batch before a large export.

This internal pilot uses **ad-hoc signing**, not an Apple Developer ID certificate, and is not notarized. Ad-hoc signing ensures local code-signature integrity; it does not establish a trusted Apple publisher. macOS may block a downloaded copy under Gatekeeper. Follow your organization’s approved software policy; do not disable Gatekeeper, remove quarantine recursively or bypass endpoint protection. For normal trusted distribution, configure Developer ID signing and Apple notarization on the macOS builder.

## QA acceptance checks

- Illustrator detection, version check, first-run Automation prompt, denial and retry.
- AI/ZIP import, embedded/linked images, installed/missing fonts, artboard previews and field boxes.
- Text mappings, first five records, exactly five cards, unchanged source AI and correct editable AI/PDF downloads.
- Multiple sections, heading/month changes and continuation artboards.
- Optional shared/Excel images, missing-image fallback, Fit/Fill and crop positioning.
- Paths containing spaces, Unicode and apostrophes; macOS filesystem case sensitivity.
- Close while Illustrator is working, preserved user documents and completed history after restart.
- Actual macOS version, Illustrator version, Mac chip, output counts and visual typography recorded in the QA report.

With Illustrator installed, the existing packaged smoke check is available:

```sh
npm run desktop:smoke
# Optional real export when the private sample folder exists beside the repo:
node scripts/desktop-smoke.mjs --native
```

## Local data and rollback

Data: `~/Library/Application Support/RowCraft/data`; log: `~/Library/Application Support/RowCraft/desktop.log`. Downloads are separate copies wherever QA saves them. Windows data and the source checkout’s `.local` folder are not migrated or deleted.

To reset QA, finish jobs and quit RowCraft, back up and rename `~/Library/Application Support/RowCraft`, then relaunch. To roll back the application, quit it and replace the app bundle with the previous QA build; keep a data backup. Do not reset while a job is running.

## Build references

- [electron-builder platform constraints](https://www.electron.build/v26/docs/features/multi-platform-build/)
- [macOS targets, signing and entitlements](https://www.electron.build/v26/docs/mac/)
- [GitHub-hosted ARM64 macOS runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Apple Automation entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.automation.apple-events)
