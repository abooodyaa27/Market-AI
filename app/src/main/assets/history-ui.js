'use strict';
window.HistoryUI=(()=>{
const $=id=>document.getElementById(id),fmt=window.MarketAnalysis.formatPrice;
const percent=v=>v===null?'—':v.toFixed(1)+'%',rtext=v=>v===null?'—':v.toFixed(2)+'R';
const date=t=>t===null?'—':new Date(t).toLocaleString('ar-SA-u-ca-gregory',{hour12:false});
const reasons={DATA_GAP:'رصد غير مكتمل / انقطاع أو إغلاق التطبيق',H1_REVERSAL:'انعكاس مؤكد في H1',TIME_LIMIT:'انتهاء 30 دقيقة',TIME_LIMIT_FIRST_OBSERVATION:'أول سعر مرصود بعد 30 دقيقة',STOP_OBSERVED:'ملامسة الوقف',TARGET_OBSERVED:'ملامسة TP3'};
function element(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function render(journal){
 const f={symbol:$('historyAsset').value,opportunityType:$('historyMode').value,version:$('historyVersion').value},stats=journal.stats(f);
 $('historyError').textContent=journal.error;$('historyError').hidden=!journal.error;
 const cards=[['الإشارات',stats.total],['قيد المتابعة',stats.active],['Win Rate',percent(stats.winRate)],['متوسط R',rtext(stats.averageR)],['لمس TP1',percent(stats.tp1Rate)],['لمس TP2',percent(stats.tp2Rate)],['لمس TP3',percent(stats.tp3Rate)],['ضرب SL',percent(stats.slRate)],['إغلاق مقاس',stats.measured],['إغلاق غير معلوم',stats.unknown]];
 $('historyStats').replaceChildren(...cards.map(([label,value])=>{const e=element('div',undefined,'level');e.append(element('span',label),element('b',String(value)));return e;}));
 const tbody=$('historyGroups');tbody.replaceChildren();for(const symbol of ['XAUUSD','BTCUSD'])for(const mode of ['PULLBACK','CONTINUATION']){const s=journal.stats({symbol,opportunityType:mode,version:f.version}),tr=element('tr');[symbol,mode,s.total,percent(s.winRate),rtext(s.averageR)].forEach(v=>tr.append(element('td',String(v))));tbody.append(tr);}
 const records=journal.filtered(f).slice(-100).reverse();$('historyCount').textContent='عرض آخر '+records.length+' من '+stats.total+' إشارة. التصدير يشمل السجل الكامل.';
 const list=$('historyList');list.replaceChildren();if(!records.length){list.append(element('p','لم تُسجّل إشارات مطابقة بعد. لا تُضاف بيانات تجريبية إلى السجل.','note'));return;}
 for(const r of records){const details=element('details',undefined,'card history-record'),summary=element('summary');summary.append(element('strong',r.symbol+' • '+r.direction+' • '+r.opportunityType),element('span',r.result+(r.status==='ACTIVE'?' • قيد المتابعة':''),'chip '+(r.result==='SL'?'bad':r.result==='TP3'?'good':'warn')),element('small',date(r.createdAt)+' • '+r.score+'/100 • V'+r.version));details.append(summary);
 const lines=[['Signal ID',r.id],['الدخول',fmt(r.entry)],['SL',fmt(r.sl)],['TP1 / TP2 / TP3',[r.tp1,r.tp2,r.tp3].map(fmt).join(' / ')],['ATR',fmt(r.atr)],['POI',r.poi?fmt(r.poi.low)+' → '+fmt(r.poi.high):'—'],['إغلاق',date(r.closedAt)],['النتيجة',r.result+' • '+(reasons[r.closeReason]||'متابعة تلقائية')],['R عند الإغلاق',rtext(r.r)],['MFE / MAE',rtext(r.mfeR)+' / '+rtext(r.maeR)],['الحركة لصالح / ضد الإشارة',r.mfe.toFixed(3)+' / '+r.mae.toFixed(3)+' وحدة سعر'],['المدة',Math.floor(r.durationMs/1000)+' ثانية'],['لمس الأهداف',[r.hits.tp1,r.hits.tp2,r.hits.tp3].map(date).join(' / ')]];
 const dl=element('dl');for(const [k,v] of lines){dl.append(element('dt',k),element('dd',v));}details.append(dl);
 for(const s of r.stages)details.append(element('p',s.tf+' • '+s.text+' • '+(s.ok?'مؤكد':'سياق / غير مؤكد'),'note'));list.append(details);}
}
function exportFile(journal,format){const data=format==='csv'?journal.exportCSV():journal.exportJSON();if(window.AndroidExports){window.AndroidExports.exportReport(format,data);$('exportStatus').textContent='اختر مكان حفظ الملف من نافذة أندرويد.';return;}
 const blob=new Blob([data],{type:format==='csv'?'text/csv;charset=utf-8':'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Market_AI_signals_'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('exportStatus').textContent='تم تجهيز ملف التصدير.';
}
return {render,exportFile};})();
