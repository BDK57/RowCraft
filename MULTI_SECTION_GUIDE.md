# Multiple sections in one Illustrator file

## Use the workflow

1. Load your Excel workbook and choose the worksheet. The selection in **People** is the starting selection for each new section.
2. Open **Card & fields**, choose your Illustrator template, and select **Multiple sections**.
3. Choose an artboard, click **Draw a section**, and drag a box around complete cards of one design. The box defines that section's available card positions. You can also enter percentages under **Precise selection / keyboard alternative**, or use all cards on an artboard with one card design.
4. Name the section and set its own inclusive participant range. For example, 1–10 creates 10 cards; 20–30 creates 11. These are participant numbers excluding the Excel header, consistent with the People grid. **Use selection from People** supports individually checked, non-contiguous selections.
5. Choose a sample card inside the box and map its fields to Excel columns. Those mappings apply only to this section. Changing the sample clears its field mappings.
6. Click **Select heading in artwork** or **Select month in artwork**, then click the actual page label. Type a fixed value, or choose an Excel column. Column-based headings/months use that section's first selected participant in worksheet order. Leave a role unassigned to keep its original artwork text.
7. Add the next section on this artboard or a different one. Review the counts, headings, and months, then generate.

The result is one editable `personalized-covers.ai`, an optional matching PDF, and a ZIP with the output and manifest. The uploaded source is never overwritten.

## Layout and overflow

- Card positions retain the template's spacing and reading order. Unused card positions inside each configured section are removed.
- Artwork outside section boxes is preserved. Include all card areas you want replaced; a box does not automatically clear unrelated cards elsewhere in the design.
- Sections on the same source artboard share continuation pages. The page count is the largest number of pages required by any section on that artboard.
- When a section runs out of selected participants, its remaining card positions are empty. Its configured heading/month still repeats on continuation pages.
- Sections on separate source artboards are exported in source-artboard order, with continuation pages for each. Different page sizes are retained.
- The same participant may intentionally appear in two sections. It counts as two generated cards.
- **Preview section pages** renders one populated page per configured source artboard. It does not change the full export selection. Job thumbnails show up to the first five output pages; the AI/PDF contain every generated page.

## Active field feedback

Clicking a card label in the preview scrolls to its mapping control. The row briefly highlights; its number stays filled with the primary color until another field is selected. Keyboard focus on its mapping control also selects it. Reduced-motion preferences disable smooth scrolling and the highlight animation.

## Engineering

`src/components/section-editor.tsx` stores boxes as normalized artboard coordinates and configures each section. `use-studio.ts` owns the section state, so switching between mapping and review retains the setup. The existing single-card batch mode remains available.

`server/sections.mjs` is a pure shared planner used by both React and Express. It validates full card containment, disjoint card positions, sample field ownership, stable record IDs, page-label ownership, column bindings, and the total canvas size. The client and server use the same capacity/pagination calculation.

The browser sends section configurations to `POST /api/jobs`. The backend resolves the records, freezes the plan, and submits it to the serialized local Illustrator worker. `generateSections()` in `server/illustrator.jsx` clones only configured source pages, retains native vector objects and text styles, fills each section independently, places continuation artboards within Illustrator's canvas, and saves the combined file. Temporary documents are explicitly activated before native operations; the isolated source is located by its full temporary path.

The output manifest records each participant's section, source artboard, output page, card slot, and Excel row. Existing download routes serve the actual local artifacts.

## Limits and workspace lifetime

- Up to 20 sections and 5,000 total generated cards, subject to Illustrator's artboard/canvas limits.
- Sections must use detected editable card groups of one design. Mixed card families or overlapping card assignments are rejected.
- A page label can belong to only one section/role on a given source artboard.
- Original typography is preserved by default. Long text produces review notes; the existing Condense option remains available.
- Section setup is retained in the current browser workspace when switching steps. Reloading, choosing another template, or changing the workbook/worksheet clears it. Section layouts are not added to the existing single-card preset format in this version.

## Verification

Automated planning tests cover independent ranges, same-page and cross-artboard sections, overflow assignments, proof truncation, overlapping selections, invalid boxes, foreign records, invalid columns, sample ownership, and intentionally repeated participants.

Native integration checks use the supplied artwork/workbook, generate AI and PDF, reopen the AI, and compare every generated card's field values and original font attributes. See `.local/checks/sections-example.json` and `.local/checks/sections-overflow.json` for the verified outputs. `scripts/native-sections-check.mjs` reruns those checks in isolated job folders.
