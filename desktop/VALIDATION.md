# Windows desktop pilot validation — 10 November 2026

## Verified on this computer

- Windows 11 x64 (build 26200), Electron 45.2.3, bundled Node 24.22.2 and Adobe Illustrator 26.0.1 (2022).
- TypeScript check and Vite production build passed.
- All 36 Node tests passed, including existing workbook/grid/section behavior, actual download routes, isolated desktop storage, dynamic loopback origins, CSRF, streaming ZIP round trips, malicious archive paths, size limits, and desktop navigation policy.
- Read-only prerequisite tests detected the installed Illustrator executable. A nonexistent COM class was substituted in memory to verify the missing-installation result (exit code 3); no registry keys were changed.
- The packaged `RowCraft.exe` started from a separate working directory using its own Node runtime. React loaded and renderer Node access was unavailable.
- The packaged app imported a real template ZIP, rendered the Illustrator preview, imported two CSV records, and generated one editable AI, matching PDF and ZIP. Every download route returned nonempty bytes.
- Reopening temporary copies of the generated AI confirmed exactly two cards on one artboard, the expected mapped values, zero linked images and unchanged mapped typography compared with the source template.
- The real NSIS installer opened and showed its Illustrator prerequisite page with successful detection, Adobe setup link and retry control. Installation was not completed during this UI check.
- No private `.ai`, `.xlsx` or `.psd` sample files were included in the application archive.
- Windows product metadata identifies the executable as RowCraft 0.1.0. The installer is unsigned, matching the private-pilot distribution choice.

Native smoke evidence is stored locally under `.local/desktop-check/2e8c9a6b-7dfa-434f-91f8-c86e18c8abcc/`: `smoke-result.json`, `native-verification.json`, `desktop.png` and generated output. These fixtures and user data are excluded from Git and installer packaging.

## Remaining limits

- This is a private pilot, not a signed public release. Windows may show publisher/reputation warnings.
- A full clean-machine install/upgrade/uninstall cycle and the installer UI on a computer without Illustrator have not been tested. The missing-prerequisite detection branch is covered separately as described above.
- Other Illustrator versions, ARM Windows and other operating systems have not been certified. Existing planner tests cover large selections and multiple sections; the packaged native smoke run used two records, not a 1,000-record stress run.
- The production dependency audit reported two moderate entries in the existing ExcelJS → UUID dependency chain, with no high or critical production findings. ExcelJS uses UUID v4; the advisory concerns buffer handling in other UUID functions. No forced ExcelJS downgrade or unverified major dependency override was applied. Review this dependency before a public release.
- Existing browser `.local` history is preserved in place and is not automatically migrated into desktop storage.

## Repeat checks

```powershell
npm test
npm run desktop:dist
node scripts/desktop-smoke.mjs --native
node scripts/verify-desktop-output.mjs .local/desktop-check/<id-from-smoke-run>
```

The native commands need licensed, working Illustrator and the optional private template fixture beside this checkout. The original template is never edited.
