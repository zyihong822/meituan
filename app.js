'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fmt=n=>Number(n).toLocaleString('zh-CN'), pct=(a,b)=>b?`${(a/b*100).toFixed(2)}%`:'—';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAY=86400000, CUT=Date.parse('2026-10-23T23:59:59+08:00');
const stamp=d=>Date.parse(`${d}T00:00:00+08:00`);
const dateLabel=t=>new Date(t+8*3600000).toISOString().slice(0,10);
const productDefs=[['10021','iPhone 16 Pro','手机'],['10022','iPhone 15','手机'],['10024','华为 Mate 60 Pro','手机'],['10035','索尼 A7M4 相机','摄影器材'],['10036','佳能 R6 Mark II','摄影器材'],['10038','大疆 Osmo Pocket 3','摄影器材'],['10046','任天堂 Switch OLED','游戏设备'],['10047','PlayStation 5','游戏设备']].map(([id,name,cat])=>({id,name,cat}));
const stores={sh:'上海静安店',hz:'杭州滨江店',sz:'深圳南山店'};
const placements={recommend:'首页推荐',category:'分类列表',search:'搜索结果'};
function hash(x){let v=(x*1664525+1013904223)>>>0;v^=v>>>15;v=Math.imul(v,2246822519);return(v>>>0)/4294967296}
const journeys=[];
for(let day=1;day<=23;day++)for(let i=0;i<180;i++){
 const k=day*180+i,entry=stamp(`2026-10-${String(day).padStart(2,'0')}`)+(9*3600+i*180)*1000;
 const p=productDefs[Math.floor(hash(k+5)*productDefs.length)],store=Object.keys(stores)[i%3],user='U-'+String(Math.floor(hash(k+8)*1100)).padStart(4,'0');
 const r=hash(k+20),thresholds=[1,.80,.46,.43,.34,.32,.27,.25,.23,.20];
 let depth=0;thresholds.forEach((v,idx)=>{if(r<v)depth=idx});
 const login=hash(k+30)>.4,source=hash(k+1)>.07?'rental':'unknown',placement=Object.keys(placements)[Math.floor(hash(k+40)*3)],direct=hash(k+50)<.22;
 const times=Array.from({length:10},(_,s)=>entry+s*75*1000);
 times[8]+=Math.floor(hash(k+60)*3)*DAY;times[9]=Math.max(times[8]+Math.floor(hash(k+70)*3)*DAY+45000,times[7]+3*3600000);
 const raw=Array.from({length:10},(_,s)=>s<7?1+Math.floor(hash(k+s+90)*3):1);
 raw[0]=1;raw[3]+=!login&&depth>=4?1:0;
 const success=!login&&depth>=3&&(depth>=4||hash(k+100)>.55),returned=success&&(depth>=4||hash(k+101)>.15);
 journeys.push({k,id:'J-'+String(k).padStart(5,'0'),uid:user,p,store,source,entry,login,placement,direct,depth,times,raw,success,returned});
}
const baseScope={source:'rental',store:'all',category:'all',search:'',login:'all',placement:'all'};
let applied={...baseScope,start:'2026-10-17',end:'2026-10-23',ids:[]};
let productApplied={...applied,ids:[]};
let areaMetric=0;
const funnelNodeOrder=['exposure','shop','miniTotal','rental','order','verify','review','accept','deal'];
let selectedFunnelNodes=new Set(['exposure','shop','miniTotal','rental','order','verify','deal','review','accept']);
const funnelNodeNames={exposure:'店铺曝光',shop:'店铺访问',miniTotal:'小程序总访问',rental:'已登录访问',order:'租赁下单',verify:'认证通过',deal:'首期支付成功',review:'平台审核通过',accept:'商家接单'};
let sortKey='browseUv',sortDir=-1,page=1,pageSize=10;
let hidden=new Set(),lastFlow=[],lastTable=[],globalPicker,productPager,lastPrevFlow=null,lastPrevSummary=null;
const COLS=[['browseUv','商品访问人数'],['browseRaw','商品浏览量'],['ctr','商品曝光-访问点击率'],['orderUv','下单人数'],['orderRaw','下单量'],['dealUv','成交买家数'],['dealRaw','成交订单数'],['amount','成交金额（预估）'],['dealRate','商品访问-成交转化率']];
function selectedProduct(p,range=applied){return (range.category==='all'||p.cat===range.category)&&(!range.search||p.name.toLowerCase().includes(range.search.toLowerCase()))&&(!range.ids.length||range.ids.includes(p.id))}
function productScoped(){return applied.category!=='all'||!!applied.search||applied.ids.length>0}
function matching(j,range=applied){return j.source==='rental'&&selectedProduct(j.p,range)}
function inRange(t,range=applied){return t>=stamp(range.start)&&t<stamp(range.end)+DAY&&t<=CUT}
function unique(arr){return new Set(arr.map(j=>j.uid)).size}
function previousPeriod(range){
 const start=stamp(range.start),days=Math.round((stamp(range.end)-start)/DAY)+1;
 const previous={...range,start:dateLabel(start-days*DAY),end:dateLabel(start-DAY)};
 return {range:previous,available:stamp(previous.start)>=stamp('2026-10-01')};
}
function rateNumber(value){if(typeof value==='number')return value;if(typeof value==='string'&&value.endsWith('%'))return Number.parseFloat(value)/100;return null}
function periodChange(value,prior,isRate=false){
 if(value==null||prior==null||!Number.isFinite(value)||!Number.isFinite(prior))return '—';
 if(!isRate&&prior===0)return '—';
 const raw=isRate?(value-prior)*100:(value-prior)/prior*100;
 const rounded=Number(raw.toFixed(2)),signed=rounded>0?'+':'';
 return `${signed}${rounded.toFixed(2)}${isRate?'个百分点':'%'}`;
}
function compareText(value,prior,isRate=false){return `环比 ${periodChange(value,prior,isRate)}`}
function compareMarkup(value,prior,isRate=false,range=applied){
 const change=periodChange(value,prior,isRate),direction=change.startsWith('+')?'change-up':change.startsWith('-')?'change-down':'change-neutral';
 return `<span class="period-change ${direction}">${compareText(value,prior,isRate)}</span>`;
}
function mainComparison(){
 const prev=previousPeriod(applied);if(!prev.available)return {flow:null,summary:null};
 const saved=applied;try{applied=prev.range;return {flow:makeFlow(),summary:dealSummary()}}finally{applied=saved}
}
function previousMetric(id,i){return lastPrevFlow?.find(s=>s.id===id)?.values[i]??null}
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),2600)}
function showDialog(title,body,footer=''){const d=$('#dialog');$('#dialogTitle').textContent=title;$('#dialogBody').innerHTML=body;$('#dialogFooter').innerHTML=footer||'<button class="primary" id="dialogDone">知道了</button>';if(!d.open)d.showModal();$('#dialogDone')?.addEventListener('click',()=>d.close())}
$('#closeDialog').onclick=()=>$('#dialog').close();$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
function depositPassed(j){return j.depth>=7&&hash(j.k+1200)<.90}
function verificationPassed(j){return depositPassed(j)&&hash(j.k+1210)<.90}
function platformPassed(j){return verificationPassed(j)&&hash(j.k+1250)<.83}
function merchantAccepted(j){return platformPassed(j)&&hash(j.k+1220)<.85}
function stageRecords(stage,range=applied,pid=null){return journeys.filter(j=>matching(j,range)&&(!pid||j.p.id===pid)&&j.depth>=stage&&(stage!==9||merchantAccepted(j))&&inRange(j.times[stage],range))}
function loggedInRange(j,range=applied){return j.login?inRange(j.entry,range):j.success&&inRange(j.times[3],range)}
function rentalRecords(range=applied,pid=null){return journeys.filter(j=>matching(j,range)&&(!pid||j.p.id===pid)&&inRange(j.entry,range)&&loggedInRange(j,range))}
function rentalViews(records){return records.reduce((n,j)=>n+(j.depth>=1?j.raw[1]:1),0)}
function makeFlow(){
 const platformJs=journeys.filter(j=>inRange(j.entry));const visitIds=new Set(),exposeIds=new Set();
 platformJs.forEach(j=>{visitIds.add(j.uid);visitIds.add('V-'+Math.floor(hash(j.k+245)*4000));for(let i=0;i<4;i++)exposeIds.add('E-'+Math.floor(hash(j.k+i+250)*13000))});visitIds.forEach(id=>exposeIds.add(id));
 const groupVisitIds=new Set(platformJs.map(j=>'G-'+Math.floor(hash(j.k+940)*1500)));
 const groupUv=groupVisitIds.size;
 const visits=journeys.filter(j=>matching(j)&&inRange(j.entry));
 const rental=visits.filter(j=>loggedInRange(j)),loggedIds=new Set(rental.map(j=>j.uid)),unloggedIds=new Set(visits.filter(j=>!loggedIds.has(j.uid)).map(j=>j.uid)),orders=stageRecords(7),deals=stageRecords(9);
 const views=j=>j.depth>=1?j.raw[1]:1;
 const loggedViews=j=>j.login?views(j):(loggedInRange(j)?1:0);
 const totalPv=visits.reduce((n,j)=>n+views(j),0),rentPv=rental.reduce((n,j)=>n+loggedViews(j),0);
 const shopUv=visitIds.size,shopPv=platformJs.length*4+Math.floor(platformJs.length*.35),rentUv=unique(rental);
 const candidates=journeys.filter(j=>matching(j)&&j.depth>=7);
 const activity=(offset,threshold,days)=>candidates.filter(j=>hash(j.k+offset)<threshold&&inRange(j.times[7]+Math.floor(hash(j.k+offset+1)*days)*DAY));
 const verify=candidates.filter(j=>verificationPassed(j)&&inRange(j.times[7]+20*60000));
 const reviewedAll=candidates.filter(platformPassed),reviewTime=j=>j.times[7]+3600000,reviewed=reviewedAll.filter(j=>inRange(reviewTime(j)));
 const accepted=reviewedAll.filter(j=>merchantAccepted(j)&&inRange(reviewTime(j)+3600000)),shipped=activity(1230,.52,3),refunded=activity(1240,.18,4);

 const result=[
 {id:'exposure',level:'01',name:'店铺曝光',source:'美团平台',labels:['店铺曝光人数','曝光量'],values:[exposeIds.size,platformJs.length*17],units:['人','次'],note:'店铺在美团搜索、推荐等位置的曝光。'},
 {id:'shop',level:'02',name:'店铺访问与浏览',source:'美团平台',labels:['店铺访问人数','店铺浏览量'],values:[shopUv,shopPv],units:['人','次'],note:'访问为周期去重人数；浏览量为店铺页面浏览量。'},
 {id:'rental',level:'04',name:'已登录访问',source:'小程序访问事件',labels:['已登录访问人数','已登录访问量'],values:[rentUv,rentPv],units:['人','次'],note:'统计期内已关联登录用户ID的去重访客人数；访问量按访问时已登录的行为统计。'},
 {id:'group',level:'',name:'团购访问',source:'美团后台团购报表',labels:['团购访问人数'],values:[groupUv],units:['人'],note:'统计期内团购商品的访问用户数，按用户去重。'},
 {id:'order',level:'04',name:'下单',source:'租赁订单',labels:['下单人数','下单量'],values:[unique(orders),orders.length],units:['人','单'],note:'成功创建待付款订单；人数按用户去重，下单量按订单去重。'},
 {id:'deal',level:'05',name:'成交',source:'租赁订单',labels:['成交买家数','成交订单数'],values:[unique(deals),deals.length],units:['人','单'],note:'按首期支付成功时间统计，成交买家按用户去重，成交订单按订单ID去重。'},
 {id:'miniTotal',level:'03',name:'小程序总访问',source:'小程序访问事件',labels:['小程序总访问人数','小程序总访问量'],values:[unique(visits),totalPv],units:['人','次'],note:'统计期内来自租赁入口的小程序访问，包含已登录和未登录；人数按匿名访客与账号关联后去重。'},
 {id:'unlogged',level:'',name:'未登录访问',source:'小程序访问事件',labels:['未登录访问人数','未登录访问量'],values:[unloggedIds.size,totalPv-rentPv],units:['人','次'],note:'统计期内未关联登录用户ID的访客数，按访客ID去重；访客登录并关联用户ID后计入已登录访问人数。访问量按访问时未登录的行为统计。'},
 {id:'verify',level:'',name:'认证通过',source:'认证服务结果',labels:['认证通过人数','认证通过量'],values:[unique(verify),verify.length],units:['人','单'],note:'按认证通过时间统计，人数按用户去重，量按认证通过的订单ID去重。'},
 {id:'review',level:'',name:'平台审核通过',source:'平台审核记录',labels:['平台审核通过人数','平台审核通过订单数'],values:[unique(reviewed),reviewed.length],units:['人','单'],note:'统计期内平台审核通过的去重用户数和订单数；平台审核发生在商家接单和支付之前。'},
 {id:'accept',level:'',name:'商家接单',source:'租赁订单状态记录',labels:['商家接单人数','商家接单量'],values:[unique(accepted),accepted.length],units:['人','单'],note:'统计期内商家评审通过并接单的订单数及对应用户数，分别按订单ID和用户去重。'},
 {id:'ship',level:'',name:'发货',source:'物流发货记录',labels:['发货量'],values:[shipped.length],units:['单'],note:'统计期内至少发生一次发货的订单数，按订单ID去重。'},
 {id:'refund',level:'',name:'退款',source:'退款记录',labels:['退款量','退款金额'],values:[refunded.length,refunded.reduce((n,j)=>n+orderRentalCents(j),0)/100],units:['单','元'],note:'退款量按统计期内退款成功的订单ID去重；退款金额按退款成功时间累计实际退款金额。'},
 ];
 if(productScoped())result.filter(s=>['exposure','shop','group'].includes(s.id)).forEach(s=>{s.values=[null,null];s.unavailable='美团店铺数据暂无商品维度，当前商品筛选下不展示该指标。'});
 return result;
}
function metricValue(s,i){return !s.labels[i]?'':s.values[i]==null?'—':s.units[i]==='元'?'¥'+money(s.values[i]):fmt(s.values[i])}
function dealSummary(){const deals=stageRecords(9),visits=journeys.filter(j=>matching(j)&&inRange(j.entry));return {firstPayment:deals.reduce((sum,j)=>sum+orderRentalCents(j),0)/100,amount:deals.reduce((sum,j)=>sum+estimatedRentalCents(j),0)/100,rate:pct(unique(deals),unique(visits))}}
function metricDetails(id){const s=lastFlow.find(x=>x.id===id),extra=id==='deal'?dealSummary():null;showDialog(s.name+' · 指标口径',`<div class="metric-detail-pair">${s.labels.map((l,i)=>`<div><small>${l}</small><strong>${metricValue(s,i)} <em>${s.units[i]}</em></strong></div>`).join('')}${extra?`<div><small>成交金额（预估）</small><strong>¥${money(extra.amount)}</strong></div><div><small>首期支付金额</small><strong>¥${money(extra.firstPayment)}</strong></div><div><small>成交转化率（实测）</small><strong>${extra.rate}</strong></div>`:''}</div><p>${s.unavailable||s.note}</p><p>统计时间：${applied.start} 至 ${applied.end}；来源：${s.source}。</p>${extra?'<p>成交金额（预估）为统计期内成交订单在成交时约定的租金总额，含未来未收租金，不含押金；来源：支付成功流水。按首期支付成功时间汇总所选时间内的首期实付租金，支付流水去重；含主动支付及代扣，不含押金、后续期款，不扣减退款。当前所选时间内，首期支付成功的去重买家数 ÷ 小程序总访问人数 × 100%。小程序总访问人数为未登录访问人数与已登录访问人数之和。</p>':''}`)}
function funnelStages(){return funnelNodeOrder.filter(id=>selectedFunnelNodes.has(id)).map(id=>lastFlow.find(s=>s.id===id)).filter(Boolean)}
function flowRates(){const stages=funnelStages();return stages.slice(1).map((to,i)=>({from:stages[i],to,name:`${funnelNodeNames[stages[i].id]}至${funnelNodeNames[to.id]}比例`}))}
function flowMetricLabel(s,i=areaMetric){return s.id==='rental'?(i===0?'已登录访问人数':'已登录访问量'):s.labels[i]}
function flowRateTip(r){return `当前所选时间内，${flowMetricLabel(r.to)} ÷ ${flowMetricLabel(r.from)} × 100%。`}
function stageRate(from,to,i){return from.values[i]!=null&&to.values[i]!=null&&from.values[i]>0&&to.values[i]>=0?pct(to.values[i],from.values[i]):'—'}
function rateDetails(id){const r=flowRates().find(r=>r.to.id===id);showDialog(r.name+' · 计算口径',`<p>统计时间：${applied.start} 至 ${applied.end}</p>${[areaMetric].map(i=>`<div class="rate-formula"><small>${i===0?'人数':'量'}转化率</small><strong>${stageRate(r.from,r.to,i)}</strong><p>${flowMetricLabel(r.to,i)} ÷ ${flowMetricLabel(r.from,i)} × 100%<br>${metricValue(r.to,i)} ÷ ${metricValue(r.from,i)} × 100%</p></div>`).join('')}<p class="subtitle">${flowRateTip(r)}</p>`)}
function funnelInsights(){
 const stages=funnelStages(),first=stages[0],last=stages[stages.length-1];
 if(!first||!last)return '';
 const ranked=flowRates().filter(r=>r.from.values[areaMetric]>0&&r.to.values[areaMetric]!=null).sort((a,b)=>a.to.values[areaMetric]/a.from.values[areaMetric]-b.to.values[areaMetric]/b.from.values[areaMetric]);
 const overallTip=`当前所选时间内，${flowMetricLabel(last)} ÷ ${flowMetricLabel(first)} × 100%。`;
 return `<div class="funnel-insights"><div class="insight-overall" title="${esc(overallTip)}"><span>整体转化率</span><strong>${stageRate(first,last,areaMetric)}</strong></div>${[0,1].map((i)=>{const r=ranked[i];return `<button class="insight-stage" ${r?`data-rate="${r.to.id}" title="${esc(flowRateTip(r))}"`:'disabled'}><span>${i===0?'最大流失环节':'其次'}</span><div>${r?`<strong>${funnelNodeNames[r.from.id]} → ${funnelNodeNames[r.to.id]}</strong><b>${stageRate(r.from,r.to,areaMetric)}</b>`:'—'}</div></button>`}).join('')}</div>`;
}
function funnelOverall(){
 const stages=funnelStages(),first=stages[0],last=stages[stages.length-1];
 if(!first||!last)return '';
 const formula=`当前所选时间内，${flowMetricLabel(last)} ÷ ${flowMetricLabel(first)} × 100%。`;
 return `<div class="funnel-overall" tabindex="0" title="${esc(formula)}" aria-label="整体转化率，${areaMetric===0?'人数':'量'}，${stageRate(first,last,areaMetric)}。${esc(formula)}"><div class="funnel-overall-value"><strong>整体转化率</strong><b>${stageRate(first,last,areaMetric)}</b></div><span>${flowMetricLabel(first)} → ${funnelNodeNames[last.id]}</span></div>`;
}
function funnelStartTip(stage,first){
 const i=areaMetric;
 return `${funnelNodeNames[stage.id]} · ${i===0?'人数':'量'}\n占起点比例：${stageRate(first,stage,i)}`;
}
function unifiedFunnel(){
 const stages=funnelStages(),rates=flowRates();
 const names=funnelNodeNames;
 const bands={exposure:'band-platform',shop:'band-platform',miniTotal:'band-mini',rental:'band-mini',order:'band-mini',verify:'band-mini',deal:'band-mini',review:'band-mini',accept:'band-mini'};
 const max=Math.max(0,...stages.map(s=>s.values[areaMetric]??0));
 function arrow(r){const height=76;return `<button class="transition-rate " style="height:${height}px" data-rate="${r.to.id}" title="${esc(flowRateTip(r))}" aria-label="${flowMetricLabel(r.from)}到${flowMetricLabel(r.to)}的转化率，查看公式"><svg style="height:${height}px" viewBox="0 0 24 ${height}" aria-hidden="true"><path d="M 1 1 H 18 V ${height-1} H 4"/><path class="arrow-tip" d="M 8 ${height-6} L 1 ${height-1} L 8 ${height+4}"/></svg><span class="transition-label">${flowMetricLabel(r.from)} <b>→</b> ${flowMetricLabel(r.to)}</span><span class="transition-values single-rate"><strong>${stageRate(r.from,r.to,areaMetric)}</strong></span></button>`}
 return `${funnelInsights()}<div class="compact-flow-scroll"><div class="compact-flow selected-${areaMetric===0?'uv':'pv'}"><div class="compact-flow-head"><div class="flow-data"><span>阶段</span><button class="metric-column-toggle uv-col" data-area="0" aria-pressed="${areaMetric===0}">人数</button><button class="metric-column-toggle pv-col" data-area="1" aria-pressed="${areaMetric===1}">量</button></div><span aria-hidden="true"></span><div class="rate-head"><span>阶段转化率</span><div><span>${areaMetric===0?'人数转化率':'量转化率'}</span></div></div></div>${stages.map(s=>{
 const value=s.values[areaMetric],width=value!=null&&max>0?Math.max(0,value)/max*100:0,r=rates.find(r=>r.from.id===s.id);
 return `<div class="compact-flow-row continuous-row"><div class="flow-data"><button class="flow-label" data-detail="${s.id}"><span>${names[s.id]}</span></button><button data-area="0" class="flow-number metric-col uv-col" aria-label="按人数查看漏斗，${names[s.id]} ${metricValue(s,0)}"><span class="flow-metric-value">${metricValue(s,0)}</span></button><button data-area="1" class="flow-number metric-col pv-col" aria-label="${'按量查看漏斗，'+s.labels[1]+' '+metricValue(s,1)}"><span class="flow-metric-value">${metricValue(s,1)}</span></button></div><div class="flow-plot" data-detail="${s.id}" tabindex="0" data-tooltip="${esc(funnelStartTip(s,stages[0]))}" aria-label="${esc(funnelNodeNames[s.id]+'，占起点比例 '+stageRate(stages[0],s,areaMetric))}">${value==null?`<span class="plot-unavailable">暂无该维度数据</span>`:`<span class="flow-band ${bands[s.id]}" style="width:${width}%;${width===0?'visibility:hidden;':''}"></span>`}</div><div class="flow-rate-cell">${r?arrow(r):''}</div></div>`}).join('')}</div>${funnelOverall()}</div>`;
}
function renderFunnelOptions(){
 $('#funnelNodeOptions').innerHTML=`<div class="funnel-option-title">选择要展示的节点</div>${funnelNodeOrder.map(id=>`<label><input type="checkbox" value="${id}" ${selectedFunnelNodes.has(id)?'checked':''}><span>${funnelNodeNames[id]}</span></label>`).join('')}<div class="funnel-option-foot">按业务顺序展示，至少选择两个节点</div>`;
 $$('#funnelNodeOptions input').forEach(input=>input.onchange=()=>{if(!input.checked&&selectedFunnelNodes.size<=2){input.checked=true;toast('至少保留两个节点');return}input.checked?selectedFunnelNodes.add(input.value):selectedFunnelNodes.delete(input.value);renderFlow()});
}
function renderFlow(){
 lastFlow=makeFlow();const comparison=mainComparison();lastPrevFlow=comparison.flow;lastPrevSummary=comparison.summary;$('#flowContent').innerHTML=unifiedFunnel();renderFunnelOptions();bindMetricDetails();bindMetricTips();
 $$('[data-rate]').forEach(b=>b.onclick=()=>rateDetails(b.dataset.rate));
 $$('[data-area]').forEach(b=>b.onclick=e=>{e.stopPropagation();areaMetric=Number(b.dataset.area);renderFlow()});
}
function bindMetricDetails(){$$('[data-detail]').forEach(b=>{b.onclick=()=>metricDetails(b.dataset.detail);if(b.tagName.toLowerCase()==='g')b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();metricDetails(b.dataset.detail)}}})}
function metricTip(s,i){
 const definitions={miniTotal:['统计期内从租赁入口进入小程序的去重访客数，含已登录和未登录。','统计期内从租赁入口进入小程序的页面访问量，含已登录和未登录。'],unlogged:['统计期内未关联登录用户ID的访客数，按访客ID去重；访客登录并关联用户ID后计入已登录访问人数。','统计期内未登录状态下的小程序页面访问量。'],verify:['统计期内认证通过的用户数，按用户去重。','统计期内认证通过的订单数，按订单ID去重。'],review:['统计期内平台审核通过订单对应的去重用户数。','统计期内平台审核通过的订单数，按订单ID去重。'],accept:['统计期内商家评审通过并接单订单的去重用户数。','统计期内商家评审通过并接单的订单数，按订单ID去重。'],ship:['统计期内已发货的订单数，按订单ID去重。'],refund:['统计期内退款成功的订单数，按订单ID去重。','统计期内退款成功的实际退款金额合计。'],exposure:['统计期内看到店铺的去重用户数。','统计期内店铺展示量，重复曝光累加。'],shop:['统计期内进入店铺的去重用户数。','统计期内店铺页面浏览量。'],rental:['统计期内已关联登录用户ID的去重访客人数。','统计期内访问时已登录的小程序页面访问量，重复访问累加。'],group:['统计期内团购商品的访问用户数，按用户去重。'],order:['按订单创建时间统计，所选商品下单用户去重。','按订单创建时间统计，所选商品待付款订单ID去重。'],deal:['按首期支付成功时间统计，成交买家按用户去重。','按首期支付成功时间统计，成交订单按订单ID去重。']};
 return `数据来源：${s.source}。${definitions[s.id][i]}${s.unavailable?' '+s.unavailable:''}`;
}
function bindMetricTips(){
 if(bindMetricTips.ready){bindMetricTips.close();return}bindMetricTips.ready=true;
 const tip=$('#metricTooltip');let active=null;
 const close=()=>{tip.hidden=true;active?.removeAttribute('aria-describedby');active=null};bindMetricTips.close=close;
 const show=el=>{if(!el){close();return}if(active===el&&!tip.hidden)return;close();active=el;tip.textContent=el.dataset.tooltip;tip.hidden=false;el.setAttribute('aria-describedby','metricTooltip');const r=el.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(r.left,window.innerWidth-tip.offsetWidth-8))+'px';tip.style.top=(r.bottom+tip.offsetHeight+12<window.innerHeight?r.bottom+8:Math.max(8,r.top-tip.offsetHeight-8))+'px'};
 const target=e=>e instanceof Element&&!e.closest('.period-change')?e.closest('[data-tooltip]'):null;
 document.addEventListener('pointerover',e=>show(target(e.target)));
 document.addEventListener('pointerout',e=>show(target(e.relatedTarget)));
 document.addEventListener('focusin',e=>show(target(e.target)));
 document.addEventListener('focusout',e=>show(target(e.relatedTarget)));
 document.addEventListener('click',e=>{const el=target(e.target);if(el?.classList.contains('period-change')){e.stopPropagation();show(el)}},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();else if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('period-change')){e.preventDefault();e.stopPropagation();show(e.target)}},true);
 window.addEventListener('scroll',close,true);window.addEventListener('resize',close);
}
const DASHBOARD_GROUPS=[
 {title:'成交概览',fields:['成交金额（预估）','首期支付金额','成交买家数','成交订单数','成交转化率']},
 {title:'平台流量',fields:['店铺曝光人数','曝光量','店铺访问人数','店铺浏览量','团购访问人数']},
 {title:'小程序访问',fields:['小程序总访问人数','小程序总访问量','已登录访问人数','已登录访问量','未登录访问人数','未登录访问量']},
 {title:'交易与履约',fields:['下单人数','下单量','认证通过人数','认证通过量','平台审核通过人数','平台审核通过订单数','商家接单人数','商家接单量','发货量','退款量','退款金额']}
];
const allDashboardFields=DASHBOARD_GROUPS.flatMap(g=>g.fields);
let dashboardFields=new Set(allDashboardFields);
try{localStorage.removeItem('rental-dashboard-metrics-v1')}catch(e){}
function configureDashboard(){
 const draft=new Set(dashboardFields);
 const hints={
  '成交金额（预估）':'当前所选时间内，首期支付成功的订单在成交时约定的租金总额，包含未来未收租金，不含押金。',
  '首期支付金额':'当前所选时间内首期支付成功的实付金额，包含主动支付和代扣，不含押金及后续期款，不扣减退款。',
  '成交转化率':'当前所选时间内，首期支付成功的去重买家数 ÷ 小程序总访问人数 × 100%。小程序总访问人数为未登录访问人数与已登录访问人数之和。',
  '未登录访问人数':'统计期内未关联登录用户ID的访客数，按访客ID去重；访客登录并关联用户ID后计入已登录访问人数。',
  '退款金额':'所选时间内退款成功的实际退款金额之和。'
 };
 const option=label=>`<div class="config-option"><label><input type="checkbox" data-config-field="${esc(label)}" ${draft.has(label)?'checked':''}><span>${label}</span></label>${hints[label]?`<span class="config-hint" tabindex="0" aria-label="${esc(label+'：'+hints[label])}">?<span role="tooltip" class="config-hint-text">${esc(hints[label])}</span></span>`:''}</div>`;
 function body(){return `<div class="config-toolbar"><span id="configCount"></span><div><button type="button" class="config-text" id="configAll">全选</button></div></div><div class="config-groups">${DASHBOARD_GROUPS.map(g=>`<section class="config-group"><div class="config-group-title"><label class="config-group-select"><input type="checkbox" data-select-group="${esc(g.title)}"><strong>${g.title}</strong><span class="config-group-count" data-group-count="${esc(g.title)}"></span></label></div>${g.title==='小程序访问'?`<div class="config-options">${g.fields.slice(0,2).map(option).join('')}</div><details class="config-subgroup" open><summary>按登录状态 <span id="loginCount"></span></summary><div class="config-options">${g.fields.slice(2).map(option).join('')}</div></details>`:`<div class="config-options">${g.fields.map(option).join('')}</div>`}</section>`).join('')}</div>`}

 showDialog('指标配置',body(),'<div class="config-footer"><div><button type="button" id="configCancel">取消</button><button type="button" id="configConfirm" class="primary">确认</button></div></div>');
 const count=()=>{$('#configCount').innerHTML=`已选 <strong>${draft.size}</strong> / ${allDashboardFields.length}`};
 const refresh=()=>{$$('[data-config-field]').forEach(i=>i.checked=draft.has(i.dataset.configField));$$('#dialog [data-select-group]').forEach(i=>{const g=DASHBOARD_GROUPS.find(x=>x.title===i.dataset.selectGroup),n=g.fields.filter(x=>draft.has(x)).length;i.checked=n===g.fields.length;i.indeterminate=n>0&&n<g.fields.length;const label=$$('#dialog [data-group-count]').find(x=>x.dataset.groupCount===g.title);if(label)label.textContent=`${n}/${g.fields.length}`});const login=DASHBOARD_GROUPS.find(g=>g.title==='小程序访问').fields.slice(2);$('#loginCount').textContent=`（${login.filter(x=>draft.has(x)).length}/${login.length}）`;count()};refresh();
 $$('#dialog [data-config-field]').forEach(i=>i.onchange=()=>{i.checked?draft.add(i.dataset.configField):draft.delete(i.dataset.configField);refresh()});
 $('#configAll').onclick=()=>{allDashboardFields.forEach(x=>draft.add(x));refresh()};
 $$('#dialog [data-select-group]').forEach(b=>b.onchange=()=>{const g=DASHBOARD_GROUPS.find(x=>x.title===b.dataset.selectGroup);g.fields.forEach(x=>b.checked?draft.add(x):draft.delete(x));refresh()});
 $('#configCancel').onclick=()=>$('#dialog').close();
 $('#configConfirm').onclick=()=>{if(!draft.size){toast('请至少选择一个指标');return}dashboardFields=new Set(draft);$('#dialog').close();renderDash()};
}
$('#configureDashboard').onclick=configureDashboard;
function dashboardStages(){return ['deal','exposure','shop','group','miniTotal','rental','unlogged','order','verify','review','accept','ship','refund'].map(id=>lastFlow.find(s=>s.id===id))}
function renderDash(){
 $('#configureDashboard').textContent=`指标配置 ${dashboardFields.size}/${allDashboardFields.length}`;
 const summary=dealSummary(),lookup=id=>lastFlow.find(s=>s.id===id);
 function metricButton(s,i){if(!dashboardFields.has(s.labels[i]))return '';return `<button class="dash-metric" data-detail="${s.id}" data-tooltip="${esc(metricTip(s,i))}"><span class="metric-dotted">${s.labels[i]}</span><strong>${metricValue(s,i)} <em>${s.units[i]==='元'?'':s.units[i]}</em></strong>${compareMarkup(s.values[i],previousMetric(s.id,i))}</button>`}
 function group(title,ids,source){if(!ids.some(id=>lookup(id).labels.some(label=>dashboardFields.has(label))))return '';return `<section class="dash-group ${source==='美团侧'?'dash-platform':'dash-operations'}"><div class="dash-group-head"><h3>${title}</h3>${source?`<span class="dash-source ${source==='美团侧'?'platform-badge':'mini-badge'}">${source}</span>`:''}</div><div class="dash-metric-grid">${ids.flatMap(id=>{const item=lookup(id);return item.labels.map((_,i)=>metricButton(item,i))}).join('')}</div></section>`}
 const deal=lookup('deal');
 const extras=[{label:'成交金额（预估）',value:'¥'+money(summary.amount),tip:'来源：租赁成交订单。按成交时间汇总订单成交时约定的租金总额，包含未来未收租金，不含押金。',feature:true,current:summary.amount,prior:lastPrevSummary?.amount},{label:'首期支付金额',value:'¥'+money(summary.firstPayment),tip:'来源：支付成功流水。按首期支付成功时间汇总所选时间内的首期实付租金，支付流水去重；含主动支付及代扣，不含押金、后续期款，不扣减退款。',current:summary.firstPayment,prior:lastPrevSummary?.firstPayment},{label:'成交转化率',value:summary.rate,current:rateNumber(summary.rate),prior:rateNumber(lastPrevSummary?.rate),isRate:true,tip:'当前所选时间内，首期支付成功的去重买家数 ÷ 小程序总访问人数 × 100%。小程序总访问人数为未登录访问人数与已登录访问人数之和。'}];
 const dealExtra=m=>!dashboardFields.has(m.label)?'':`<button class="dash-metric ${m.feature?'dash-amount':''}" data-detail="deal" data-tooltip="${esc(m.tip)}"><span class="metric-dotted">${m.label}</span><strong>${m.value}</strong>${compareMarkup(m.current,m.prior,m.isRate)}</button>`;
 $('#overviewGrid').classList.toggle('dashboard-filtered',dashboardFields.size<allDashboardFields.length);
 $('#overviewGrid').innerHTML=`${DASHBOARD_GROUPS[0].fields.some(x=>dashboardFields.has(x))?`<section class="dash-group dash-deal"><div class="dash-group-head"><h3>成交概览</h3><span class="dash-source mini-badge">小程序侧</span></div><div class="dash-metric-grid deal-grid">${dealExtra(extras[0])}${dealExtra(extras[1])}${deal.labels.map((_,i)=>metricButton(deal,i)).join('')}${dealExtra(extras[2])}</div></section>`:''}${group('平台流量',['exposure','shop','group'],'美团侧')}${group('小程序访问',['miniTotal','rental','unlogged'],'小程序侧')}${group('交易与履约',['order','verify','review','accept','ship','refund'],'小程序侧')}`;
 bindMetricDetails();bindMetricTips();bindHelp();
}
const money=n=>Number(n).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
function estimatedRentalCents(j){return orderRentalCents(j)*(2+Math.floor(hash(j.k+790)*5))}
function orderRentalCents(j){const daily=[2990,1990,2490,5990,6990,1990,990,1590][productDefs.findIndex(p=>p.id===j.p.id)];return daily*(7+Math.floor(hash(j.k+780)*24))}
function productImage(p){
 const idx=productDefs.findIndex(x=>x.id===p.id),colors=['#647d9c','#b5a9ca','#7b938b','#4d6074','#657079','#788b99','#509a9a','#8497bb'];
 const color=colors[idx], device=p.cat==='手机'?`<rect x="23" y="9" width="34" height="62" rx="7" fill="${color}"/><rect x="26" y="12" width="28" height="56" rx="5" fill="#dbe5f1"/><path d="M26 47 Q40 18 54 32 V63 Q44 71 26 63" fill="${color}" opacity=".5"/><rect x="34" y="14" width="12" height="3" rx="2" fill="#26394c"/>`:p.cat==='摄影器材'?`<path d="M12 28 H25 L30 20 H49 L54 28 H68 V61 H12Z" fill="${color}"/><circle cx="41" cy="44" r="18" fill="#253242"/><circle cx="41" cy="44" r="13" fill="#637e97"/><circle cx="41" cy="44" r="8" fill="#213f59"/><circle cx="37" cy="40" r="3" fill="#bad4e6"/><rect x="15" y="31" width="9" height="4" rx="1" fill="#a7c1d5"/>`:`<rect x="9" y="23" width="62" height="36" rx="10" fill="${color}"/><rect x="24" y="27" width="32" height="28" rx="3" fill="#253b50"/><path d="M28 47 L38 32 L52 47" fill="#69899d"/><path d="M17 33 V45 M11 39 H23" stroke="#e4edf3" stroke-width="3"/><circle cx="63" cy="36" r="2" fill="#e4edf3"/><circle cx="63" cy="46" r="2" fill="#e4edf3"/>`;
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="8" fill="#f1f4f8"/>${device}</svg>`);
}
function metricsFor(p){const js=journeys.filter(j=>j.p.id===p.id&&matching(j,productApplied)),m={p};
 const get=s=>js.filter(j=>j.depth>=s&&(s!==9||merchantAccepted(j))&&inRange(j.times[s],productApplied));
 const pair=(name,rs,raw)=>{m[name+'Uv']=unique(rs);m[name+'Raw']=rs.reduce((n,j)=>n+raw(j),0)};
 const exposures=js.filter(j=>(j.login||j.success)&&!j.direct&&inRange(j.login?j.entry:j.times[4],productApplied));
 pair('exposure',exposures,()=>1);
 const visits=rentalRecords(productApplied,p.id);m.browseUv=unique(visits.filter(j=>j.depth>=1));m.browseRaw=rentalViews(visits);
 m.amount=get(9).reduce((c,j)=>c+estimatedRentalCents(j),0)/100;
 [['order',7],['deal',9]].forEach(([name,s])=>pair(name,get(s),()=>1));
 m.exposureVisitUv=unique(exposures.filter(j=>j.depth>=1&&inRange(j.times[1],productApplied)));m.ctr=m.exposureUv?m.exposureVisitUv/m.exposureUv:null;m.dealRate=m.browseUv?m.dealUv/m.browseUv:null;
 m.activity=Object.entries(m).some(([k,v])=>k.endsWith('Raw')&&v>0);return m;
}
function visibleProducts(){return productDefs.filter(p=>selectedProduct(p,productApplied)).map(metricsFor).filter(m=>m.activity)}
function productTotals(rows){
 const total={};COLS.forEach(([key])=>{if(!['ctr','dealRate'].includes(key))total[key]=rows.reduce((sum,m)=>sum+(m[key]||0),0)});
 total.exposureUv=rows.reduce((sum,m)=>sum+m.exposureUv,0);
 total.amount=Math.round(total.amount*100)/100;
 total.exposureVisitUv=rows.reduce((sum,m)=>sum+m.exposureVisitUv,0);total.ctr=total.exposureUv?total.exposureVisitUv/total.exposureUv:null;
 total.dealRate=total.browseUv?total.dealUv/total.browseUv:null;return total;
}
function productValue(m,key){if(m[key]==null)return '—';return ['ctr','dealRate'].includes(key)?(m[key]==null?'—':(m[key]*100).toFixed(2)+'%'):key==='amount'?'¥'+money(m[key]):fmt(m[key])}
function productFormula(key){return key==='ctr'?'曝光用户中点击进入商品的去重人数 ÷ 商品曝光人数 × 100%':key==='dealRate'?'成交人数 ÷ 商品访问人数 × 100%':''}
function productMetricTip(key,total=false){
 const definitions={
 exposureRaw:'来源：小程序商品卡片曝光事件。统计期内授权登录后的商品卡片曝光量，重复曝光累加。',
 exposureUv:'来源：小程序商品卡片曝光事件。统计期内授权登录后看到该商品卡片的用户数，按用户去重。',
 browseUv:'来源：小程序授权后商品浏览事件。统计期内浏览该商品详情的用户数，按用户去重。',
 browseRaw:'来源：小程序授权后浏览事件。统计期内该租赁商品页面浏览量，重复浏览累加。',
 ctr:'来源：小程序商品卡片曝光与点击事件。公式：'+productFormula('ctr')+'。采用同一商品、同一统计期的曝光与点击数据。',
 orderUv:'来源：租赁订单。按订单创建时间统计，成功创建该商品待付款订单的用户数，按用户去重。',
 orderRaw:'来源：租赁订单。按订单创建时间统计，该商品成功创建的待付款订单数，按订单ID去重。',
 dealUv:'来源：租赁成交订单。按成交时间统计，该商品的成交买家数，按用户去重。',
 dealRaw:'来源：租赁成交订单。按成交时间统计，该商品的成交订单数，按订单ID去重。',
 amount:'来源：租赁成交订单。公式：统计期内该商品成交订单在成交时约定的租金总额之和，包含未来未收租金，不含押金。',
 dealRate:'来源：小程序授权后访问事件、租赁成交订单。公式：'+productFormula('dealRate')+'。'
 };
 if(total)return ['ctr','dealRate'].includes(key)?'合计公式：当前筛选全部商品的对应分子之和 ÷ 对应分母之和 × 100%，包含所有分页。\n'+definitions[key]:'合计范围：当前筛选全部商品的该列数值之和，包含所有分页；人数按各商品分别去重后求和。'+'\n'+definitions[key];
 return definitions[key];
}
function renderTable(){
 const rows=visibleProducts();
 rows.sort((a,b)=>((a[sortKey]??-1)-(b[sortKey]??-1))*sortDir||a.p.id.localeCompare(b.p.id));lastTable=rows;
 const size=pageSize,maxPage=Math.max(1,Math.ceil(rows.length/size));page=Math.min(page,maxPage);const cols=COLS.filter(([key])=>!hidden.has(key));
 $('#tableWrap').innerHTML=rows.length?`<table><thead><tr><th>商品名称</th>${cols.map(([key,label])=>`<th class="${key==='amount'?'amount-column':''}"><button data-sort="${key}" data-tooltip="${esc(productMetricTip(key))}" aria-label="按${label}排序"><span class="metric-dotted">${label}</span> ${sortKey===key?(sortDir===-1?'↓':'↑'):'↕'}</button></th>`).join('')}</tr></thead><tbody><tr class="product-total"><th scope="row"><span title="当前筛选下全部商品的各行数值求和，含所有分页；人数未跨商品去重。比率按合计分子÷合计分母重算。" class="metric-dotted">合计</span></th>${cols.map(([key])=>`<td class="${key==='amount'?'amount-column':''}" data-tooltip="${esc(productMetricTip(key,true))}">${productValue(productTotals(rows),key)}</td>`).join('')}</tr>${rows.slice((page-1)*size,page*size).map(m=>`<tr><td><div class="product-cell"><img src="${productImage(m.p)}" alt="${esc(m.p.name)}示意图" width="48" height="48"><div><span class="product-name">${esc(m.p.name)}</span><div class="product-id">商品ID：${m.p.id}</div></div></div></td>${cols.map(([key])=>`<td class="${key==='amount'?'amount-column':''}" data-tooltip="${esc(productMetricTip(key))}">${productValue(m,key)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<div class="empty">没有符合条件的示例数据。<br>可调整商品筛选条件。</div>';
 productPager.setState({total:rows.length,page,pageSize});
 $$('[data-sort]').forEach(b=>b.onclick=()=>{if(sortKey===b.dataset.sort)sortDir*=-1;else{sortKey=b.dataset.sort;sortDir=-1}renderTable()});
 bindMetricTips();
}
function parseIds(value){return [...new Set(value.trim().split(/[\s,，;；、]+/).filter(Boolean).map(id=>id.replace(/^SPU-/i,'')))]}
function applyProductFilters(){
 productApplied={...baseScope,start:applied.start,end:applied.end,category:$('#category').value,search:$('#search').value.trim(),ids:parseIds($('#productIds').value)};
 page=1;$('#filterStatus').textContent='';renderTable();$('#tableWrap').scrollLeft=0;
 const missing=productApplied.ids.filter(id=>!productDefs.some(p=>p.id===id));
 $('#idHint').textContent=missing.length?'未匹配商品ID：'+missing.join('、'):'';toast('商品数据已更新')
}
function renderMain(){
 renderFlow();renderDash();
}
$('#productFilters').addEventListener('submit',e=>{e.preventDefault();applyProductFilters()});
$('#resetFilters').onclick=()=>{$('#category').value='all';$('#search').value='';$('#productIds').value='';applyProductFilters()};
['category','search','productIds'].forEach(id=>$('#'+id).addEventListener('input',()=>{$('#filterStatus').textContent='筛选已修改，请查询'}));
function csvDownload(name,rows){const safe=v=>{const s=String(v??'');return '"'+(/^[=+@\-]/.test(s)?"'"+s:s).replace(/"/g,'""')+'"'};const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('已导出CSV（示例数据）')}
function meta(scope='main'){const range=scope==='product'?productApplied:applied;return [['说明','示例数据，非真实业务'],['统计模块',scope==='product'?'商品列表':'经营链路及看板'],['开始日期',range.start,'结束日期',range.end],['商品类目',range.category,'商品名称',range.search,'商品ID组合',range.ids.join('、')],['时间口径','Asia/Shanghai，按各指标对应的业务发生时间统计'],['范围说明',scope==='product'?'商品模块独立筛选；每件商品内按用户去重':'全部商品，仅按顶部时间筛选']]}
function rateExport(){return [['阶段转化率'],['环节','人数分子','人数分母','人数转化率/占比','量分子','量分母','量转化率/占比'],...flowRates().map(r=>[r.name,r.to.labels[0],r.from.labels[0],stageRate(r.from,r.to,0),r.to.labels[1],r.from.labels[1],stageRate(r.from,r.to,1)])]}
function funnelExport(){return [['经营链路：人数与量同时展示'],['层级','环节','人数指标','人数','量指标','量','单位','来源','备注'],...funnelStages().map(s=>[s.level,s.name,s.labels[0],s.values[0]==null?'—':s.values[0],s.labels[1],s.values[1]==null?'—':s.values[1],s.units[1],s.source,s.unavailable||s.note]),[],...rateExport()] }
function productExport(){
 const cols=COLS,total=productTotals(lastTable);
 const values=m=>cols.map(([k])=>['ctr','dealRate'].includes(k)?(m[k]==null?'—':(m[k]*100).toFixed(2)+'%'):(m[k]??'—'));
 return [['商品ID','商品名称','类目',...cols.map(c=>c[1])],['','合计','',...values(total)],...lastTable.map(m=>[m.p.id,m.p.name,m.p.cat,...values(m)])];
}
$('#exportProducts').onclick=()=>downloadExcel(`租赁商品数据_${productApplied.start}_${productApplied.end}_示例`,productExport());
function reportRows(){
 const original=applied,ids=funnelNodeOrder.filter(id=>selectedFunnelNodes.has(id));
 function snapshot(range){
  applied=range;
  const flow=makeFlow(),lookup=id=>flow.find(x=>x.id===id),d=dealSummary();
  const stages=ids.map(lookup).filter(Boolean);
  const basic=[d.amount,d.firstPayment,...lookup('deal').values, d.rate];
  for(const id of ['exposure','shop','group','miniTotal','rental','unlogged','order','verify','review','accept','ship','refund'])basic.push(...lookup(id).values);
  const rates=stages.slice(1).flatMap((stage,i)=>[stageRate(stages[i],stage,0),stageRate(stages[i],stage,1)]);
  const first=stages[0],last=stages[stages.length-1];
  return [...basic,...rates,stageRate(first,last,0),stageRate(first,last,1)];
 }
 const basicFields=['成交金额（预估）','首期支付金额','成交买家数','成交订单数','成交转化率',...['exposure','shop','group','miniTotal','rental','unlogged','order','verify','review','accept','ship','refund'].flatMap(id=>lastFlow.find(s=>s.id===id).labels)];
 const labels=['统计时间','成交金额（预估）','首期支付金额','成交买家数','成交订单数','成交转化率',...['exposure','shop','group','miniTotal','rental','unlogged','order','verify','review','accept','ship','refund'].flatMap(id=>lastFlow.find(s=>s.id===id).labels),...ids.slice(1).flatMap((id,i)=>[`${funnelNodeNames[ids[i]]}→${funnelNodeNames[id]}转化率（人数）`,`${funnelNodeNames[ids[i]]}→${funnelNodeNames[id]}转化率（量）`]),`${funnelNodeNames[ids[0]]}→${funnelNodeNames[ids.at(-1)]}整体转化率（人数）`,`${funnelNodeNames[ids[0]]}→${funnelNodeNames[ids.at(-1)]}整体转化率（量）`];
 try{
  const rows=[labels,['合计',...snapshot(original)]];
  for(let day=stamp(original.start);day<=stamp(original.end);day+=DAY){const date=dateLabel(day);rows.push([date,...snapshot({...original,start:date,end:date})])}
  const visibleColumns=[0,...basicFields.flatMap((label,i)=>dashboardFields.has(label)?[i+1]:[]),...Array.from({length:labels.length-basicFields.length-1},(_,i)=>basicFields.length+1+i)];
  return rows.map(row=>visibleColumns.map(i=>row[i]));
 }finally{applied=original}
}
function xlsxBytes(rows){
 const encode=new TextEncoder(),xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const col=n=>{let x='';for(n++;n;n=Math.floor((n-1)/26))x=String.fromCharCode(65+(n-1)%26)+x;return x};
 const sheetRows=rows.map((row,r)=>`<row r="${r+1}">${row.map((v,c)=>{const ref=col(c)+(r+1),style=r===0?1:r===1?2:0;if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(v??'—')}</t></is></c>`}).join('')}</row>`).join('');
 const files={
  '[Content_Types].xml':`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  '_rels/.rels':`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  'xl/workbook.xml':`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="看板与漏斗" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  'xl/_rels/workbook.xml.rels':`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  'xl/styles.xml':`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDEFF0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  'xl/worksheets/sheet1.xml':`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="16" customWidth="1"/><col min="2" max="${rows[0].length}" width="27" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${col(rows[0].length-1)}${rows.length}"/></worksheet>`
 };
 function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
 const locals=[],central=[];let offset=0;
 function header(size){const buf=new Uint8Array(size);return [buf,new DataView(buf.buffer)]}
 for(const [name,content] of Object.entries(files)){
  const filename=encode.encode(name),data=encode.encode(content),checksum=crc(data),[local,l]=header(30);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint32(14,checksum,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,filename.length,true);locals.push(local,filename,data);
  const [entry,e]=header(46);e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x800,true);e.setUint32(16,checksum,true);e.setUint32(20,data.length,true);e.setUint32(24,data.length,true);e.setUint16(28,filename.length,true);e.setUint32(42,offset,true);central.push(entry,filename);offset+=local.length+filename.length+data.length;
 }
 const centralSize=central.reduce((n,b)=>n+b.length,0),[end,e]=header(22);e.setUint32(0,0x06054b50,true);e.setUint16(8,Object.keys(files).length,true);e.setUint16(10,Object.keys(files).length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
 const chunks=[...locals,...central,end],out=new Uint8Array(chunks.reduce((n,b)=>n+b.length,0));let at=0;for(const chunk of chunks){out.set(chunk,at);at+=chunk.length}return out;
}
function downloadExcel(name,rows){
 const bytes=xlsxBytes(rows),blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name+'.xlsx';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1000);toast('已导出数据');
}
$('#exportDashboard').onclick=()=>downloadExcel(`数据看板与漏斗_${applied.start}_${applied.end}_示例`,reportRows());
const helps={
 products:['商品指标口径','<p>访问与浏览统计授权登录后的租赁商品行为。商品访问人数按用户去重，浏览量按页面展示事件累加。</p><p>成交金额（预估）为统计期内成交订单在成交时约定的租金总额，包含未来未收租金，不含押金。商品访问-成交转化率=该商品成交买家数÷商品访问人数×100%。</p><p>全局时间联动看板、漏斗和商品数据；商品类目、名称及商品ID筛选用于列表与商品导出。多个商品ID按或匹配、类目名称按且匹配；每件商品内按用户去重。</p><p>商品曝光-访问点击率=曝光用户中点击进入商品的去重人数÷商品曝光人数×100%；商品访问-成交转化率=成交人数÷商品访问人数。合计为当前筛选全部商品各行求和，包含所有分页；人数未跨商品去重，比率用合计分子÷合计分母重算。</p>'],
 funnel:['漏斗与宽度计算','<p>按需选择店铺曝光、店铺访问、小程序访问、已登录访问、下单、认证通过、平台审核通过、商家接单及首期支付成功等节点，按业务顺序展示。小程序访问包含已登录与未登录，人数按统计期内是否关联登录用户ID分组，访问量按行为发生时的登录状态统计。人数按访客去重；量按事件或订单统计。</p><p>每层宽度=当前层所选指标÷各层所选指标最大值×绘图区宽度。0值宽度为0，缺失显示“—”。</p><p>阶段转化率=下一步指标÷上一步指标×100%。人数按各节点的用户分别去重，量按各节点的访问事件或订单统计；取当前所选时间内的数据。</p>'],
 dashboard:['数据来源与统计口径','<p>店铺曝光、访问与浏览来源于美团平台；团购访问人数来源于美团后台团购报表；小程序访问与浏览来源于已登录及未登录行为事件；下单与成交来源于租赁订单。</p><p>小程序访问人数按统计期内是否关联登录用户ID分组去重，访问量按行为发生时的登录状态统计；浏览量按事件累加，订单数按订单ID去重。</p><p>成交金额（预估）=统计期内成交订单在成交时约定的租金总额之和，包含未来未收租金，不含押金；来源：支付成功流水。按首期支付成功时间汇总所选时间内的首期实付租金，支付流水去重；含主动支付及代扣，不含押金、后续期款，不扣减退款。当前所选时间内，首期支付成功的去重买家数 ÷ 小程序总访问人数 × 100%。小程序总访问人数为未登录访问人数与已登录访问人数之和。</p>']};
function bindHelp(){$$('[data-help]').forEach(b=>b.onclick=()=>{const [t,h]=helps[b.dataset.help];showDialog(t,h)})}
$$('.sidebar nav a').forEach(a=>a.onclick=()=>{$$('.sidebar nav a').forEach(x=>x.classList.toggle('active',x===a))});
const obs=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)$$('.sidebar nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+e.target.id))},{rootMargin:'-10% 0px -60% 0px'});['dashboard','funnel','products'].forEach(id=>obs.observe($('#'+id)));
globalPicker=new RentalDatePicker($('#globalDate'),{label:'全局统计时间',onChange:value=>{applied={...applied,start:value.start,end:value.end};productApplied={...productApplied,start:value.start,end:value.end};page=1;renderMain();renderTable()}});
productPager=new PrototypePagination($('#productPagination'),{pageSize,onChange:state=>{page=state.page;pageSize=state.pageSize;renderTable()}});
renderMain();renderTable();bindHelp();

const stickyTimeBar=$('#globalTimeBar');
new ResizeObserver(()=>document.documentElement.style.setProperty('--sticky-filter-height',stickyTimeBar.offsetHeight+'px')).observe(stickyTimeBar);
