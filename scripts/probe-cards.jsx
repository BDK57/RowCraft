#target illustrator
(function(){
 var folder=File($.fileName).parent.parent,base=Folder(folder.fsName+'/.local/checks/card-probe');base.create();
 var original=File(folder.parent.fsName+'/illustrations/Stop & Shop Trade Letter/Stop & Shop Trade Letter.ai');
 original.copy(File(base.fsName+'/source.ai'));
 var links=Folder(base.fsName+'/Links');links.create();var files=Folder(original.parent.fsName+'/Links').getFiles();for(var i=0;i<files.length;i++)if(files[i] instanceof File)files[i].copy(File(links.fsName+'/'+files[i].name));
 var old=app.userInteractionLevel,doc=null,out=[];
 function quote(s){return '"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/[\r\n]/g,' ')+'"';}
 try{app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;doc=app.open(File(base.fsName+'/source.ai'));
  for(i=0;i<doc.textFrames.length;i++)if(doc.textFrames[i].contents==='Usama Mobile'){
   var p=doc.textFrames[i],chain=[];
   while(p&&p.typename!=='Document'){var b=[];try{b=p.geometricBounds||[];}catch(e){}chain.push('{"type":'+quote(p.typename)+',"name":'+quote(p.name)+',"bounds":['+b.join(',')+'],"items":'+(p.pageItems?p.pageItems.length:0)+'}');p=p.parent;}
   out.push('['+chain.join(',')+']');if(out.length===3)break;
  }
  var f=File(base.fsName+'/probe.json');f.open('w');f.write('['+out.join(',')+']');f.close();
 }catch(e){var err=File(base.fsName+'/probe-error.txt');err.open('w');err.write(e.message+' line '+e.line+' version '+app.version+' documents '+app.documents.length);err.close();}finally{if(doc)try{doc.close(SaveOptions.DONOTSAVECHANGES);}catch(ignore){}app.userInteractionLevel=old;}
})();
