"""Check page counts, text and page size, then render PDF proofs with Poppler."""
import json
from pathlib import Path
import re
import shutil
import subprocess
import unicodedata
from pypdf import PdfReader
from PIL import Image,ImageChops,ImageStat

def normalize(value):
    # Adobe's subset-font ligatures may be extracted as /f_i instead of fi.
    value=unicodedata.normalize('NFKC',value)
    value=re.sub(r'/f_([ifl])',r'f\1',value)
    return re.sub(r'\s+','',value)
for label in ['five','overflow']:
    info=json.loads(Path(f'.local/checks/grid-{label}.json').read_text(encoding='utf-8'))
    pdf=Path(info['outputDir'])/'personalized-covers.pdf'
    reader=PdfReader(pdf)
    assert len(reader.pages)==info['pages']
    text=normalize(''.join(page.extract_text() for page in reader.pages))
    for page in reader.pages:
        assert abs(float(page.mediabox.width)-612)<1
        assert abs(float(page.mediabox.height)-1008)<1
    for value in info['verified']['texts']:
        if value.strip():assert normalize(value) in text, f'Missing PDF text: {value}'
    binary=shutil.which('pdftoppm')
    assert binary,'Poppler pdftoppm is required for visual proof checks'
    target=f'.local/checks/grid-{label}-pdf'
    subprocess.run([binary,'-f',str(info['pages']),'-singlefile','-scale-to','1008','-png',str(pdf),target],check=True,capture_output=True)
    if info['pages']>1:
        first=target+'-first'
        subprocess.run([binary,'-f','1','-singlefile','-scale-to','1008','-png',str(pdf),first],check=True,capture_output=True)
        a=Image.open(first+'.png').convert('RGB');b=Image.open(target+'.png').convert('RGB');assert a.size==b.size
        width,height=a.size
        for region in [(0,0,width,140),(0,930,width,height)]:
            difference=ImageChops.difference(a.crop(region),b.crop(region));error=sum(ImageStat.Stat(difference).mean)/3
            assert error<3, f'Header/footer appearance differs on the overflow page: mean error {error}'
    print(json.dumps({'test':label,'pages':len(reader.pages),'text':'PASS','size':'612 x 1008 pt','render':target+'.png'}))
