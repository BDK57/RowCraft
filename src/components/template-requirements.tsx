import { BookOpen, FileCheck2, Image, Layers, ScanText, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const requirements = [
  {
    title: 'Group each complete card', icon: Layers,
    details: 'Keep the photo, background and labels together in one card group. Each detectable card needs at least two live text objects. Separate card groups should use matching dimensions and the same number of text fields.',
  },
  {
    title: 'Keep labels editable', icon: ScanText,
    details: 'Names, headings and months must remain live Illustrator text to be selectable and mapped. Outlined text and text inside a flattened image can appear in the preview, but cannot be mapped as existing text labels.',
  },
  {
    title: 'Include fonts and linked artwork', icon: Type,
    details: 'Install the design’s fonts on the computer running Illustrator. Embed linked images, or upload a ZIP containing the AI file and its linked assets. Resolve missing-image warnings before generating. Original typography is preserved by default; long text may need review.',
  },
  {
    title: 'Prepare optional card photos', icon: Image,
    details: 'Select a detected photo area inside the sample card. Use an Excel column with HTTPS image URLs or filenames/paths plus imported matching files, or upload one shared image for every card. Missing row images keep the sample card’s original image. Use Fit, Fill and drag adjustment before generating.',
  },
  {
    title: 'Choose rows and section boundaries', icon: FileCheck2,
    details: 'Upload XLSX or CSV with column headings in the first populated row. Record ranges exclude headers and blank rows. One selected record becomes one card. For multiple sections, box each section’s cards, choose its sample card and row range, then connect its heading and month separately.',
  },
];

export function TemplateRequirements({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="requirements-dialog">
      <DialogHeader>
        <DialogTitle>Template requirements</DialogTitle>
        <DialogDescription>Prepare your artwork for RowCraft. These are the current app’s compatibility rules, not restrictions of the AI file format.</DialogDescription>
      </DialogHeader>
      <div className="requirements-body">
        <section className="requirements-detection" aria-labelledby="requirements-detection-title">
          <h3 id="requirements-detection-title">Current automatic card detection</h3>
          <p>Card dimensions are measured against their own artboard.</p>
          <dl>
            <div><dt>Card width</dt><dd>4%–40% of artboard width</dd></div>
            <div><dt>Card height</dt><dd>2.5%–32% of artboard height</dd></div>
            <div><dt>Editable text</dt><dd>At least 2 text objects per card group</dd></div>
          </dl>
          <p>If a repeated family has 4 or more cards, smaller families are excluded. Cards are matched by dimensions (within 2 pt) and text-field count.</p>
          <p><strong>A visible preview does not guarantee detectable cards.</strong> A taller card can render correctly and still be excluded by the 32% height limit. This guidance does not change that limit.</p>
        </section>
        <div className="requirements-grid">
          {requirements.map(({title, icon: Icon, details}) => <section key={title} className="requirement-item">
            <h3><Icon aria-hidden="true" />{title}</h3><p>{details}</p>
          </section>)}
          <section className="requirement-item">
            <h3><BookOpen aria-hidden="true" />Check a proof before a large batch</h3>
            <p>Adobe Illustrator must be installed and activated on the computer running RowCraft. Windows uses COM automation; macOS requires permission to control Illustrator under Privacy & Security → Automation. Upload AI / ZIP and workbook files up to 160 MB each. A batch supports up to 5,000 records, subject to available Illustrator canvas space and computer resources. Extra pages stay in one editable AI file; a matching combined PDF is optional. Your source design is processed as a copy.</p>
          </section>
        </div>
        <p className="requirements-note">No cards found? Check grouping, live text and the size limits above, then re-upload the updated artwork or run Analyze cards. Repeating analysis alone will not fix an unsupported layout.</p>
      </div>
      <DialogFooter><DialogClose asChild><Button>Got it</Button></DialogClose></DialogFooter>
    </DialogContent>
  </Dialog>;
}
