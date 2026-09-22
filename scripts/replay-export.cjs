// Usage: node scripts/replay-export.cjs /path/to/private-export.json
// The source export is never copied into the repository.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {IDBFactory}=require('fake-indexeddb'),J=require('../app/src/main/assets/decision-journal'),T=require('../app/src/main/assets/trainer');
(async()=>{const bytes=fs.readFileSync(process.argv[2]),data=JSON.parse(bytes);assert.equal(data.version,2);const j=new J.Journal(await J.openDB(new IDBFactory()));const imported=await j.importDecisions(data.decisions,data.metadata),rows=await j.all(),report={sha256:crypto.createHash('sha256').update(bytes).digest('hex'),exportedAt:data.exportedAt,imported,reimport:await j.importDecisions(data.decisions),symbols:{}};
for(const symbol of ['XAUUSD','BTCUSD']){const r=T.train(rows,null,{symbol,now:data.exportedAt});report.symbols[symbol]=r;await j.commitTraining(symbol,r);assert.equal(await j.meta('evaluatedUntil:'+symbol)||0,r.evaluatedUntil);}
fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/export-replay.json',JSON.stringify(report,null,2));console.log(JSON.stringify({sha256:report.sha256,imported,reimport:report.reimport,results:Object.fromEntries(Object.entries(report.symbols).map(([s,r])=>[s,T.describe(r)]))},null,2));j.db.close();})().catch(e=>{console.error(e);process.exitCode=1;});
