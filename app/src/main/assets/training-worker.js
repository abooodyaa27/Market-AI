'use strict';
importScripts('decision-engine.js','trainer.js');
onmessage=e=>{try{postMessage({ok:true,result:ModelTrainer.train(e.data.rows,e.data.incumbent,e.data.options)});}catch(error){postMessage({ok:false,error:error.message});}};
