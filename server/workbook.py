"""Generic, read-only XLSX extraction using the Python standard library."""
import csv
import datetime as dt
import io
import json
from pathlib import Path
import posixpath
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
DATE_IDS = set(range(14,23)) | set(range(27,37)) | set(range(45,48)) | set(range(50,59))

def column_index(ref):
    value=0
    for c in re.sub(r'[^A-Z]','',ref): value=value*26+ord(c)-64
    return value-1

def read_book(path):
    if Path(path).suffix.lower()=='.csv':
        raw=list(csv.reader(Path(path).read_text(encoding='utf-8-sig').splitlines()))
        return {'sheets':[normalize('Sheet1',[(i+1,r) for i,r in enumerate(raw)])]}
    with zipfile.ZipFile(path) as z:
        if sum(i.file_size for i in z.infolist())>256*1024*1024: raise ValueError('Workbook expands beyond the 256 MB limit')
        strings=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            strings=[''.join(t.text or '' for t in si.findall('.//s:t',NS)) for si in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        wb=ET.fromstring(z.read('xl/workbook.xml'))
        props=wb.find('s:workbookPr',NS)
        date1904=props is not None and props.attrib.get('date1904') in ('1','true')
        rels={x.attrib['Id']:x.attrib['Target'] for x in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        formats={};styles=[]
        if 'xl/styles.xml' in z.namelist():
            st=ET.fromstring(z.read('xl/styles.xml'))
            formats={int(x.attrib['numFmtId']):x.attrib['formatCode'] for x in st.findall('s:numFmts/s:numFmt',NS)}
            styles=[int(x.attrib.get('numFmtId',0)) for x in st.findall('s:cellXfs/s:xf',NS)]
        sheets=[]
        for sheet in wb.find('s:sheets',NS):
            target=rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
            part=target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target)
            rows=[]
            for row in ET.fromstring(z.read(part)).findall('s:sheetData/s:row',NS):
                vals={}
                for cell in row:
                    val=cell.findtext('s:v',default='',namespaces=NS);kind=cell.attrib.get('t');fmt=styles[int(cell.attrib.get('s',0))] if styles else 0
                    if kind=='s' and val: val=strings[int(val)]
                    elif kind=='inlineStr': val=''.join(t.text or '' for t in cell.findall('.//s:t',NS))
                    elif kind=='b': val='TRUE' if val=='1' else 'FALSE'
                    elif kind=='e': raise ValueError(f'{sheet.attrib["name"]}!{cell.attrib["r"]}: Excel error {val}')
                    elif val and kind not in ('str','d'):
                        number=float(val);code=formats.get(fmt,'');clean=re.sub(r'"[^"]*"|\\.|\[[^\]]*\]','',code).lower()
                        if fmt in DATE_IDS or re.search(r'[yd]|h+:m|m+:s',clean):
                            base=dt.datetime(1904,1,1) if date1904 else dt.datetime(1899,12,30)
                            date=base+dt.timedelta(days=number)
                            val=date.strftime('%Y-%m-%d') if date.time()==dt.time() else date.strftime('%Y-%m-%d %H:%M')
                        elif re.fullmatch(r'0+',code) and number.is_integer(): val=str(int(number)).zfill(len(code))
                        elif '%' in clean: val=f'{number*100:.2f}'.rstrip('0').rstrip('.')+'%'
                        elif number.is_integer(): val=str(int(number))
                        else: val=format(number,'.15g')
                    if cell.find('s:f',NS) is not None and val=='': raise ValueError(f'{sheet.attrib["name"]}!{cell.attrib["r"]}: recalculate and save this formula in Excel first')
                    vals[column_index(cell.attrib['r'])]=str(val)
                if any(v.strip() for v in vals.values()):
                    width=max(vals.keys(),default=-1)+1
                    rows.append((int(row.attrib['r']),[vals.get(i,'') for i in range(width)]))
            if rows: sheets.append(normalize(sheet.attrib['name'],rows))
        if not sheets: raise ValueError('Workbook contains no data')
        return {'sheets':sheets}

def normalize(name,rows):
    if not rows: return {'name':name,'columns':[],'rows':[],'skippedHeaders':[]}
    header_row,header=rows[0];width=max(len(r) for _,r in rows);header=header+['']*(width-len(header))
    used={};columns=[]
    for i,label in enumerate(header):
        base=label.strip() or f'Column {i+1}';used[base]=used.get(base,0)+1
        columns.append(base if used[base]==1 else f'{base} ({used[base]})')
    accepted=[];skipped=[]
    for excel_row,values in rows[1:]:
        values=values+['']*(width-len(values))
        if [v.strip() for v in values]==[v.strip() for v in header]: skipped.append(excel_row);continue
        accepted.append({'id':f'{name}:{excel_row}','excelRow':excel_row,'record':len(accepted)+1,'values':values})
    return {'name':name,'headerRow':header_row,'columns':columns,'rows':accepted,'skippedHeaders':skipped}

if __name__=='__main__':
    try: print(json.dumps(read_book(sys.argv[1]),ensure_ascii=True))
    except Exception as e: print(str(e),file=sys.stderr);sys.exit(1)
