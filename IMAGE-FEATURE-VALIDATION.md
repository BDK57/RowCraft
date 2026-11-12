# RowCraft 0.2.0 image feature — 11 November 2026

Validated on Windows 11 x64 with Illustrator 26.0.1 (2022), Electron 45.2.3 and bundled Node 24.22.2.

## Passed

- TypeScript and Vite production build.
- All 45 automated tests, including existing workbook/grid/sections/download behavior, image geometry, mapped targets, imported path matching, EXIF orientation, invalid images, URL security, caching, unavailable-image fallback, hyperlinks and real image API requests.
- Native mixed-image export: six cards; four replaced images and two retained originals. This included local landscape/portrait images, a real HTTPS burger image, Fill, Fit, per-row offsets and zoom. Reopened AI files had the expected fields, unchanged typography and no external image links.
- Native shared-image export: all six cards replaced, including records with blank/missing image cells.
- Native sections: four cards across two continuation artboards in one AI file, with two independent photo areas. All replacement images were embedded. The original source AI hash stayed unchanged.
- Browser workflow: actual workbook upload, image-column selection, URL preview, Fit/Fill, dragging, separate per-person crop retention, shared image upload and shared crop retention when switching people.
- Browser-generated five-card AI and PDF with mapped shop names, scores and cities, plus the shared burger image. The final AI download route returned HTTP 200.
- Packaged source integrity: 72 shipped application files matched the frozen source/build; package version was 0.2.0.
- Packaged EXE: bundled backend, isolated React renderer, CSV upload, Sharp normalization, image thumbnails, origin/CSRF protection, real template ZIP import, native AI/PDF/ZIP generation and every download route.
- Packaged native output reopened successfully: exactly two selected cards on one artboard, two embedded replacement photos, zero linked images, expected mapped values and unchanged typography.
- Git whitespace checks.

The first packaging attempt was discarded after its smoke test detected an inconsistent archive caused by a source edit during packaging. The delivered installer was rebuilt from unchanged files and passed the integrity and native checks above.

## Evidence on this computer

- Native image scenarios: `.local/photo-check/634cd57e-7d86-4027-977a-aadd7ca77f5d/result.json` and its output folders.
- Packaged tests: `.local/desktop-check/0c64652e-9d4d-4683-bfc8-430c159c3a1a/smoke-result.json` and `native-verification.json`.
- Five-card user sample: `../outputs/rowcraft-image-feature-20261111/`.
- Installer: `release/RowCraft-Setup-0.2.0-x64.exe` (143,622,768 bytes).
- SHA-256: `2827be2e413681aee99ac8684862157350a7198e83657eea036f989020f20e5e`.

Private test files and generated installers are excluded from source control.

## Limits

The installer remains an unsigned private pilot. A clean-machine install/upgrade/uninstall cycle and other Illustrator versions were not certified during this feature work. The existing per-user installer and data-retention settings are retained.

Native image checks used small batches and section overflow; a 1,000-photo stress run was not performed. Full-resolution embedded photos can make large AI/PDF outputs substantial. One photo area is replaceable per repeated card. Complex/flattened artwork may need a separately grouped photo area in Illustrator. Embedded Excel pictures are not extracted; supported sources are public HTTPS URLs or explicitly imported files. Per-person Excel crops are session settings, while saved presets retain the selected image source/area and shared/default crop. See [Card images](CARD-IMAGES.md).

## Repeat

```powershell
npm test
npm run build
node scripts/native-grid-check.mjs --inspect-only
node scripts/native-photo-check.mjs
npm run desktop:dist
node scripts/verify-packaged-source.mjs
node scripts/desktop-smoke.mjs --native
node scripts/verify-desktop-output.mjs .local/desktop-check/<id-from-smoke-run>
```

Keep application files unchanged until packaging finishes. Native sample checks require the optional private template/workbook fixtures beside this checkout and a working licensed Illustrator installation.
