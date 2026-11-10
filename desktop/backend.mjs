// Electron's utility process supplies Node. Never spawn process.execPath as a Node CLI.
process.env.COVER_STUDIO_NO_LISTEN='1';
process.env.ROWCRAFT_DESKTOP='1';
const {app,activeJobs,prepareShutdown}=await import('../server/index.mjs');
const server=app.listen(0,'127.0.0.1');
await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const report=()=>process.parentPort.postMessage({type:'activity',count:activeJobs()});
const timer=setInterval(report,400);timer.unref();
process.parentPort.postMessage({type:'ready',url:`http://127.0.0.1:${server.address().port}`});
process.parentPort.on('message',({data})=>{
 if(data?.type==='request-close')process.parentPort.postMessage({type:'close-status',count:prepareShutdown()});
 if(data?.type==='shutdown'&&!activeJobs()){
  clearInterval(timer);server.closeAllConnections();server.close(()=>process.exit(0));
 }
});
