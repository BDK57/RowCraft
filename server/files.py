"""Safe template-package extraction and output packaging."""
import json
from pathlib import Path
import sys
import zipfile

def unpack(source,destination):
    dest=Path(destination).resolve();dest.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(source) as z:
        if sum(i.file_size for i in z.infolist())>512*1024*1024: raise ValueError('Package expands beyond 512 MB')
        for item in z.infolist():
            name=item.filename.replace('\\','/')
            target=(dest/name).resolve()
            if not target.is_relative_to(dest) or name.startswith('/') or ':' in name: raise ValueError('Unsafe path in template package')
            if item.is_dir(): target.mkdir(parents=True,exist_ok=True);continue
            if '__MACOSX' in Path(name).parts or Path(name).name.startswith('._'): continue
            target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(item))
    ai=list(dest.rglob('*.ai'))
    if len(ai)!=1: raise ValueError('Package must contain exactly one AI template')
    return {'template':str(ai[0]),'assetsRoot':str(dest)}

def package(folder,archive):
    root=Path(folder)
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for p in sorted(root.rglob('*')):
            if p.is_file(): z.write(p,p.relative_to(root))
    return {'archive':archive}

def combine(folder,target):
    from pypdf import PdfReader,PdfWriter
    w=PdfWriter();paths=sorted(Path(folder).glob('*.pdf'))
    for p in paths:
        for page in PdfReader(p).pages: w.add_page(page)
    with open(target,'wb') as f:w.write(f)
    return {'pages':len(w.pages),'files':len(paths)}

if __name__=='__main__':
    try:
        result={'unpack':unpack,'package':package,'combine':combine}[sys.argv[1]](*sys.argv[2:])
        print(json.dumps(result))
    except Exception as e:print(str(e),file=sys.stderr);sys.exit(1)
