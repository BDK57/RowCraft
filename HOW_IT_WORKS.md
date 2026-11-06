# Cover Studio: processing and fresh testing

## What happens to a batch

1. The browser uploads the workbook and AI file (or packaged ZIP) to the Node server on this computer. The browser cannot browse arbitrary folders on its own.
2. ExcelJS parses the workbook. The browser shows rows using TanStack Table, with stable row IDs so selection and sorting do not mix people.
3. The local server asks installed Illustrator to inspect a temporary copy of the design. Illustrator supplies page previews, grouped-card bounds, editable text, and typography information.
4. You choose the sample card, connect its fields to Excel columns, and select people.
5. The server validates the selection and mappings, queues the job, and invokes Illustrator through Windows COM and its JavaScript scripting engine. Jobs run one at a time because they share Illustrator.
6. Illustrator populates one card per selected row, removes unused cards, preserves the page design, and adds matching artboards for overflow. It saves one editable AI file and the optional matching PDF. Original typography is preserved unless you explicitly choose condensation.
7. The app shows the proof and download links. The links beginning with `/api/` are HTTP routes, not Windows directories.

## Technology

| Responsibility | Technology |
|---|---|
| Browser UI and bundler | React 19, TypeScript, Vite |
| Components, themes | shadcn/ui with Radix, Tailwind CSS 4, semantic CSS variables |
| Icons | Lucide, available in the shadcn.io icon catalog |
| Animation | Motion for React (the Framer Motion package's current `motion/react` interface), with reduced-motion support |
| Workbook parsing and grid | ExcelJS, TanStack Table |
| Artwork zoom | react-zoom-pan-pinch |
| Batch chart | Bklit registry chart components and D3 |
| Local API and uploads | Node.js, Express, Multer |
| Native artwork | Installed Adobe Illustrator, Windows COM, Illustrator JavaScript |
| ZIP preparation | Local Python standard-library helper |

The workflow definitions, application state hook, brand component, sidebar, and batch details are reusable sources of truth. Theme colors live in `src/styles/globals.css`. Composition, providers, and custom hooks share behavior without unnecessary higher-order wrappers. The artwork canvas remains a specialized component; standard form controls and navigation use shadcn.

## Where files live

Under this project's `.local` directory:

- `uploads`: uploaded source copies and extracted packages.
- `workbooks`: parsed workbook data.
- `templates`: imported template metadata, presets, and previews.
- `jobs/<id>`: isolated working copies, request/status files, and generated output.

Downloaded browser copies are separate and normally live in your Downloads folder. Source files in the sibling `excel` and `illustrations` folders are not deleted by a reset. The server listens on `127.0.0.1`; normal batch processing does not require a cloud AI service or tokens.

## Is this the best approach?

For editable AI output on this Windows computer, using Illustrator's own renderer is a practical choice: it preserves native design features better than rebuilding arbitrary AI files in a browser. It needs installed/licensed Illustrator, available fonts, and resolved linked assets. It is suitable for one local workstation, rather than a concurrent cloud service. The queue prevents overlapping jobs; very large batches still take time. A future cloud renderer can replace this worker but would require separate API access and validation of supported features.

## Start fresh without adding a reset feature

These are instructions only. No existing app data has been reset.

1. Wait for all rendering jobs to finish. Stop both the API and Vite server. If launched in a terminal, use Ctrl+C there. Close the app's browser tab. Stop any independently launched API process too.
2. In File Explorer open the application folder containing `package.json` and rename `.local` to a unique backup name, such as `.local-backup-2026-11-04`. This archives imports, presets, previews, history, and generated job files so you can recover them.
3. Start the app with `npm run dev`, using Node 22.12+ or the bundled Node 24 runtime. The server creates fresh data directories automatically.
4. Reopen `http://127.0.0.1:5173/`. For a completely fresh appearance preference, clear this site's browser storage; theme preference is stored under `cover-studio-theme`. Clear both localhost and 127.0.0.1 if you used both addresses.
5. Upload your workbook and design again. History and saved templates should now start empty.

If you want to permanently remove the archived data, delete that specifically named backup folder through File Explorer after checking that you no longer need its generated artwork. Browser-downloaded copies must be removed separately. Keep the source `excel` and `illustrations` directories, app source, and `node_modules`.

To recover an archived session, stop the servers, rename the fresh `.local` to another backup name, and rename the old backup to `.local` before restarting.
