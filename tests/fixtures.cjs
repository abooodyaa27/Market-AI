const NOW=1800000000000;
const seconds={M1:60,M5:300,M15:900,H1:3600,H4:14400};
function bars(tf,values){const end=Math.floor(NOW/1000/seconds[tf])*seconds[tf];return values.map((v,i)=>[end-(values.length-i)*seconds[tf],...v,false]);}
function trend(tf){return bars(tf,Array.from({length:90},(_,i)=>{const c=70+i*.32+Math.sin(i*Math.PI/4)*1.2;return[c-.12,c+.45,c-.5,c];}));}
function scenario(symbol='XAUUSD',sell=false){
 const b={H4:trend('H4'),H1:trend('H1')};
 let v=Array.from({length:65},(_,i)=>[100.2+i*.001,100.7+i*.001,100+i*.001,100.4+i*.001]);
 v.push([100.1,100.5,99.9,100.25],[100.2,100.4,99.7,100.25],[100,100.4,99.95,100.3],[100.25,100.6,100.05,100.45],[100.4,100.65,100.2,100.5]);
 b.M15=bars('M15',v);
 v=Array.from({length:65},(_,i)=>[98+i*.025,98.25+i*.025,97.85+i*.025,98.1+i*.025]);
 v.push([99.8,100.15,99.75,100.05],[100.05,100.2,99.85,100.1],[100.1,100.3,99.95,100.25]);b.M5=bars('M5',v);
 v=Array.from({length:65},()=>[100,100.15,99.9,100.05]);
 v.push([100.05,100.18,100,100.1],[100.1,100.2,100.02,100.12],[100.12,100.45,100.08,100.4]);b.M1=bars('M1',v);
 if(sell)for(const tf of Object.keys(b))b[tf]=b[tf].map(([t,o,h,l,c,open])=>[t,200-o,200-l,200-h,200-c,open]);
 const scale=symbol==='BTCUSD'?600:30;
 for(const tf of Object.keys(b))b[tf]=b[tf].map(([t,o,h,l,c,open])=>[t,o*scale,h*scale,l*scale,c*scale,open]);
 return {symbol,bars:b,tick:{price:(sell?99.6:100.4)*scale,receivedAt:NOW,sourceAt:NOW,marketState:'OPEN'},now:NOW};
}
module.exports={NOW,seconds,bars,trend,scenario};
function continuation(symbol='XAUUSD',sell=false){
 const s=scenario(symbol,sell),v=Array.from({length:66},(_,i)=>{const c=97+i*.048;return[c-.08,c+.2,c-.22,c];});
 v.push([100.12,100.32,99.94,100.08],[100.08,100.28,99.96,100.16],[100.16,100.30,99.98,100.10],[100.10,100.35,100,100.22]);
 const scale=symbol==='BTCUSD'?600:30;
 s.bars.M15=bars('M15',v).map(([t,o,h,l,c,open])=>sell?[t,(200-o)*scale,(200-l)*scale,(200-h)*scale,(200-c)*scale,open]:[t,o*scale,h*scale,l*scale,c*scale,open]);
 return s;
}
module.exports.continuation=continuation;
