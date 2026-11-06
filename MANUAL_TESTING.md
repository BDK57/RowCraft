# Manual check

1. Open http://127.0.0.1:5173/ and click **Use supplied workbook**. January's first five records should be checked. Try records 5–10: this means **six** people. Clear/select individual rows and test another worksheet.
2. Open **Cover & mapping**. Select the newest saved template, or upload the supplied AI/packaged ZIP. Older templates can be updated using **Analyze card structure**. Choose **Cover 2**, the confirmed-winners card page.
3. Click any whole card to choose the sample. Zoom and map its **Usama Mobile → Shop Name**, **Scoring 539 → Scoring**, and **Gaggoo Mandi → City** fields. You only need to map that one card. The original label does not restrict which column you choose.
4. Keep the first five January records selected and render the first populated page. Expect **five cards only**, with the original month, heading, footer and spacing. No other people should remain.
5. Click **Generate 5 cards**. Download **Illustrator (.ai)** and **PDF** directly. Both should contain one page with five cards. The ZIP includes these files, previews and the manifest. Expand **Saved folder on this computer** to locate the real files.
6. Reload the browser. The completed batch should still appear under **Generated batches**. The `/api/` addresses are download routes; you do not create an `api` directory.
7. For an overflow check, select 57 records on Cover 2. Expect one AI with two artboards and one two-page PDF: 56 cards on page one, one card on page two, with the same page artwork. Review any text-fit warnings.
8. Optional: map the month or another page field. Page mappings use the first selected record on every page; unmapped page fields remain unchanged. Save a mapping, replace the workbook with matching column names, and reuse it.

# Automated coverage

- Workbook formats, dates, zero, formatted identifiers, cached formulas, repeated headers and invalid cells.
- Empty/duplicate/foreign selections, original worksheet order, column mapping and invalid custom positions.
- Card choice, grid order, exact page boundaries, sparse final pages, invalid layout and canvas limits.
- Real HTTP AI/PDF/ZIP/preview responses, missing files, unknown API routes, saved-job reloads and CSRF rejection.
- Native five-card and 57-card AI outputs reopened in Illustrator; each card's values and embedded artwork checked.
- Matching PDF page counts, page dimensions, extracted text and rendered appearance.

Original font family/weight, point size and scale are preserved by default. Long text produces an overflow warning; condensation is available only if you explicitly choose it under **Text fitting**. Fonts and printer-specific bleed/color settings still need a final proof review. Grouped editable card templates are required; flattened cards cannot be reconstructed automatically.
