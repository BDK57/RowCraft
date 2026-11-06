#target illustrator
(function(){
    var root=File($.fileName).parent,source=null,dest=null,oldInteraction=app.userInteractionLevel;
    function read(p){var f=File(p);f.encoding='UTF-8';if(!f.open('r'))throw Error('Cannot read job input');var s=f.read();f.close();return s;}
    function escape(s){return '"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/\t/g,'\\t').replace(/[\x00-\x1f]/g,function(c){return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);})+'"';}
    function json(v){if(v===null||v===undefined)return 'null';if(typeof v==='string')return escape(v);if(typeof v==='number'||typeof v==='boolean')return String(v);var a=[],k;if(v instanceof Array){for(k=0;k<v.length;k++)a.push(json(v[k]));return '['+a.join(',')+']';}for(k in v)if(v.hasOwnProperty(k))a.push(escape(k)+':'+json(v[k]));return '{'+a.join(',')+'}';}
    function write(p,value){var f=File(p);f.encoding='UTF-8';if(!f.open('w'))throw Error('Cannot write job output');f.write(json(value));f.close();}
    function parse(text){var at=0;function ws(){while(at<text.length&&/\s/.test(text.charAt(at)))at++;}function value(){ws();var c=text.charAt(at),out,key;if(c==='"'){at++;out='';while(at<text.length){c=text.charAt(at++);if(c==='"')return out;if(c==='\\'){c=text.charAt(at++);if(c==='u'){var h=text.substr(at,4);if(!/^[0-9a-fA-F]{4}$/.test(h))throw Error('Invalid JSON');out+=String.fromCharCode(parseInt(h,16));at+=4;}else{var e={'"':'"','\\':'\\','/':'/',b:'\b',f:'\f',n:'\n',r:'\r',t:'\t'};if(!e.hasOwnProperty(c))throw Error('Invalid JSON');out+=e[c];}}else out+=c;}throw Error('Invalid JSON');}if(c==='['||c==='{'){var arr=c==='[',end=arr?']':'}';out=arr?[]:{};at++;ws();if(text.charAt(at)===end){at++;return out;}while(at<text.length){if(arr)out.push(value());else{key=value();if(typeof key!=='string'||key==='__proto__')throw Error('Invalid JSON key');ws();if(text.charAt(at++)!==':')throw Error('Invalid JSON');out[key]=value();}ws();c=text.charAt(at++);if(c===end)return out;if(c!==',')throw Error('Invalid JSON');}}var rest=text.substr(at),m=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rest);if(m){at+=m[0].length;return Number(m[0]);}if(rest.substr(0,4)==='true'){at+=4;return true;}if(rest.substr(0,5)==='false'){at+=5;return false;}if(rest.substr(0,4)==='null'){at+=4;return null;}throw Error('Invalid JSON');}var result=value();ws();if(at!==text.length)throw Error('Invalid JSON');return result;}
    function progress(done,total,message){write(root.fsName+'/progress.json',{progress:Math.round(done/total*95),message:message});}
    function assets(folder,index){var list=Folder(folder).getFiles();for(var i=0;i<list.length;i++){var f=list[i];if(f.name==='__MACOSX')continue;if(f instanceof Folder)assets(f,index);else if(!/^\._/.test(f.name))index[decodeURI(f.name).toLowerCase()]=f;}}
    function relink(doc,folder){var index={},missing=[],seen={},i,item,name;assets(folder,index);for(i=0;i<doc.placedItems.length;i++){item=doc.placedItems[i];try{if(item.file.exists)continue;name=decodeURI(item.file.name).toLowerCase();}catch(e){name=String(item.name||'Unresolved linked image').toLowerCase();}if(index[name])item.relink(index[name]);else if(!seen[name]){missing.push(name);seen[name]=1;}}return missing;}
    function prepareAssets(folder){var index={},links=Folder(root.fsName+'/Links');links.create();assets(folder,index);for(var k in index)if(index.hasOwnProperty(k)&&/\.(jpg|jpeg|png|psd|tif|tiff|pdf|eps|svg)$/i.test(k)){index[k].copy(File(links.fsName+'/'+index[k].name));}}
    function inside(bounds,rect){var x=(bounds[0]+bounds[2])/2,y=(bounds[1]+bounds[3])/2;return x>=rect[0]&&x<=rect[2]&&y<=rect[1]&&y>=rect[3];}
    function png(doc,filename){var opts=new ExportOptionsPNG24();opts.artBoardClipping=true;opts.horizontalScale=100;opts.verticalScale=100;opts.transparency=false;app.redraw();doc.exportFile(File(filename),ExportType.PNG24,opts);if(!File(filename).exists){var capture=new ImageCaptureOptions();capture.resolution=144;capture.antiAliasing=true;capture.transparency=false;capture.matte=true;doc.imageCapture(File(filename),doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect,capture);}if(!File(filename).exists)throw Error('Illustrator did not write the artwork preview. Please retry the export.');}
    function color(value){var c=new RGBColor();c.red=value;c.green=value;c.blue=value;return c;}
    function cardGroups(doc,rect,w,h,targets){
        var cards=[],groups=[],i,j,p,b,found;
        for(i=0;i<targets.length;i++){
            p=doc.textFrames[targets[i].index].parent;
            while(p&&p.typename==='GroupItem'){
                b=p.geometricBounds;
                if(b[2]-b[0]>=w*.04&&b[2]-b[0]<=w*.4&&b[1]-b[3]>=h*.025&&b[1]-b[3]<=h*.32&&p.textFrames.length>=2){
                    found=-1;for(j=0;j<groups.length;j++)if(groups[j]===p)found=j;
                    if(found<0){found=groups.length;groups.push(p);var gi=-1;for(j=0;j<doc.groupItems.length;j++)if(doc.groupItems[j]===p){gi=j;break;}cards.push({id:'card-'+gi,groupIndex:gi,x:(b[0]-rect[0])/w,y:(rect[1]-b[1])/h,width:(b[2]-b[0])/w,height:(b[1]-b[3])/h,targetIds:[]});}
                    cards[found].targetIds.push(targets[i].id);targets[i].cardId=cards[found].id;break;
                }p=p.parent;
            }
        }
        var families=[];
        for(i=0;i<cards.length;i++){var c=cards[i],family=-1;for(j=0;j<families.length;j++){var f=families[j];if(Math.abs(c.width-f.width)*w<2&&Math.abs(c.height-f.height)*h<2&&c.targetIds.length===f.targetIds.length){family=j;break;}}if(family<0){family=families.length;families.push(c);}c.family='family-'+family;}
        // Repeated rows of cards are separate from the three static footer offers.
        var counts={},hasGrid=false,filtered=[];for(i=0;i<cards.length;i++){var familyKey=cards[i].family;counts[familyKey]=(counts[familyKey]||0)+1;if(counts[familyKey]>=4)hasGrid=true;}
        for(i=0;i<cards.length;i++)if(!hasGrid||counts[cards[i].family]>=4)filtered.push(cards[i]);
        return filtered;
    }
    function inspect(request){
        source=app.open(File(request.source));var missing=relink(source,request.assetsRoot),boards=[],fonts={},i,j;
        for(i=0;i<source.artboards.length;i++){
            var rect=source.artboards[i].artboardRect,w=rect[2]-rect[0],h=rect[1]-rect[3],targets=[];
            for(j=0;j<source.textFrames.length;j++){
                var tf=source.textFrames[j],b=tf.geometricBounds;if(!inside(b,rect))continue;
                var font='',size=12;try{font=tf.textRange.characterAttributes.textFont.name;size=tf.textRange.characterAttributes.size;fonts[font]=1;}catch(e){}
                targets.push({id:'text-'+j,index:j,name:tf.name||'',text:tf.contents,x:(b[0]-rect[0])/w,y:(rect[1]-b[1])/h,width:Math.max(0.008,(b[2]-b[0])/w),height:Math.max(0.008,(b[1]-b[3])/h),font:font,fontSize:size});
            }
            source.artboards.setActiveArtboardIndex(i);png(source,request.outputDir+'/artboard-'+i+'.png');
            boards.push({name:source.artboards[i].name,width:w,height:h,targets:targets,cards:cardGroups(source,rect,w,h,targets)});progress(i+1,source.artboards.length,'Rendering cover '+(i+1)+' of '+source.artboards.length);
        }
        var fontNames=[];for(var k in fonts)if(fonts.hasOwnProperty(k))fontNames.push(k);
        var warnings=[];if(missing.length)warnings.push('Missing linked assets: '+missing.join(', ')+'. Import a ZIP containing the template and its Links folder before exporting.');
        return {artboards:boards,fonts:fontNames,missingLinks:missing,warnings:warnings};
    }
    function unlock(layer){layer.locked=false;for(var i=0;i<layer.layers.length;i++)unlock(layer.layers[i]);}
    function cloneCover(doc,index){
        doc.activate();
        var rect=doc.artboards[index].artboardRect,w=rect[2]-rect[0],h=rect[1]-rect[3],i,j,p;
        for(i=0;i<doc.layers.length;i++)unlock(doc.layers[i]);
        for(i=0;i<doc.pageItems.length;i++)try{doc.pageItems[i].locked=false;}catch(ignore){}
        doc.activate();doc.selection=null;doc.artboards.setActiveArtboardIndex(index);doc.selectObjectsOnActiveArtboard();
        var sel=doc.selection,items=[];
        for(i=0;i<sel.length;i++){p=sel[i].parent;var nested=false;while(p&&p.typename!=='Layer'&&p.typename!=='Document'){for(j=0;j<sel.length;j++)if(sel[j]===p)nested=true;p=p.parent;}if(!nested)items.push(sel[i]);}
        if(!items.length)throw Error('The selected cover contains no visible selectable artwork.');
        dest=app.documents.add(doc.documentColorSpace,w,h);
        for(i=items.length-1;i>=0;i--){var before=items[i].geometricBounds,copy=items[i].duplicate(dest.layers[0],ElementPlacement.PLACEATBEGINNING),after=copy.geometricBounds;copy.translate(before[0]-rect[0]-after[0],before[1]-rect[1]+h-after[1]);}
        return dest;
    }
    function findGroup(doc,name){for(var i=0;i<doc.groupItems.length;i++)if(doc.groupItems[i].name===name)return doc.groupItems[i];return null;}
    function findText(group,name){for(var i=0;i<group.pageItems.length;i++){var p=group.pageItems[i];if(p.typename==='TextFrame'&&p.name===name)return p;if(p.typename==='GroupItem'){var t=findText(p,name);if(t)return t;}}return null;}
    function paint(c){if(c.typename==='NoColor')return ['None'];if(c.typename==='RGBColor')return ['RGB',c.red,c.green,c.blue];if(c.typename==='CMYKColor')return ['CMYK',c.cyan,c.magenta,c.yellow,c.black];if(c.typename==='GrayColor')return ['Gray',c.gray];if(c.typename==='SpotColor')return ['Spot',c.spot.name,c.tint];return [c.typename];}
    function textStyle(tf){var a=tf.characters.length?tf.characters[0].characterAttributes:tf.textRange.characterAttributes;return {font:a.textFont.name,size:a.size,horizontalScale:a.horizontalScale,verticalScale:a.verticalScale,tracking:a.tracking,fill:paint(a.fillColor),stroke:paint(a.strokeColor),strokeWeight:a.strokeWeight};}
    function replaceText(tf,value){
        var attrs=tf.characters.length?tf.characters[0].characterAttributes:tf.textRange.characterAttributes,saved={},keys=['textFont','size','tracking','leading','autoLeading','horizontalScale','verticalScale','baselineShift','fillColor','strokeColor','strokeWeight','overprintFill','overprintStroke','rotation','capitalization','ligature','kerningMethod'],i;
        for(i=0;i<keys.length;i++)try{saved[keys[i]]=attrs[keys[i]];}catch(ignoreRead){}
        var alignment=tf.textRange.paragraphAttributes.justification;tf.contents=String(value===undefined?'':value);
        for(i=0;i<keys.length;i++)if(saved[keys[i]]!==undefined)try{tf.textRange.characterAttributes[keys[i]]=saved[keys[i]];}catch(ignoreWrite){}
        // Setting stroke weight can activate a default stroke. Restore paints last.
        if(saved.fillColor!==undefined)tf.textRange.characterAttributes.fillColor=saved.fillColor;
        if(saved.strokeColor!==undefined)tf.textRange.characterAttributes.strokeColor=saved.strokeColor;
        tf.textRange.paragraphAttributes.justification=alignment;
    }
    function rootItems(doc,exclude){var out=[];for(var i=0;i<doc.pageItems.length;i++){var p=doc.pageItems[i];if(p.parent.typename==='Layer'&&p.name!=='__CS_SPECIMEN')out.push(p);}return out;}
    function generate(request){
        if(!request.grid)throw Error('Choose a sample card and analyze the grid before generating.');
        var plan=request.grid,w=request.metadata.artboards[request.artboard].width,h=request.metadata.artboards[request.artboard].height,warnings=[],i,j,k;
        source=app.open(File(request.source));var missing=relink(source,request.assetsRoot);
        if(missing.length)throw Error('Missing linked assets: '+missing.join(', '));
        var sourceRect=source.artboards[request.artboard].artboardRect;
        var pageMappings=request.pageMappings||[],first=request.records[0];
        for(i=0;i<pageMappings.length;i++){
            var pm=pageMappings[i],pageText;
            if(pm.kind==='text')pageText=source.textFrames[pm.index];
            else{pageText=source.textFrames.pointText([sourceRect[0]+pm.x*w,sourceRect[1]-pm.y*h]);pageText.textRange.characterAttributes.size=pm.fontSize;pageText.textRange.characterAttributes.fillColor=color(30);if(pm.font)pageText.textRange.characterAttributes.textFont=app.textFonts.getByName(pm.font);}
            var pb=pageText.geometricBounds,pw=pm.kind==='position'?pm.width*w:Math.max(8,pb[2]-pb[0]);replaceText(pageText,first.values[pm.column]);var pa=pageText.geometricBounds;
            if(pageText.kind===TextType.POINTTEXT&&pa[2]-pa[0]>pw){if(request.textFit==='condense'){pageText.textRange.characterAttributes.horizontalScale*=pw/(pa[2]-pa[0]);warnings.push('Page field '+(pm.label||'added text')+' was condensed to fit.');}else warnings.push('Page field '+(pm.label||'added text')+' exceeds its width; original typography was preserved.');}
        }
        var clearCards=plan.clearCards||plan.slots;
        for(i=0;i<clearCards.length;i++){
            var slot=clearCards[i],group=source.groupItems[slot.groupIndex];
            if(!group)throw Error('The card structure changed. Analyze the template again.');
            var gb=group.geometricBounds;
            if(Math.abs(gb[0]-(sourceRect[0]+slot.x*w))>1||Math.abs(gb[1]-(sourceRect[1]-slot.y*h))>1)throw Error('The card structure changed. Analyze the template again.');
            group.name='__CS_SLOT_'+slot.id;
        }
        for(i=0;i<request.mappings.length;i++)source.textFrames[request.mappings[i].index].name='__CS_FIELD_'+i;
        var cover=cloneCover(source,request.artboard),sample=findGroup(cover,'__CS_SLOT_'+plan.cardId);
        if(!sample)throw Error('The selected sample card could not be copied.');
        var specimen=sample.duplicate(cover.layers[0],ElementPlacement.PLACEATBEGINNING);specimen.name='__CS_SPECIMEN';
        for(i=0;i<clearCards.length;i++){group=findGroup(cover,'__CS_SLOT_'+clearCards[i].id);if(group)group.remove();else throw Error('An original grid card could not be removed.');}
        // Embed once before repeating artwork. No hidden sample card is saved.
        for(i=cover.placedItems.length-1;i>=0;i--)cover.placedItems[i].embed();
        var background=rootItems(cover,specimen),originalRect=cover.artboards[0].artboardRect,previews=[],assignments=[];
        var sx=plan.shiftX||0,sy=plan.shiftY||0;
        if(sx||sy){originalRect=[originalRect[0]+sx,originalRect[1]+sy,originalRect[2]+sx,originalRect[3]+sy];cover.artboards[0].artboardRect=originalRect;for(i=0;i<background.length;i++)background[i].translate(sx,sy);specimen.translate(sx,sy);}
        for(i=0;i<plan.pages;i++){
            var dx=(i%plan.across)*(w+40),dy=-Math.floor(i/plan.across)*(h+40);
            if(i>0){cover.artboards.add([originalRect[0]+dx,originalRect[1]+dy,originalRect[2]+dx,originalRect[3]+dy]);for(j=background.length-1;j>=0;j--)background[j].duplicate(cover.layers[0],ElementPlacement.PLACEATBEGINNING).translate(dx,dy);}
            cover.artboards[i].name=request.metadata.artboards[request.artboard].name+' - '+(i+1);
            for(j=0;j<plan.capacity;j++){
                var index=i*plan.capacity+j;if(index>=request.records.length)break;
                var record=request.records[index],position=plan.slots[j],card=specimen.duplicate(cover.layers[0],ElementPlacement.PLACEATBEGINNING);card.name='Record '+record.record;
                card.translate((position.x-plan.sample.x)*w+dx,(plan.sample.y-position.y)*h+dy);
                for(k=0;k<request.mappings.length;k++){
                    var m=request.mappings[k],tf=findText(card,'__CS_FIELD_'+k);if(!tf)throw Error('A mapped field is outside the sample card.');
                    var before=tf.geometricBounds,cardBounds=card.geometricBounds,padding=Math.max(3,w*plan.sample.width*.05),maxWidth=Math.max(8,cardBounds[2]-before[0]-padding);
                    try{if(tf.textRange.paragraphAttributes.justification===Justification.RIGHT)maxWidth=Math.max(8,before[2]-cardBounds[0]-padding);}catch(ignoreAlign){}
                    replaceText(tf,record.values[m.column]);
                    var after=tf.geometricBounds;if(tf.kind===TextType.POINTTEXT&&after[2]-after[0]>maxWidth){if(request.textFit==='condense'){tf.textRange.characterAttributes.horizontalScale*=maxWidth/(after[2]-after[0]);warnings.push('Record '+record.record+': '+m.label+' was condensed to fit.');}else warnings.push('Record '+record.record+': '+m.label+' exceeds the available width; original font, size, weight and scale were preserved.');}
                    if(tf.kind===TextType.AREATEXT)warnings.push('Record '+record.record+': check area-text overflow for '+m.label+'.');
                }
                assignments.push({record:record.record,excelRow:record.excelRow,page:i+1,slot:j+1});
            }
            progress(i+1,plan.pages,'Filled page '+(i+1)+' of '+plan.pages+' with selected cards');
        }
        specimen.remove();
        for(i=0;i<Math.min(plan.pages,5);i++){cover.artboards.setActiveArtboardIndex(i);var name='page-'+('0000'+(i+1)).slice(-4);png(cover,request.outputDir+'/'+name+'.png');previews.push(name);}
        var stem=request.outputDir+'/personalized-covers',ai=new IllustratorSaveOptions();ai.pdfCompatible=true;ai.embedICCProfile=true;cover.saveAs(File(stem+'.ai'),ai);
        if(request.includePdf){var pdf=new PDFSaveOptions();pdf.preserveEditability=false;pdf.artboardRange='1'+(plan.pages>1?'-'+plan.pages:'');cover.saveAs(File(stem+'.pdf'),pdf);}
        cover.close(SaveOptions.DONOTSAVECHANGES);dest=null;source.close(SaveOptions.DONOTSAVECHANGES);source=null;
        return {count:request.records.length,pages:plan.pages,previews:previews,assignments:assignments,warnings:warnings};
    }
    function copyAt(item,document,dx,dy){
        var before=item.geometricBounds,copy=item.duplicate(document.layers[0],ElementPlacement.PLACEATBEGINNING),after=copy.geometricBounds;
        copy.translate(before[0]+dx-after[0],before[1]+dy-after[1]);return copy;
    }
    function sourceDocument(filename){
        for(var i=0;i<app.documents.length;i++)try{if(app.documents[i].fullName.fsName===filename)return app.documents[i];}catch(ignoreUnsavedDocument){}
        throw Error('The isolated source document is no longer open.');
    }
    function generateSections(request){
        var plan=request.sectionPlan,warnings=[],previews=[],assignments=[],i,j,k,n,cover=null,combined=null;
        source=app.open(File(request.source));var sourceName=source.name,combinedName=null,missing=relink(source,request.assetsRoot);if(missing.length)throw Error('Missing linked assets: '+missing.join(', '));
        // Tag every native object before cloning; indices always refer to the original source.
        for(i=0;i<plan.sections.length;i++){
            var section=plan.sections[i],board=request.metadata.artboards[section.artboard],rect=source.artboards[section.artboard].artboardRect;
            for(j=0;j<section.slots.length;j++){
                var slot=section.slots[j],group=source.groupItems[slot.groupIndex];if(!group)throw Error(section.name+': analyze the template again.');
                var gb=group.geometricBounds;
                if(Math.abs(gb[0]-(rect[0]+slot.x*board.width))>1||Math.abs(gb[1]-(rect[1]-slot.y*board.height))>1)throw Error(section.name+': the native card structure changed. Analyze again.');
                group.name='__CS_SECTION_'+i+'_SLOT_'+slot.id;
            }
            for(j=0;j<section.mappings.length;j++)source.textFrames[section.mappings[j].index].name='__CS_FIELD_'+j;
        }
        // Section headings/months are independent and constant on every continuation page.
        for(i=0;i<plan.sections.length;i++)for(j=0;j<plan.sections[i].labels.length;j++){
            var label=plan.sections[i].labels[j],labelText=source.textFrames[label.index],bounds=labelText.geometricBounds,maxLabelWidth=Math.max(8,bounds[2]-bounds[0]);
            replaceText(labelText,label.value);var labelAfter=labelText.geometricBounds;
            if(labelText.kind===TextType.POINTTEXT&&labelAfter[2]-labelAfter[0]>maxLabelWidth){if(request.textFit==='condense'){labelText.textRange.characterAttributes.horizontalScale*=maxLabelWidth/(labelAfter[2]-labelAfter[0]);warnings.push(plan.sections[i].name+': '+label.role+' was condensed to fit.');}else warnings.push(plan.sections[i].name+': '+label.role+' exceeds its original width; typography was preserved.');}
        }
        try{
            for(var b=0;b<plan.boards.length;b++){
                // Illustrator can invalidate a document specifier after another document closes.
                source=sourceDocument(request.source);source.activate();
                var boardPlan=plan.boards[b],w=boardPlan.width,h=boardPlan.height,specimens=[],own=[];
                cover=cloneCover(source,boardPlan.artboard);
                for(i=0;i<plan.sections.length;i++)if(plan.sections[i].artboard===boardPlan.artboard){
                    section=plan.sections[i];var sample=findGroup(cover,'__CS_SECTION_'+i+'_SLOT_'+section.sample.id);if(!sample)throw Error(section.name+': sample card could not be copied.');
                    var specimen=sample.duplicate(cover.layers[0],ElementPlacement.PLACEATBEGINNING);specimen.name='__CS_SPECIMEN';specimens.push(specimen);own.push(section);
                    for(j=0;j<section.slots.length;j++){group=findGroup(cover,'__CS_SECTION_'+i+'_SLOT_'+section.slots[j].id);if(!group)throw Error(section.name+': original card could not be removed.');group.remove();}
                }
                for(i=cover.placedItems.length-1;i>=0;i--)cover.placedItems[i].embed();
                var background=rootItems(cover);
                if(!combined){combined=app.documents.add(source.documentColorSpace,w,h);combinedName=combined.name;dest=combined;}
                else combined=app.documents.getByName(combinedName);
                for(n=0;n<plan.pages.length;n++){
                    var page=plan.pages[n];if(page.artboard!==boardPlan.artboard)continue;
                    combined.activate();
                    var outRect=[page.x,page.y,page.x+w,page.y-h];if(n===0)combined.artboards[0].artboardRect=outRect;else combined.artboards.add(outRect);
                    combined.artboards[n].name=request.metadata.artboards[page.artboard].name+' - '+(page.boardPage+1);
                    var dx=page.x,dy=page.y-h;
                    for(i=background.length-1;i>=0;i--)copyAt(background[i],combined,dx,dy);
                    for(i=0;i<own.length;i++){
                        section=own[i];
                        for(j=0;j<section.capacity;j++){
                            var recordIndex=page.boardPage*section.capacity+j;if(recordIndex>=section.records.length)break;
                            var record=section.records[recordIndex],position=section.slots[j],card=copyAt(specimens[i],combined,dx+(position.x-section.sample.x)*w,dy+(section.sample.y-position.y)*h);
                            card.name='Record '+record.record+' | Section '+section.id;
                            for(k=0;k<section.mappings.length;k++){
                                var m=section.mappings[k],tf=findText(card,'__CS_FIELD_'+k);if(!tf)throw Error(section.name+': mapped text is outside its sample card.');
                                var before=tf.geometricBounds,cardBounds=card.geometricBounds,padding=Math.max(3,w*section.sample.width*.05),maxWidth=Math.max(8,cardBounds[2]-before[0]-padding);
                                try{if(tf.textRange.paragraphAttributes.justification===Justification.RIGHT)maxWidth=Math.max(8,before[2]-cardBounds[0]-padding);}catch(ignoreSectionAlign){}
                                replaceText(tf,record.values[m.column]);var after=tf.geometricBounds;
                                if(tf.kind===TextType.POINTTEXT&&after[2]-after[0]>maxWidth){if(request.textFit==='condense'){tf.textRange.characterAttributes.horizontalScale*=maxWidth/(after[2]-after[0]);warnings.push(section.name+', record '+record.record+': '+m.label+' was condensed to fit.');}else warnings.push(section.name+', record '+record.record+': '+m.label+' exceeds the available width; original typography was preserved.');}
                                if(tf.kind===TextType.AREATEXT)warnings.push(section.name+', record '+record.record+': check area-text overflow for '+m.label+'.');
                            }
                            assignments.push({sectionId:section.id,record:record.record,excelRow:record.excelRow,page:n+1,slot:j+1});
                        }
                    }
                    progress(n+1,plan.pageCount,'Filled section page '+(n+1)+' of '+plan.pageCount);
                }
                cover.activate();cover.close(SaveOptions.DONOTSAVECHANGES);cover=null;combined=app.documents.getByName(combinedName);combined.activate();dest=combined;
            }
            for(i=0;i<Math.min(plan.pageCount,5);i++){combined.artboards.setActiveArtboardIndex(i);var previewName='page-'+('0000'+(i+1)).slice(-4);png(combined,request.outputDir+'/'+previewName+'.png');previews.push(previewName);}
            var stem=request.outputDir+'/personalized-covers',ai=new IllustratorSaveOptions();ai.pdfCompatible=true;ai.embedICCProfile=true;combined.saveAs(File(stem+'.ai'),ai);
            if(request.includePdf){var pdf=new PDFSaveOptions();pdf.preserveEditability=false;pdf.artboardRange='1'+(plan.pageCount>1?'-'+plan.pageCount:'');combined.saveAs(File(stem+'.pdf'),pdf);}
            combined.activate();combined.close(SaveOptions.DONOTSAVECHANGES);combined=null;dest=null;source=sourceDocument(request.source);source.activate();source.close(SaveOptions.DONOTSAVECHANGES);source=null;
            return {count:plan.count,pages:plan.pageCount,previews:previews,assignments:assignments,warnings:warnings};
        }finally{if(cover)try{cover.close(SaveOptions.DONOTSAVECHANGES);}catch(ignoreSectionClose){}if(combined)dest=combined;}
    }
    function verify(request){source=app.open(File(request.source));var texts=[],records=[],cardData=[],templateStyles=[];for(var i=0;i<source.textFrames.length;i++)texts.push(source.textFrames[i].contents);for(i=0;i<(request.mappings||[]).length;i++)templateStyles.push(textStyle(source.textFrames[request.mappings[i].index]));for(i=0;i<source.groupItems.length;i++)if(/^Record \d+( \| Section .+)?$/.test(source.groupItems[i].name)){var g=source.groupItems[i],fields=[],styles=[];for(var j=0;j<100;j++){var tf=findText(g,'__CS_FIELD_'+j);if(!tf)break;fields.push(tf.contents);styles.push(textStyle(tf));}records.push(g.name);cardData.push({name:g.name,fields:fields,styles:styles});}return {pages:source.artboards.length,records:records,cardData:cardData,templateStyles:templateStyles,texts:texts,linkedImages:source.placedItems.length};}
    try{
        var request=parse(read(root.fsName+'/request.json'));app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
        // Work on a new path so an existing, unsaved Illustrator document is never reused or closed.
        var isolated=File(root.fsName+'/source.ai');if(!File(request.source).copy(isolated))throw Error('Cannot create an isolated working copy of the template.');request.source=isolated.fsName;
        prepareAssets(request.assetsRoot);
        var result;
        if(request.operation==='inspect')result=inspect(request);
        else if(request.operation==='verify')result=verify(request);
        else if(request.operation==='generate')result=generate(request);
        else if(request.operation==='generate-sections')result=generateSections(request);
        else throw Error('Unknown Illustrator operation: '+request.operation);
        write(root.fsName+'/response.json',result);
    }catch(e){try{write(root.fsName+'/response.json',{error:e.message+' (Illustrator script line '+e.line+')'});}catch(ignored){}}
    finally{if(dest)try{dest.close(SaveOptions.DONOTSAVECHANGES);}catch(ignore1){}if(source)try{source.close(SaveOptions.DONOTSAVECHANGES);}catch(ignore2){}app.userInteractionLevel=oldInteraction;}
})();
