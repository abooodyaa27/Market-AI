(function(root,f){const api=f(typeof module==='object'?require('./trainer'):root.ModelTrainer);if(typeof module==='object')module.exports=api;else root.TrainingRunner=api;})(globalThis,function(T){
'use strict';
async function run(rows,incumbent,options){let worker,timer;try{
 // Construction can throw under Android file:// WebView, before onerror exists.
 worker=new Worker('training-worker.js');
 return await new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('TRAINING_TIMEOUT')),12000);worker.onmessage=e=>e.data.ok?resolve(e.data.result):reject(Error(e.data.error));worker.onerror=e=>reject(Error(e.message||'WORKER_ERROR'));worker.postMessage({rows,incumbent,options});});
 }catch(error){await new Promise(resolve=>setTimeout(resolve,0));return T.train(rows,incumbent,options);}
 finally{clearTimeout(timer);worker?.terminate();}}
return{run};
});
