# Cover Studio UI revamp

The Vite/React/TypeScript app now uses three guided screens: People, Card & fields, and Review & export. It retains the local Illustrator worker and original export behavior.

## Changes

- Real shadcn/Radix components, IBM Plex typography, consistent semantic color tokens, and responsive navigation.
- Workbook table with worksheet selection, row ranges, individual selection, search, sorting, and pagination.
- Whole-card selection and zoomable artwork beside an inspector showing every card field, its Excel column, sample value, and original typography.
- Existing page-text mappings, custom positions, and saved mapping presets remain available.
- Persistent light/dark/system themes, reduced-motion support, and Motion screen/selection feedback.
- Review summary, Illustrator-rendered proof dialog, direct AI/PDF/ZIP links, saved-folder details, and Bklit chart using real completed exports.
- PNG export now verifies that Illustrator wrote the preview and falls back to its imageCapture method when needed.

## Verified November 4, 2026

- TypeScript build passes; Vite production build passes.
- All 18 automated tests pass, including real HTTP downloads, workbook parsing, row selection, mapping validation, grid boundaries, and typography defaults.
- Browser checks cover supplied workbook, first five January people, all three card mappings, guided navigation, light/dark themes, and mobile layout at 390px without horizontal overflow.
- New UI generated batch f27e78be-7a97-479b-add8-312db448d098: five cards on one page, one editable AI file, matching PDF, and a nonempty PNG proof. Output is in `.local/jobs/<batch-id>/output`.
- Taste static lint: zero failures, five warnings for small inspector section labels retained to orient the mapping workflow.
- The browser download approval gate declined the final manual download check. No browser download retries were attempted; automated route tests passed.

## Remaining limits

The supplied design needs editable text and grouped cards for reliable selection. Original typography is preserved by default; one long shop name in the five-person sample is flagged for review. Condensing text is an explicit option. Vite reports a bundle-size advisory for the shared main chunk; individual workflow screens are lazy loaded. Workbook selections are held in the current session; only theme preference and saved server-side mapping presets persist.

Open http://127.0.0.1:5173/ while `npm run dev` is running. Use a supported Node version (the bundled Node 24 runtime works).
