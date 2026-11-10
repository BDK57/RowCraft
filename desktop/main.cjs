const {app,BrowserWindow,Menu,dialog,shell,utilityProcess}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {connectIllustrator,ADOBE_SETUP}=require('./illustrator.cjs');
const {isLocalNavigation,isAdobeLink,isExportDownload,downloadName}=require('./policy.cjs');

const smoke=process.argv.includes('--rowcraft-smoke');
if(smoke&&process.env.ROWCRAFT_SMOKE_DATA_DIR)app.setPath('userData',path.resolve(process.env.ROWCRAFT_SMOKE_DATA_DIR));
app.setName('RowCraft');app.setAppUserModelId('com.rowcraft.desktop');
let window,worker,origin,quitting=false,waitForJobs=false,closePending=false,closeDialog=false;
const haveLock=app.requestSingleInstanceLock();
if(!haveLock){app.quit();}else{
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
 app.whenReady().then(start).catch(fatal);
 app.on('before-quit',event=>{
  if(!quitting&&window){event.preventDefault();window.close();}
 });
 app.on('window-all-closed',()=>{if(quitting)app.quit();});
}
function log(message){
 fs.mkdirSync(app.getPath('userData'),{recursive:true});
 fs.appendFileSync(path.join(app.getPath('userData'),'desktop.log'),`${new Date().toISOString()} ${message}\n`);
}
async function fatal(error){
 log(error.stack||String(error));
 if(smoke){fs.writeFileSync(path.join(app.getPath('userData'),'smoke-result.json'),JSON.stringify({ok:false,error:error.message}));}
 else dialog.showErrorBox('RowCraft could not start',`${error.message}\n\nLog: ${path.join(app.getPath('userData'),'desktop.log')}`);
 quitting=true;if(worker)worker.kill();app.exit(1);
}
async function start(){
 let connection;
 while(!connection){
  try{connection=await connectIllustrator();}
  catch(error){
   if(smoke)throw error;
   const result=await dialog.showMessageBox({type:'warning',title:'Connect Adobe Illustrator',message:'RowCraft needs a working Adobe Illustrator installation.',detail:error.message+'\n\nOpen Illustrator and complete Adobe sign-in or activation, then retry. Your files have not been changed.',buttons:['Retry','Open Adobe setup','Exit'],defaultId:0,cancelId:2});
   if(result.response===2){quitting=true;app.quit();return;}
   if(result.response===1)await shell.openExternal(ADOBE_SETUP);
  }
 }
 log(`Starting ${app.getVersion()}; Electron ${process.versions.electron}; Node ${process.versions.node}; Illustrator ${connection.version}`);
 await startBackend();
 window=new BrowserWindow({width:1440,height:960,minWidth:900,minHeight:650,show:false,title:'RowCraft',backgroundColor:'#f5f6fb',icon:path.join(__dirname,'assets','icon.png'),webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,spellcheck:false}});
 const contents=window.webContents;
 contents.session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
 contents.session.setPermissionCheckHandler(()=>false);
 // Block unexpected remote requests; all app code, fonts, previews and APIs ship locally.
 contents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!isLocalNavigation(details.url,origin)&&!details.url.startsWith('data:')&&!details.url.startsWith('blob:')}));
 contents.setWindowOpenHandler(({url})=>{if(isAdobeLink(url))void shell.openExternal(url);return {action:'deny'};});
 contents.on('will-navigate',(event,url)=>{if(!isLocalNavigation(url,origin))event.preventDefault();});
 contents.on('will-attach-webview',event=>event.preventDefault());
 contents.session.on('will-download',(event,item)=>{
  if(!isExportDownload(item.getURL(),origin)){event.preventDefault();return;}
  item.setSaveDialogOptions({title:'Save RowCraft artwork',defaultPath:path.join(app.getPath('downloads'),downloadName(item.getFilename()))});
  item.once('done',(_event,state)=>{if(state!=='completed'&&state!=='cancelled')void dialog.showMessageBox(window,{type:'error',message:'The file could not be saved.',detail:'Try the download again or choose another folder.'});});
 });
 contents.on('render-process-gone',(_event,details)=>{if(!quitting)void fatal(Error(`The interface stopped (${details.reason}). Restart RowCraft; completed artwork is still saved.`));});
 window.on('close',event=>{
  if(quitting)return;
  event.preventDefault();
  requestClose();
 });
 const fileMenu={label:'File',submenu:[{label:'Open saved artwork folder',click:()=>void shell.openPath(path.join(app.getPath('userData'),'data','jobs'))},{label:'Open Downloads',click:()=>void shell.openPath(app.getPath('downloads'))},{type:'separator'},{label:'Exit',accelerator:'Alt+F4',click:()=>window.close()}]};
 Menu.setApplicationMenu(Menu.buildFromTemplate([fileMenu,{label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'View',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'},...(!app.isPackaged?[{role:'toggleDevTools'}]:[])]},{label:'Help',submenu:[{label:'About RowCraft',click:()=>void dialog.showMessageBox(window,{title:'RowCraft',message:`RowCraft ${app.getVersion()}`,detail:`Illustrator ${connection.version}\nNode.js ${process.versions.node} (included)\n\nFiles stay on this computer.\nData: ${app.getPath('userData')}`})}]}]));
 await window.loadURL(origin);
 if(smoke){await require('./smoke.cjs').run({app,window,origin,connection});shutdown();}
 else{window.show();window.focus();}
}
async function startBackend(){
 await new Promise((resolve,reject)=>{
  worker=utilityProcess.fork(path.join(__dirname,'backend.mjs'),[],{cwd:app.getPath('userData'),env:{...process.env,ROWCRAFT_DATA_DIR:path.join(app.getPath('userData'),'data'),ROWCRAFT_NATIVE_AVAILABLE:'1'},stdio:'pipe',serviceName:'RowCraft artwork worker'});
  const timer=setTimeout(()=>{reject(Error('The local artwork worker did not start within 30 seconds.'));},30000);
  worker.stdout?.on('data',data=>log(String(data).trim()));worker.stderr?.on('data',data=>log(String(data).trim()));
  worker.on('message',message=>{
   if(message.type==='ready'){origin=message.url;clearTimeout(timer);resolve();}
   if(message.type==='activity'&&!message.count&&waitForJobs&&!closeDialog)requestClose();
   if(message.type==='close-status')void handleCloseStatus(message.count);
  });
  worker.once('exit',code=>{clearTimeout(timer);if(!quitting){const error=Error(`The artwork worker stopped (code ${code}). Restart RowCraft.`);if(!origin)reject(error);else void fatal(error);}});
 });
}
function requestClose(){if(quitting||closePending||closeDialog)return;closePending=true;worker.postMessage({type:'request-close'});}
async function handleCloseStatus(count){
 closePending=false;if(!count){shutdown();return;}
 if(waitForJobs||closeDialog)return;
 closeDialog=true;
 const result=await dialog.showMessageBox(window,{type:'info',title:'Illustrator is working',message:'An artwork job is still running.',detail:'Keep Illustrator open. You can leave RowCraft open or have it close after the queue finishes.',buttons:['Keep RowCraft open','Close when finished'],defaultId:0,cancelId:0});
 closeDialog=false;waitForJobs=result.response===1;if(waitForJobs)requestClose();
}
function shutdown(){
 if(quitting)return;quitting=true;
 if(window)window.destroy();
 if(worker){worker.once('exit',()=>app.quit());worker.postMessage({type:'shutdown'});setTimeout(()=>{worker.kill();app.quit();},3000).unref();}else app.quit();
}
