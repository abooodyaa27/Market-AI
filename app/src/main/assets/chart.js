'use strict';
window.MarketChart=(()=>{let geometry=null;const fmt=window.MarketAnalysis.formatPrice;
function draw(cv,a,tf){const r=cv.getBoundingClientRect(),W=Math.max(1,Math.floor(r.width)),H=Math.max(1,Math.floor(r.height)),dpr=Math.min(3,devicePixelRatio||1);if(cv.width!==W*dpr||cv.height!==H*dpr){cv.width=W*dpr;cv.height=H*dpr;}const c=cv.getContext('2d');if(!c)return 0;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);c.fillStyle='#0c131b';c.fillRect(0,0,W,H);c.direction='ltr';geometry=null;
 if(a.length<2){c.fillStyle='#a4b2c1';c.font='14px sans-serif';c.textAlign='center';c.fillText('بانتظار بيانات '+tf,W/2,H/2);return 0;}
 const desired={H4:24,H1:30,M15:40,M5:48,M1:55},count=Math.max(12,Math.min(desired[tf]||40,Math.floor((W-85)/6))),data=a.slice(-count);
 let mn=Math.min(...data.map(b=>b[3])),mx=Math.max(...data.map(b=>b[2]));if(!Number.isFinite(mn)||!Number.isFinite(mx))return 0;const pad=(mx-mn)*.10||Math.max(mx*.001,1);mn-=pad;mx+=pad;
 c.font='11px sans-serif';const R=Math.min(W*.35,Math.max(72,c.measureText(fmt(mx)).width+14)),L=9,T=48,B=53,pw=W-L-R,ph=H-T-B,step=pw/data.length,y=p=>T+(mx-p)/(mx-mn)*ph;
 for(let i=0;i<=5;i++){const yy=T+i*ph/5;c.strokeStyle='#23303d';c.beginPath();c.moveTo(L,yy);c.lineTo(L+pw,yy);c.stroke();c.fillStyle='#a4b2c1';c.textAlign='left';c.textBaseline='middle';c.fillText(fmt(mx-i*(mx-mn)/5),L+pw+6,yy);}
 const bw=Math.max(3,Math.min(12,step*.7));data.forEach((b,i)=>{const x=L+(i+.5)*step;c.fillStyle=c.strokeStyle=b[4]>=b[1]?'#2bd486':'#ff6975';c.beginPath();c.moveTo(x,y(b[2]));c.lineTo(x,y(b[3]));c.stroke();c.fillRect(x-bw/2,Math.min(y(b[1]),y(b[4])),bw,Math.max(1.5,Math.abs(y(b[4])-y(b[1]))));});
 const price=data[data.length-1][4],cy=y(price);c.strokeStyle='#ddb75f';c.setLineDash([4,4]);c.beginPath();c.moveTo(L,cy);c.lineTo(L+pw,cy);c.stroke();c.setLineDash([]);c.fillStyle='#ddb75f';c.fillRect(L+pw+2,cy-9,R-3,18);c.fillStyle='#080c11';c.font='bold 11px sans-serif';c.textAlign='left';c.fillText(fmt(price),L+pw+6,cy);
 const marks=[0,Math.floor((data.length-1)/2),data.length-1];c.fillStyle='#a4b2c1';c.font='10px sans-serif';c.textBaseline='top';marks.forEach((i,k)=>{const dt=new Date(data[i][0]*1000),x=L+(i+.5)*step;c.textAlign=k===0?'left':k===2?'right':'center';c.fillText(dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}),x,H-B+10);c.fillText(dt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false}),x,H-B+25);});
 geometry={data,left:r.left+L,step};return data.length;
}
function pick(clientX){if(!geometry)return null;const i=Math.max(0,Math.min(geometry.data.length-1,Math.floor((clientX-geometry.left)/geometry.step)));return geometry.data[i];}
return {draw,pick};})();
