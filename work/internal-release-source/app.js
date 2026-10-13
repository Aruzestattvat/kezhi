const STORAGE_ORDERS='tutor-value-orders-v1';
const STORAGE_SETTINGS='tutor-value-settings-v1';
const STORAGE_GROUPS='tutor-value-groups-v1';
const STORAGE_FAVORITES='tutor-value-favorites-v1';
const defaults={mapProvider:'amap',travelMode:'taxi',ak:'',amapKey:'',teacherGender:'any',origin:'嘉兴大学梁林校区',city:'嘉兴市',maxOneWayKm:20,bufferMinutes:20,defaultHours:2,minimumNet:60};
const demoOrders=[
  {id:'demo-1',demo:true,source:'演示数据',rawText:'初二数学，地点巴黎都市，周六下午2点到4点，120元/小时',grade:'初二',subject:'数学',address:'巴黎都市',hourlyRate:120,hours:2,assumedHours:false,durationSource:'time-range',durationMatched:'周六下午2点到4点',weeklyTimes:1,schedule:'周六下午2点到4点',travelMode:'taxi',travelCost:48,taxiCost:48,distanceKm:15.6,driveMinutes:42,routeSource:'demo',createdAt:new Date().toISOString()},
  {id:'demo-2',demo:true,source:'演示数据',rawText:'高一物理，江南摩尔附近，周日19:00-21:30，150元每小时，每周2次',grade:'高一',subject:'物理',address:'江南摩尔',hourlyRate:150,hours:2.5,assumedHours:false,durationSource:'time-range',durationMatched:'周日19:00-21:30',weeklyTimes:2,schedule:'周日19:00-21:30',travelMode:'taxi',travelCost:72,taxiCost:72,distanceKm:23.2,driveMinutes:58,routeSource:'demo',createdAt:new Date().toISOString()},
  {id:'demo-3',demo:true,source:'演示数据',rawText:'六年级英语，禾源新都，100元/小时，时间可协商',grade:'六年级',subject:'英语',address:'禾源新都',hourlyRate:100,hours:2,assumedHours:true,durationSource:'default',weeklyTimes:1,schedule:'时间可协商',taxiCost:null,distanceKm:null,driveMinutes:null,routeSource:null,createdAt:new Date().toISOString()}
];

const state={settings:{...defaults,...load(STORAGE_SETTINGS,defaults)},orders:load(STORAGE_ORDERS,demoOrders),groups:load(STORAGE_GROUPS,[]),favorites:load(STORAGE_FAVORITES,[]),selectedId:null,filter:'all',groupFilter:'all',pendingDeleteGroup:null,search:'',calculating:new Set(),bulk:{active:false,done:0,total:0}};
const $=selector=>document.querySelector(selector);
const els={stats:$('#stats'),list:$('#order-list'),detail:$('#detail-panel'),count:$('#result-count'),search:$('#search'),toast:$('#toast'),bulkButton:$('#bulk-recalculate'),groupRecalculate:$('#group-recalculate'),groupDelete:$('#group-delete'),groupFilter:$('#group-filter'),teacherGender:$('#teacher-gender'),importGroupSelect:$('#import-group-select'),newGroupField:$('#new-group-field'),groupPages:$('#group-pages'),groupsDialog:$('#groups-dialog'),deleteGroupDialog:$('#delete-group-dialog'),deleteGroupTitle:$('#delete-group-title'),deleteGroupMessage:$('#delete-group-message'),deleteGroupToo:$('#delete-group-too'),clearAllDialog:$('#clear-all-dialog'),clearAllTitle:$('#clear-all-title'),clearAllGroups:$('#clear-all-groups'),clearAllFavorites:$('#clear-all-favorites'),importDialog:$('#import-dialog'),settingsDialog:$('#settings-dialog'),editDialog:$('#edit-dialog'),editForm:$('#edit-form')};

function load(key,fallback){try{const value=JSON.parse(localStorage.getItem(key));return value??structuredClone(fallback)}catch{return structuredClone(fallback)}}
function save(){state.favorites=state.favorites.map(favorite=>{const current=state.orders.find(order=>order.id===favorite.id);return current?{...structuredClone(current),favoritedAt:favorite.favoritedAt||new Date().toISOString()}:favorite});localStorage.setItem(STORAGE_ORDERS,JSON.stringify(state.orders));localStorage.setItem(STORAGE_SETTINGS,JSON.stringify(state.settings));localStorage.setItem(STORAGE_GROUPS,JSON.stringify(state.groups));localStorage.setItem(STORAGE_FAVORITES,JSON.stringify(state.favorites))}
function esc(value=''){return String(value).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function num(value){if(value===null||value===undefined||String(value).trim()==='')return null;const n=Number(value);return Number.isFinite(n)?n:null}
function money(value){return Number.isFinite(value)?`¥${Math.round(value)}`:'待计算'}
function travelModeLabel(mode=state.settings.travelMode){return({taxi:'打车',transit:'公交车',ebike:'共享电单车',bicycle:'自行车',free:'自由出行'})[mode]||'打车'}
function routeProvider(mode=state.settings.travelMode){return['transit','ebike','bicycle'].includes(mode)?'amap':state.settings.mapProvider}
function routeProviderName(mode=state.settings.travelMode){return providerName(routeProvider(mode))}
function activeRouteKey(mode=state.settings.travelMode){return routeProvider(mode)==='amap'?state.settings.amapKey:state.settings.ak}
function orderTravelMode(order){return order.travelMode||'taxi'}
function orderTravelCost(order){if(order.transportCovered)return 0;if(Number.isFinite(order.travelCost))return order.travelCost;if(orderTravelMode(order)==='taxi'&&Number.isFinite(order.taxiCost))return order.taxiCost;return null}
function travelCostIsValid(order){const cost=orderTravelCost(order);return Number.isFinite(cost)&&cost>=0&&(cost>0||order.transportCovered||orderTravelMode(order)==='free')}
function roundRouteValues(order){if(Number.isFinite(order.distanceKm))order.distanceKm=Math.round(order.distanceKm*10)/10;if(Number.isFinite(order.driveMinutes))order.driveMinutes=Math.round(order.driveMinutes);return order}
const routeResultFields=['travelCost','taxiCost','distanceKm','driveMinutes','resolvedMapAddress','routeSource','routeError','geoConfidence','geoLevel','roundTripEstimated','transitBoardingsOneWay','transitTransfersOneWay','transitWalkingMetersOneWay','transitLegs','updatedAt'];
function routeFingerprint(order,mode){return [mode,routeProvider(mode),state.settings.origin,state.settings.city,order.address].map(value=>String(value||'').trim().toLowerCase()).join('|')}
function cacheCurrentRoute(order,mode=orderTravelMode(order)){
  if(!Number.isFinite(order.driveMinutes)||!travelCostIsValid(order))return false;const snapshot={fingerprint:routeFingerprint(order,mode)};routeResultFields.forEach(key=>snapshot[key]=key==='transitLegs'?(Array.isArray(order[key])?order[key].map(item=>({...item})):[]):order[key]??null);order.routeResults=order.routeResults&&typeof order.routeResults==='object'?order.routeResults:{};order.routeResults[mode]=snapshot;return true;
}
function clearActiveRoute(order,mode,reason){order.travelMode=mode;order.travelCost=mode==='free'||order.transportCovered?0:null;order.taxiCost=mode==='taxi'&&order.transportCovered?0:null;order.distanceKm=null;order.driveMinutes=null;order.resolvedMapAddress=null;order.routeSource=null;order.geoConfidence=null;order.geoLevel=null;order.roundTripEstimated=null;order.transitLegs=[];order.transitBoardingsOneWay=null;order.transitTransfersOneWay=null;order.transitWalkingMetersOneWay=null;order.updatedAt=null;order.routeError=reason}
function restoreCachedRoute(order,mode){
  const snapshot=order.routeResults?.[mode];if(!snapshot||snapshot.fingerprint!==routeFingerprint(order,mode)||!Number.isFinite(snapshot.driveMinutes))return false;routeResultFields.forEach(key=>order[key]=key==='transitLegs'?(Array.isArray(snapshot[key])?snapshot[key].map(item=>({...item})):[]):snapshot[key]??null);roundRouteValues(order);snapshot.distanceKm=order.distanceKm;snapshot.driveMinutes=order.driveMinutes;order.travelMode=mode;if(order.transportCovered)order.travelCost=0;if(mode==='free')order.travelCost=0;order.taxiCost=mode==='taxi'?order.travelCost:null;return travelCostIsValid(order);
}
function travelMoney(order){const value=orderTravelCost(order);if(order.transportCovered)return'¥0（报销）';if(Number.isFinite(value)&&value>=0)return`¥${Math.round(value)}`;return'待计算'}
function fixed(value,digits=1){return Number.isFinite(value)?Number(value).toFixed(digits):'—'}
function uniqueId(){return crypto.randomUUID?.()||`order-${Date.now()}-${Math.random().toString(16).slice(2)}`}
function normalizeRaw(text){return text.replace(/\s+/g,'').replace(/[，,。；;：:]/g,'').toLowerCase()}
function toast(message){els.toast.textContent=message;els.toast.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>els.toast.classList.remove('show'),2600)}
function providerName(provider=state.settings.mapProvider){return provider==='amap'?'高德地图':'百度地图'}
function activeMapKey(){return state.settings.mapProvider==='amap'?state.settings.amapKey:state.settings.ak}

function derive(order){
  const income=Number.isFinite(order.totalPrice)?order.totalPrice:Number.isFinite(order.hourlyRate)&&Number.isFinite(order.hours)?order.hourlyRate*order.hours:null;
  const travelCost=orderTravelCost(order),validTravelCost=travelCostIsValid(order);
  const cashNet=Number.isFinite(income)&&validTravelCost?income-travelCost:null;
  const totalHours=Number.isFinite(order.hours)&&Number.isFinite(order.driveMinutes)?order.hours+order.driveMinutes/60+state.settings.bufferMinutes/60:null;
  const netHourly=Number.isFinite(cashNet)&&totalHours>0?cashNet/totalHours:null;
  const monthlyNet=Number.isFinite(cashNet)?cashNet*(order.weeklyTimes||1)*4.33:null;
  const ratio=Number.isFinite(income)&&validTravelCost?(travelCost===0?Infinity:income/travelCost):null;
  const missing=[];
  if(!order.grade)missing.push('年级');if(!order.subject)missing.push('科目');if(!order.address)missing.push('地址');else if(order.addressAmbiguous)missing.push('地址确认');if(!Number.isFinite(order.hourlyRate))missing.push('单价');if(!Number.isFinite(order.hours))missing.push('授课时长');else if(order.assumedHours)missing.push('授课时长确认');if(!validTravelCost)missing.push(Number.isFinite(travelCost)?'地图费用异常':'地图费用');
  return {...order,travelCost,income,cashNet,totalHours,netHourly,monthlyNet,ratio,missing};
}

function eligibilityPassReason(order){
  const employed=typeof order.requiresEmployedTeacher==='boolean'?order.requiresEmployedTeacher:TutorParser.requiresEmployedTeacher(order.rawText||'');if(employed)return'要求专职/在职老师';
  const required=order.teacherGenderRequirement||TutorParser.parseTeacherGenderRequirement(order.rawText||'');
  if(state.settings.teacherGender!=='any'&&required!=='any'&&required!==state.settings.teacherGender)return required==='female'?'仅限女老师':'仅限男老师';
  return'';
}
function passReason(order){const eligibility=eligibilityPassReason(order);if(eligibility)return eligibility;const oneWay=Number.isFinite(order.distanceKm)?order.distanceKm/2:null,max=Number(state.settings.maxOneWayKm)||20;return Number.isFinite(oneWay)&&oneWay>max?`单程 ${fixed(oneWay,1)} km，超过 ${fixed(max,0)} km`:''}
function routeComplete(order){return orderTravelMode(order)===(state.settings.travelMode||'taxi')&&Number.isFinite(order.driveMinutes)&&travelCostIsValid(order)}
function mapQueryAddress(address){const value=String(address||'').trim(),city=String(state.settings.city||'').trim(),cityStem=city.replace(/(?:市|地区|自治州|盟)$/,'');if(!value||!city)return value;return value.includes(city)||(cityStem&&value.includes(cityStem))?value:`${city}${value}`}
function findOrder(id){return state.orders.find(order=>order.id===id)||state.favorites.find(order=>order.id===id)}
function isFavorite(id){return state.favorites.some(order=>order.id===id)}
function toggleFavorite(id){
  const order=findOrder(id);if(!order)return;
  if(isFavorite(id)){state.favorites=state.favorites.filter(item=>item.id!==id);if(state.filter==='favorites')state.selectedId=null;save();render();toast('已取消收藏');return}
  state.favorites.push({...structuredClone(order),favoritedAt:new Date().toISOString()});save();render();toast('已加入收藏夹');
}

function tier(order){
  if(passReason(order))return {tone:'warn',label:'已 PASS'};
  const o=derive(order),min=state.settings.minimumNet;
  if(o.missing.length||!Number.isFinite(o.netHourly))return {tone:'pending',label:'待确认'};
  if(o.netHourly>=min*1.35)return {tone:'best',label:'很划算'};
  if(o.netHourly>=min)return {tone:'good',label:'值得联系'};
  return {tone:'warn',label:'低于门槛'};
}

function sortedOrders(){
  const query=state.search.trim().toLowerCase(),favoritesOnly=state.filter==='favorites',collection=favoritesOnly?state.favorites:state.orders;
  return collection.map(derive).filter(o=>{
    const reason=passReason(o),t=tier(o);
    if(state.groupFilter!=='all'&&o.source!==state.groupFilter)return false;
    if(favoritesOnly){/* 收藏夹保留所有收藏快照，包括后来变成 PASS 的订单。 */}
    else if(state.filter==='passed'){if(!reason)return false}else{
      if(reason)return false;
      if(state.filter==='ready'&&!(t.tone==='best'||t.tone==='good'))return false;
      if(state.filter==='pending'&&t.tone!=='pending')return false;
    }
    return !query||[o.orderCode,o.grade,o.subject,o.address,o.source,o.schedule].join(' ').toLowerCase().includes(query);
  }).sort((a,b)=>favoritesOnly?new Date(b.favoritedAt||b.createdAt)-new Date(a.favoritedAt||a.createdAt):(b.netHourly??-Infinity)-(a.netHourly??-Infinity)||new Date(b.createdAt)-new Date(a.createdAt));
}

function groupSources(){return [...new Set([...state.groups,...state.orders.filter(o=>!o.demo).map(o=>o.source||'未命名群')].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN'))}
function renderGroupControls(){
  const groups=groupSources();if(state.groupFilter!=='all'&&!groups.includes(state.groupFilter))state.groupFilter='all';
  els.teacherGender.value=state.settings.teacherGender||'any';
  els.groupFilter.innerHTML=`<option value="all">全部群聊（${state.orders.filter(o=>!o.demo).length}）</option>`+groups.map(group=>`<option value="${esc(group)}">${esc(group)}（${state.orders.filter(o=>!o.demo&&o.source===group).length}）</option>`).join('');
  els.groupFilter.value=state.groupFilter;
  const pages=[{name:'all',label:'全部群聊',orders:state.orders.filter(o=>!o.demo)},...groups.map(group=>({name:group,label:group,orders:state.orders.filter(o=>!o.demo&&o.source===group)}))];
  els.groupPages.innerHTML=pages.map(page=>{const passed=page.orders.filter(o=>passReason(o)).length,pending=page.orders.filter(o=>!passReason(o)&&!routeComplete(o)).length;return `<button type="button" class="group-page ${state.groupFilter===page.name?'active':''}" data-group-source="${esc(page.name)}"><span><strong>${esc(page.label)}</strong><small> · ${page.orders.length} 条订单</small></span><small>${pending?`${pending} 条待计算`:passed?`${passed} 条已 PASS`:'已全部计算'}</small></button>`}).join('')||'<div class="empty-state"><strong>还没有群聊页面</strong><span>导入消息时填写来源群别名即可自动创建。</span></div>';
}

function groupRouteCandidates(group=state.groupFilter){return group==='all'?[]:state.orders.filter(o=>!o.demo&&o.source===group&&!eligibilityPassReason(o)&&o.address&&!o.addressAmbiguous)}
function renderGroupRecalculate(){
  if(!els.groupRecalculate)return;const candidates=groupRouteCandidates(),groupCount=state.groupFilter==='all'?0:state.orders.filter(o=>!o.demo&&o.source===state.groupFilter).length;
  els.groupRecalculate.disabled=state.bulk.active||state.groupFilter==='all'||candidates.length===0;
  els.groupRecalculate.textContent=state.bulk.active?'↻ 计算中…':state.groupFilter==='all'?'↻ 先选择群聊':candidates.length?`↻ 重算本群（${candidates.length}）`:'✓ 本群无可计算订单';
  if(els.groupDelete){els.groupDelete.disabled=state.bulk.active||state.groupFilter==='all';els.groupDelete.textContent=state.groupFilter==='all'?'清空本群订单':`清空本群订单（${groupCount}）`}
}
function renderImportGroups(){
  const groups=groupSources(),current=els.importGroupSelect.value,preferred=state.groupFilter!=='all'&&groups.includes(state.groupFilter)?state.groupFilter:groups.includes(current)?current:'__new__';
  els.importGroupSelect.innerHTML='<option value="__new__">＋ 新建群聊</option>'+groups.map(group=>`<option value="${esc(group)}">${esc(group)}</option>`).join('');
  els.importGroupSelect.value=preferred;els.newGroupField.hidden=preferred!=='__new__';
}
function selectedImportSource(){return els.importGroupSelect.value==='__new__'?$('#source-group').value.trim()||'未命名群':els.importGroupSelect.value}

function renderStats(){
  const active=state.orders.filter(o=>!passReason(o)),passed=state.orders.length-active.length;
  const calculated=active.map(derive).filter(o=>Number.isFinite(o.netHourly));
  const best=[...calculated].sort((a,b)=>b.netHourly-a.netHourly)[0];
  const worthwhile=calculated.filter(o=>o.netHourly>=state.settings.minimumNet).length;
  const average=calculated.length?Math.round(calculated.reduce((sum,o)=>sum+o.driveMinutes,0)/calculated.length/2):0;
  els.stats.innerHTML=`<article class="hero-stat"><p>今日最优净时薪</p><strong><span>¥</span>${best?Math.round(best.netHourly):'—'}</strong><small>已扣除${travelModeLabel()}估算往返费用</small></article><article class="mini-stat"><span>符合条件</span><strong>${active.length}</strong><small>${passed?`已自动 PASS ${passed} 条`:state.orders.filter(o=>o.demo).length?'含演示数据':'保存在本机'}</small></article><article class="mini-stat"><span>值得联系</span><strong>${worthwhile}</strong><small>净时薪 ≥ ¥${state.settings.minimumNet}</small></article><article class="mini-stat"><span>平均通勤</span><strong>${average||'—'}</strong><small>分钟 / 单程</small></article>`;
}

function renderList(){
  const orders=sortedOrders();
  if(!orders.some(o=>o.id===state.selectedId))state.selectedId=orders[0]?.id||null;
  els.count.textContent=`${orders.length} 条`;
  if(!orders.length){els.list.innerHTML=`<div class="empty-state"><strong>没有符合条件的订单</strong><span>调整筛选条件，或导入新的群消息。</span></div>`;return}
  els.list.innerHTML=orders.map((o,index)=>{
    const t=tier(o),reason=passReason(o),loading=state.calculating.has(o.id);
    const rate=Number.isFinite(o.hourlyRate)?`¥${fixed(o.hourlyRate,0)}${Number.isFinite(o.hourlyRateMax)&&o.hourlyRateMax>o.hourlyRate?`–${fixed(o.hourlyRateMax,0)}`:''}/h`:'—';
    const hours=Number.isFinite(o.hours)?`${fixed(o.hours,1)}${Number.isFinite(o.hoursMax)&&o.hoursMax>o.hours?`–${fixed(o.hoursMax,1)}`:''}h${o.assumedHours?'（默认）':''}`:'—';
    const frequency=`每周 ${fixed(o.weeklyTimes||1,0)}${Number.isFinite(o.weeklyTimesMax)&&o.weeklyTimesMax>o.weeklyTimes?`–${fixed(o.weeklyTimesMax,0)}`:''}次`;
    return `<article class="order-card ${o.id===state.selectedId?'selected':''}" data-order-id="${esc(o.id)}" tabindex="0"><div class="rank">${String(index+1).padStart(2,'0')}</div><div class="order-main"><div class="order-title"><h3>${esc(o.grade||'年级待确认')} · ${esc(o.subject||'科目待确认')}</h3><span class="tag ${t.tone}">${loading?'<span class="loading-dot"></span> 计算中':t.label}</span>${reason?`<span class="tag warn">${esc(reason)}</span>`:''}${isFavorite(o.id)?'<span class="tag good">★ 已收藏</span>':''}${o.transportCovered?'<span class="tag good">路费报销</span>':''}<span class="tag pending">${travelModeLabel(orderTravelMode(o))}</span>${o.orderCode?`<span class="tag pending">#${esc(o.orderCode)}</span>`:''}${o.demo?'<span class="tag pending">演示</span>':''}${o.durationSource==='time-range'?'<span class="tag good">时间推算</span>':''}${o.durationSource==='duration-range'?'<span class="tag pending">区间按下限</span>':''}</div><p>${esc(o.address||'地址待确认')}${o.addressAmbiguous?'（需确认具体地点）':''} · ${esc(o.schedule||'时间待确认')}</p><div class="metrics"><span>课时价 <b>${rate}</b></span><span>授课 <b>${hours}</b></span><span>${frequency}</span><span>往返 <b>${fixed(o.distanceKm)} km</b></span><span>出行费 <b>${travelMoney(o)}</b></span></div></div><div class="net"><small>实际净时薪</small><strong>${money(o.netHourly)}</strong><span>/ 小时</span></div></article>`;
  }).join('');
  els.list.querySelectorAll?.('.order-card').forEach(card=>{const id=card.dataset.orderId,favorite=isFavorite(id);card.querySelector('.net')?.insertAdjacentHTML('beforeend',`<div class="mini-actions"><button type="button" class="mini-copy" data-copy-order="${esc(id)}">复制完整信息</button><button type="button" class="mini-favorite ${favorite?'active':''}" data-favorite-order="${esc(id)}">${favorite?'★ 取消收藏':'☆ 收藏'}</button></div>`)});
}

function renderDetail(){
  const sourceOrder=findOrder(state.selectedId),o=derive(sourceOrder||{}),favoriteOnly=Boolean(sourceOrder&&!state.orders.some(item=>item.id===sourceOrder.id));
  if(!o.id){els.detail.innerHTML=`<div class="empty-state"><strong>还没有订单</strong><span>导入群消息后，这里会显示路线与收益。</span></div>`;return}
  const loading=state.calculating.has(o.id),confidence=o.geoConfidence?`地址可信度 ${o.geoConfidence}`:'地址待地图确认',queryAddress=mapQueryAddress(o.address);
  const durationLabel=o.durationSource==='time-range'?'具体时间推算':o.durationSource==='duration-range'?'时长区间（按下限计算）':o.durationSource==='explicit-duration'?'文本明确给出':o.durationSource==='manual'?'人工确认':o.assumedHours?'默认值待确认':'已有记录';
  const mode=orderTravelMode(o),transitLegs=Array.isArray(o.transitLegs)?o.transitLegs:[],transitHtml=mode==='transit'&&transitLegs.length?`<div class="transit-plan"><strong>单程公交方案</strong>${transitLegs.map((leg,index)=>`<div><span>${index+1}. ${esc(String(leg.line||'公交线路').replace(/\(.*/,''))}</span><small>${esc(leg.departureStop||'上车站待确认')} → ${esc(leg.arrivalStop||'下车站待确认')}</small></div>`).join('')}<p>单程乘车 ${o.transitBoardingsOneWay||transitLegs.length} 次，换乘 ${o.transitTransfersOneWay||0} 次${Number.isFinite(o.transitWalkingMetersOneWay)?`，步行约 ${Math.round(o.transitWalkingMetersOneWay)} 米`:''}</p></div>`:'';
  const pricingNote=mode==='transit'?'公交费用按每次乘车 ¥2 估算，单程乘车次数乘二作为往返费用。':mode==='ebike'?'共享电单车按单程分别计费：10 分钟内 ¥2，之后每开始 10 分钟加 ¥1.5。':mode==='bicycle'?'自行车补给按单程分别估算：每开始 5 公里 ¥5；单程达到 10 公里再加 ¥10 零食。':mode==='free'?'自由出行费用固定为 ¥0；地图提供的驾车时长仅作为通勤时间参考。':'';
  const detailActions=favoriteOnly?`<div class="detail-actions"><button class="dark-button" data-favorite-order="${esc(o.id)}">★ 从收藏夹移除</button></div>`:`<div class="detail-actions"><button class="dark-button" data-action="recalculate">${loading?'计算中…':'重新计算路线'}</button><button class="ghost-button" data-action="open-edit">编辑</button></div>`;
  els.detail.innerHTML=`<div class="route-top"><span class="map-pin">●</span><span>${favoriteOnly?'收藏快照':loading?`正在查询${routeProviderName(mode)}${travelModeLabel(mode)}路线…`:o.routeSource==='manual'?'手动补充费用':`${routeProviderName(mode)} · ${travelModeLabel(mode)}估算`}</span></div><div class="route-line origin"><i></i><div><small>出发点</small><strong>${esc(state.settings.origin)}</strong></div></div><div class="route-line destination"><i></i><div><small>当前订单 · ${esc(confidence)}</small><strong>${esc(o.address||'地址待确认')}${o.addressAmbiguous?'（需确认）':''}</strong>${queryAddress?`<small>地图查询：${esc(queryAddress)}</small>`:''}${o.resolvedMapAddress?`<small>地图定位：${esc(o.resolvedMapAddress)}</small>`:''}</div></div><div class="route-summary"><div><span>出行方式</span><b>${travelModeLabel(mode)}</b></div><div><span>往返用时</span><b>${Number.isFinite(o.driveMinutes)?`${Math.round(o.driveMinutes)} 分钟`:'—'}</b></div><div><span>授课时长</span><b>${Number.isFinite(o.hours)?`${fixed(o.hours,1)}${Number.isFinite(o.hoursMax)&&o.hoursMax>o.hours?`–${fixed(o.hoursMax,1)}`:''} 小时`:'—'}</b></div><div><span>时长来源</span><b>${durationLabel}</b></div><div><span>往返出行费</span><b>${travelMoney(o)}</b></div><div><span>课时收入</span><b>${money(o.income)}</b></div><div><span>净现金收益</span><b>${money(o.cashNet)}</b></div><div><span>预计月净收益</span><b>${money(o.monthlyNet)}</b></div><div><span>投入产出比</span><b>${o.ratio===Infinity?'∞':Number.isFinite(o.ratio)?`${fixed(o.ratio,1)}×`:'—'}</b></div><div><span>往返距离</span><b>${Number.isFinite(o.distanceKm)?`${fixed(o.distanceKm)} km`:'—'}</b></div></div>${transitHtml}${o.routeError?`<p class="privacy-note" style="color:#a44234">${esc(o.routeError)}</p>`:''}${o.transportCovered?'<p class="privacy-note">文本识别到路费报销或车费补贴，个人交通支出按 ¥0 计算；地图路线仍用于计算通勤时间。</p>':pricingNote?`<p class="privacy-note">${pricingNote}</p>`:''}${(Number.isFinite(o.hourlyRateMax)&&o.hourlyRateMax>o.hourlyRate)||(Number.isFinite(o.hoursMax)&&o.hoursMax>o.hours)||(Number.isFinite(o.weeklyTimesMax)&&o.weeklyTimesMax>o.weeklyTimes)?'<p class="privacy-note">薪资、时长或频次为区间时，收益排名按下限保守计算。</p>':''}${detailActions}<p class="privacy-note">${favoriteOnly?`收藏于 ${new Date(o.favoritedAt||o.createdAt).toLocaleString('zh-CN')}`:o.updatedAt?`路线更新于 ${new Date(o.updatedAt).toLocaleString('zh-CN')}`:'群聊原文仅保存在此设备'}</p>`;
}

function pendingRouteOrders(){return state.orders.filter(o=>!o.demo&&!eligibilityPassReason(o)&&!routeComplete(o))}
function actionablePendingRouteOrders(){return pendingRouteOrders().filter(o=>o.address&&!o.addressAmbiguous)}
function renderBulkButton(){if(!els.bulkButton)return;const pending=actionablePendingRouteOrders().length;els.bulkButton.disabled=state.bulk.active||pending===0;els.bulkButton.textContent=state.bulk.active?`↻ 正在补算 ${state.bulk.done}/${state.bulk.total}`:pending?`↻ 补算未完成（${pending}）`:'✓ 没有待补算订单';renderGroupRecalculate()}
function renderMapStatus(){
  const order=state.orders.find(item=>item.id===state.selectedId),status=els.detail.querySelector?.('.route-top span:last-child');if(!order||!status)return;
  const mode=orderTravelMode(order);
  if(state.calculating.has(order.id))status.textContent=`正在查询${routeProviderName(mode)}${travelModeLabel(mode)}路线…`;
  else if(order.routeSource==='manual')status.textContent='手动补充费用';
  else if(order.routeSource==='amap')status.textContent=order.roundTripEstimated?`高德地图 · ${travelModeLabel(mode)} · 单程折算往返`:`高德地图 · ${travelModeLabel(mode)}估算`;
  else if(order.routeSource==='baidu')status.textContent=`百度地图 · ${travelModeLabel(mode)}估算`;
  else status.textContent=`${routeProviderName(mode)} · ${travelModeLabel(mode)}估算`;
  if(order.transportCovered)status.textContent+=' · 路费报销';
}
function rangeText(min,max,suffix=''){if(!Number.isFinite(min))return'待确认';return `${fixed(min,Number.isInteger(min)?0:1)}${Number.isFinite(max)&&max>min?`–${fixed(max,Number.isInteger(max)?0:1)}`:''}${suffix}`}
function orderCopyText(id){
  const order=derive(findOrder(id)||{});if(!order.id)return'';
  const transitSummary=orderTravelMode(order)==='transit'&&Array.isArray(order.transitLegs)&&order.transitLegs.length?`公交方案：${order.transitLegs.map(leg=>`${String(leg.line||'公交线路').replace(/\(.*/,'')}（${leg.departureStop||'上车站待确认'}→${leg.arrivalStop||'下车站待确认'}）`).join('；')}`:'';
  const summary=[`来源群：${order.source||'未命名群'}`,order.orderCode?`订单号：${order.orderCode}`:'',`年级：${order.grade||'待确认'}`,`科目：${order.subject||'待确认'}`,`地址：${order.address||'待确认'}`,`薪资：${rangeText(order.hourlyRate,order.hourlyRateMax,'元/小时')}`,`每次时长：${rangeText(order.hours,order.hoursMax,'小时')}`,`每周次数：${rangeText(order.weeklyTimes,order.weeklyTimesMax,'次')}`,`时间安排：${order.schedule||'待确认'}`,`出行方式：${travelModeLabel(orderTravelMode(order))}`,transitSummary,`往返距离：${Number.isFinite(order.distanceKm)?fixed(order.distanceKm)+'公里':'待计算'}`,`往返出行费：${Number.isFinite(order.travelCost)?money(order.travelCost):order.transportCovered?'¥0（报销/补贴）':'待计算'}`,`实际净时薪：${Number.isFinite(order.netHourly)?money(order.netHourly)+'/小时':'待计算'}`].filter(Boolean).join('\n');
  return `${order.rawText?`${order.rawText.trim()}\n\n`:''}——课值测算——\n${summary}`;
}
async function copyText(text,successMessage){
  if(!text){toast('没有可复制的内容');return}
  try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);else throw new Error('clipboard unavailable')}catch{const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove()}
  toast(successMessage);
}
function copyOrder(id){return copyText(orderCopyText(id),'订单完整信息已复制')}
function render(){document.querySelectorAll('[data-filter]').forEach(button=>button.classList.toggle('active',button.dataset.filter===state.filter));const travelModeSelect=$('#travel-mode');if(travelModeSelect)travelModeSelect.value=state.settings.travelMode||'taxi';renderGroupControls();renderStats();renderList();renderDetail();renderMapStatus();renderBulkButton();renderGroupRecalculate()}

function isStandalonePriceFragment(text){const value=String(text||'').trim();return /^(?:[【\[]?\s*)?(?:薪资|课费|老师课费|老师薪水|价格|报酬)\s*[】\]]?\s*[:：]/.test(value)&&TutorParser.isPlaceholder(value)}
function trimOrderDecoration(line){return String(line||'').trim().replace(/^[\s#*•·●○▪▫■□◆◇★☆▶▷➡→🚩⚑⚐🔴🟠🟡🟢🔵🟣❤♥🔥📌✅❗‼！]+/u,'').trim()}
function isLikelyDateOrPhoneCode(digits){return /^1[3-9]\d{9}$/.test(digits)||(/^20\d{10,12}$/.test(digits)&&Number(digits.slice(4,6))>=1&&Number(digits.slice(4,6))<=12&&Number(digits.slice(6,8))>=1&&Number(digits.slice(6,8))<=31)}
function orderHeaderInfo(line){
  const value=trimOrderDecoration(line);
  if(/^[【\[]?\s*嘉兴家教\s*\d{5,10}\s*[】\]]?/.test(value))return{kind:'known'};
  if(/^(?:嘉兴\s*\d{5,8}|育林\s*100\d{4}|(?:开学后\s*)?dt\s*\d{6,10}|xc\s*\d{6,10}[a-z]?|jx(?:ot|qt)\s*\d{8,18}[a-z]?)/i.test(value))return{kind:'known'};
  const numeric=value.match(/^(\d{9,18})(?=\D|$)/);if(numeric&&!isLikelyDateOrPhoneCode(numeric[1]))return{kind:'numeric'};
  return null;
}
function hasOrderFieldGroup(text){
  const value=String(text||'');
  const groups=[/(?:联系地址|学员地址|学生地址|家庭地址|上课地址|授课地址|家教地址|辅导地址|上课地点|辅导地点|地址|地点|位置|住址|家住)\s*[】\]]?\s*[:：]?/i,/(?:年级科目|辅导科目|科目|内容|年级|学员情况|学生情况)\s*[】\]]?\s*[:：]?/i,/(?:薪资待遇|老师薪水|老师课费|薪资|课费|价格|报酬|时薪)\s*[】\]]?\s*[:：]?/i];
  return groups.filter(pattern=>pattern.test(value)).length>=2;
}
function trimPromotionFooter(text){
  const lines=String(text||'').split('\n');
  const start=lines.findIndex(line=>/(?:^|\\?#)\s*(?:身边有同学想做家教|群内家教订单可直接转发|推荐的朋友.*接单试课|欢迎多多推荐|拉同学进群接单|现金红包)/.test(line.trim()));
  return(start>=0?lines.slice(0,start):lines).join('\n').trim();
}

function splitOrdersWithinRecord(block){
  const lines=String(block||'').split('\n'),candidates=[];
  lines.forEach((line,index)=>{const info=orderHeaderInfo(line);if(info)candidates.push({...info,index})});
  if(candidates.length<2)return[block];
  const accepted=candidates.filter((candidate,index)=>candidate.kind==='known'||hasOrderFieldGroup(lines.slice(candidate.index,candidates[index+1]?.index??lines.length).join('\n')));
  if(accepted.length<2)return[block];
  const preamble=lines.slice(0,accepted[0].index).join('\n').trim();
  return accepted.map((candidate,index)=>{const body=trimPromotionFooter(lines.slice(candidate.index,accepted[index+1]?.index??lines.length).join('\n'));return[preamble,body].filter(Boolean).join('\n')}).filter(Boolean);
}
function splitWechatRecords(text){
  const lines=String(text||'').split('\n'),starts=[];
  const timestamp=/^(?:(?:20\d{2}年)?\d{1,2}月\d{1,2}日|20\d{2}[\/-]\d{1,2}[\/-]\d{1,2}|今天|昨天|前天|星期[一二三四五六日天]|周[一二三四五六日天])(?:\s+星期[一二三四五六日天])?\s+(?:上午|下午|晚上|中午)?\s*\d{1,2}:\d{2}(?::\d{2})?$/;
  const field=/^[【\[]?\s*(?:内容|要求|薪资|价格|报酬|课费|时间|地点|地址|年级|科目|学员|学生|老师|教员)\s*[】\]]?\s*[:：]/;
  for(let index=0;index<lines.length-1;index++){
    const sender=lines[index].trim(),postedAt=lines[index+1].trim();
    if(sender&&sender.length<=80&&!field.test(sender)&&timestamp.test(postedAt))starts.push(index);
  }
  if(!starts.length)return[];
  const records=[];
  if(starts[0]>0){const prefix=lines.slice(0,starts[0]).join('\n').trim();if(prefix)records.push(prefix)}
  starts.forEach((start,index)=>{const record=lines.slice(start,starts[index+1]??lines.length).join('\n').trim();if(record)records.push(record)});
  return records;
}
function splitMessages(text){
  const cleaned=String(text||'').replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').replace(/(?:&#x20;|&#32;|&nbsp;)/gi,' ').replace(/\\([#~])/g,'$1').replace(/\r/g,'').trim();if(!cleaned)return[];
  let blocks=splitWechatRecords(cleaned);
  if(blocks.length)blocks=blocks.flatMap(splitOrdersWithinRecord);
  else{
    const headerSplit=splitOrdersWithinRecord(cleaned);
    if(headerSplit.length>1)blocks=headerSplit;
    else{const paragraphs=cleaned.split(/\n\s*\n+/).map(s=>s.trim()).filter(Boolean);blocks=paragraphs.length>1&&paragraphs.every(part=>hasOrderFieldGroup(part)||TutorParser.isPlaceholder(part))?paragraphs:[cleaned]}
  }
  blocks=blocks.filter(block=>!/^[-—－]{2,}\s*课值测算\s*[-—－]{2,}/.test(block));const merged=[];blocks.forEach(block=>{if(isStandalonePriceFragment(block)&&merged.length)merged[merged.length-1]+=`\n${block}`;else merged.push(block)});blocks=merged;
  if(blocks.length===1){const lines=cleaned.split('\n').map(s=>s.trim()).filter(Boolean);const probable=lines.filter(line=>/(数学|英语|语文|物理|化学|科学|编程|家教)/.test(line)&&/\d+(?:\.\d+)?\s*(?:元|\/\s*(?:h|小时)|每小时)/i.test(line));if(probable.length>1)blocks=probable}
  return blocks.filter(block=>!TutorParser.isPlaceholder(block));
}

function migrateStoredSplitOrders(){
  let changed=false;const expanded=[];
  state.orders.forEach(order=>{if(order.demo){expanded.push(order);return}const blocks=splitMessages(order.rawText||'');if(!blocks.length&&isStandalonePriceFragment(order.rawText||'')){changed=true;return}if(blocks.length<=1){expanded.push(order);return}changed=true;blocks.forEach((block,index)=>{const parsed=parseOrder(block,order.source||'未命名群');parsed.createdAt=order.createdAt||parsed.createdAt;parsed.id=`${order.id||uniqueId()}-split-${index+1}`;expanded.push(parsed)})});
  if(!changed)return false;
  const deduped=new Map(),quality=order=>(travelCostIsValid(order)?4:0)+(Number.isFinite(order.driveMinutes)?2:0)+(order.updatedAt?1:0);
  expanded.forEach(order=>{const key=order.demo?`demo:${order.id}`:order.orderCode?`${order.source}|code:${order.orderCode}`:`${order.source}|raw:${normalizeRaw(order.rawText||'')}`,existing=deduped.get(key);if(!existing||quality(order)>=quality(existing))deduped.set(key,order)});
  state.orders=[...deduped.values()];return true;
}

function parseGrade(text){return TutorParser.parseGrade(text)}
function parseSubject(text){return TutorParser.parseSubject(text)}
function trimAddress(value){return value.replace(/^(?:在|位于|地点|地址|位置|家住|上课地)[:：]?/,'').split(/(?:周[一二三四五六日天]|星期|每周|价格|课时|\d+\s*元|上午|下午|晚上)/)[0].replace(/(?:附近|左右|这边|上课)$/,'').trim()}
function parseAddress(text){
  const label='(?:联系地址|学员地址|学生地址|家庭地址|上课地址|授课地址|家教地址|辅导地址|上课地点|辅导地点|地址|地点|位置|住址|家住)';
  const explicit=String(text||'').match(new RegExp(`(?:^|[\\n，,。；;])\\s*[【\\[]?\\s*${label}\\s*[】\\]]?\\s*[:：]?\\s*([^，,。；;\\n]{2,40})`));
  return explicit?trimAddress(explicit[1]):'';
}
function isAmbiguousAddress(address){return /老师家|图书馆|或者|待定|另约|家长.*近一点/.test(address||'')}
function parseSchedule(text){
  const explicit=(text.match(/(?:^|\n)\s*[【\[]?(?:时间安排|时间)\s*[】\]]?\s*[:：]\s*([^\n]+)/)||[])[1];if(explicit)return explicit.trim();
  const found=text.match(/(?:周|星期)[一二三四五六日天1-7](?!\s*次)(?:上午|下午|晚上|白天)?|周末|上午|下午|晚上|时间可协商|时间面议/g)||[];
  const duration=TutorParser.detectDuration(text);if(duration.source==='time-range')found.push(duration.matched);
  return [...new Set(found.filter((item,index,all)=>!all.some((other,otherIndex)=>otherIndex!==index&&other.includes(item))))].join('、');
}
function parsePrice(text,defaultHours){
  const duration=TutorParser.detectDuration(text);const detected=Number.isFinite(duration.hours);
  const hours=detected?duration.hours:defaultHours;const compensation=TutorParser.parseCompensation(text,detected?duration.hours:null,detected?(duration.hoursMax??duration.hours):null);
  return {...compensation,hours,hoursMax:detected?(duration.hoursMax??duration.hours):hours,assumedHours:!detected,durationSource:detected?duration.source:'default',durationMatched:duration.matched};
}

function parseOrder(raw,source){
  const price=parsePrice(raw,state.settings.defaultHours),frequency=TutorParser.parseFrequency(raw),address=parseAddress(raw),transportCovered=TutorParser.hasTransportReimbursement(raw);
  const travelMode=state.settings.travelMode||'taxi';return {id:uniqueId(),demo:false,source,rawText:raw,orderCode:TutorParser.extractOrderCode(raw),postedAt:TutorParser.extractPostedAt(raw),grade:parseGrade(raw),subject:parseSubject(raw),address,addressSource:address?'explicit-prefix':'missing',addressAmbiguous:isAmbiguousAddress(address),requiresEmployedTeacher:TutorParser.requiresEmployedTeacher(raw),teacherGenderRequirement: TutorParser.parseTeacherGenderRequirement(raw),transportCovered,hourlyRate:price.hourlyRate,hourlyRateMin:price.hourlyRateMin,hourlyRateMax:price.hourlyRateMax,totalPrice:price.totalPrice,totalPriceMax:price.totalPriceMax??price.totalPrice,hours:price.hours,hoursMax:price.hoursMax,assumedHours:price.assumedHours,durationSource:price.durationSource,durationMatched:price.durationMatched,weeklyTimes:frequency.weeklyTimes,weeklyTimesMax:frequency.weeklyTimesMax,schedule:parseSchedule(raw),travelMode,routeResults:{},travelCost:transportCovered||travelMode==='free'?0:null,taxiCost:transportCovered&&travelMode==='taxi'?0:null,distanceKm:null,driveMinutes:null,routeSource:null,routeError:null,createdAt:new Date().toISOString()};
}

async function calculateOrder(id,quiet=false){
  const order=state.orders.find(o=>o.id===id);if(!order||state.calculating.has(id))return;
  const mode=state.settings.travelMode||'taxi',provider=routeProvider(mode),key=activeRouteKey(mode),mapName=providerName(provider);
  if(restoreCachedRoute(order,mode)){save();render();if(!quiet)toast(`已恢复${travelModeLabel(mode)}缓存，无需再次调用地图`);return}
  if(!key){if(!quiet){toast(`请先填写${mapName}${provider==='amap'?' Web 服务 Key':'服务端 AK'}`);openSettings()}return}
  if(eligibilityPassReason(order)){if(!quiet)toast(`该订单已 PASS：${eligibilityPassReason(order)}`);return}
  if(!order.address){if(!quiet)toast('请先补充订单地址');return}
  if(order.addressAmbiguous){if(!quiet)toast('地址描述不明确，请编辑为具体小区或地点后再计算');return}
  state.calculating.add(id);order.routeError=null;render();
  try{
    const response=await fetch('/api/route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider,travelMode:mode,key,origin:state.settings.origin,destination:mapQueryAddress(order.address),city:state.settings.city})});
    const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'路线计算失败');
    const travelCost=num(data.roundTrip.travelCost);if(!order.transportCovered&&(!(travelCost>=0)||(mode!=='free'&&travelCost===0)))throw new Error(`${mapName}没有返回有效的${travelModeLabel(mode)}费用，请稍后重算或手动填写`);
    order.travelMode=mode;order.travelCost=order.transportCovered?0:travelCost;order.taxiCost=mode==='taxi'?order.travelCost:null;order.distanceKm=num(data.roundTrip.distanceMeters)/1000;order.driveMinutes=num(data.roundTrip.durationSeconds)/60;roundRouteValues(order);order.geoConfidence=data.destination.confidence;order.geoLevel=data.destination.level;order.resolvedMapAddress=data.destination.formattedAddress||mapQueryAddress(order.address);order.routeSource=data.provider||provider;order.roundTripEstimated=Boolean(data.roundTripEstimated);order.transitBoardingsOneWay=num(data.transit?.boardingsOneWay);order.transitTransfersOneWay=num(data.transit?.transfersOneWay);order.transitWalkingMetersOneWay=num(data.transit?.walkingMetersOneWay);order.transitLegs=Array.isArray(data.transit?.legs)?data.transit.legs:[];order.updatedAt=new Date().toISOString();cacheCurrentRoute(order,mode);
  }catch(error){order.routeError=error.message||'路线计算失败';if(!quiet)toast(order.routeError)}finally{state.calculating.delete(id);save();render()}
}

async function calculateQueue(orders,bulkMode=false){
  orders=orders.filter(o=>o.address&&!o.addressAmbiguous&&!eligibilityPassReason(o));if(!activeRouteKey()||!orders.length)return;
  if(bulkMode){state.bulk={active:true,done:0,total:orders.length};renderBulkButton()}
  try{
    for(const order of orders){await calculateOrder(order.id,true);if(bulkMode){state.bulk.done++;renderBulkButton()}await new Promise(resolve=>setTimeout(resolve,220))}
    const failed=orders.filter(o=>o.routeError||!routeComplete(o)).length,success=orders.length-failed;
    toast(failed?`重算完成：成功 ${success} 条，失败 ${failed} 条`:`已完成 ${orders.length} 条${routeProviderName()}${travelModeLabel()}路线计算`);
  }finally{if(bulkMode){state.bulk.active=false;renderBulkButton()}}
}

async function recalculatePending(){
  if(state.bulk.active)return;
  if(!activeRouteKey()){toast(`请先填写${routeProviderName()}密钥`);openSettings();return}
  const pending=pendingRouteOrders(),eligible=pending.filter(o=>o.address&&!o.addressAmbiguous);
  const skipped=pending.length-eligible.length;if(!eligible.length){toast(skipped?'剩余未完成订单缺少可计算的具体地址':'目前没有待补算订单');return}
  await calculateQueue(eligible,true);
  if(skipped)toast(`补算结束；另有 ${skipped} 条因地址缺失或模糊而跳过`);
}

async function recalculateSelectedGroup(){
  if(state.bulk.active)return;
  if(state.groupFilter==='all'){toast('请先选择一个具体群聊');return}
  if(!activeRouteKey()){toast(`请先填写${routeProviderName()}密钥`);openSettings();return}
  const group=state.groupFilter,all=state.orders.filter(o=>!o.demo&&o.source===group),eligible=groupRouteCandidates(group),skipped=all.length-eligible.length;
  if(!eligible.length){toast('本群没有地址明确且符合条件的订单');return}
  const warning=`确定重新计算“${group}”中的 ${eligible.length} 条订单吗？\n\n这会重新调用地图接口并覆盖已有路线价格${skipped?`；另有 ${skipped} 条因已 PASS、地址缺失或模糊而跳过`:''}。`;
  if(!confirm(warning)){toast('已取消本群重算');return}
  await calculateQueue(eligible,true);
}

function deleteSelectedGroup(){
  if(state.bulk.active)return;
  if(state.groupFilter==='all'){toast('请先选择一个具体群聊');return}
  const group=state.groupFilter,count=state.orders.filter(o=>!o.demo&&o.source===group).length;
  state.pendingDeleteGroup=group;els.deleteGroupTitle.textContent=`“${group}”共有 ${count} 条订单`;els.deleteGroupMessage.textContent=count?`确认后将永久删除这 ${count} 条订单。`:'当前群聊已经没有订单，可勾选下方选项删除群聊页面。';els.deleteGroupToo.checked=false;els.deleteGroupDialog.showModal();
}

function confirmDeleteSelectedGroup(){
  const group=state.pendingDeleteGroup;if(!group)return;const deleteGroup=Boolean(els.deleteGroupToo.checked),count=state.orders.filter(o=>!o.demo&&o.source===group).length;
  if(!count&&!deleteGroup){toast('当前群聊没有订单；如需删除群聊页面，请勾选下方选项');return}
  state.orders=state.orders.filter(o=>o.demo||o.source!==group);
  if(deleteGroup){state.groups=state.groups.filter(name=>name!==group);state.groupFilter='all'}else{if(!state.groups.includes(group))state.groups.push(group);state.groupFilter=group}
  state.pendingDeleteGroup=null;state.selectedId=null;save();els.deleteGroupDialog.close();render();toast(deleteGroup?`已清空订单并删除群聊“${group}”`:`已清空“${group}”的 ${count} 条订单，群聊页面已保留`);
}

function openClearAll(){
  const orderCount=state.orders.length,groupCount=groupSources().length,favoriteCount=state.favorites.length;
  els.clearAllTitle.textContent=`即将删除全部 ${orderCount} 条订单`;
  els.clearAllGroups.checked=false;els.clearAllFavorites.checked=false;
  const copy=els.clearAllTitle.parentElement?.querySelector?.('span');
  if(copy)copy.textContent=`现有 ${groupCount} 个群聊页面、${favoriteCount} 条收藏；两者默认保留。`;
  if(els.settingsDialog.open)els.settingsDialog.close();
  els.clearAllDialog.showModal();
}

function confirmClearAll(){
  const orderCount=state.orders.length,deleteGroups=Boolean(els.clearAllGroups.checked),deleteFavorites=Boolean(els.clearAllFavorites.checked);
  state.orders=[];
  if(deleteGroups)state.groups=[];
  if(deleteFavorites)state.favorites=[];
  if(deleteGroups||state.groupFilter!=='all'&&!state.groups.includes(state.groupFilter))state.groupFilter='all';
  if(deleteFavorites&&state.filter==='favorites')state.filter='all';
  state.selectedId=null;save();els.clearAllDialog.close();render();
  toast(`已删除 ${orderCount} 条订单${deleteGroups?'和全部群聊页面':''}${deleteFavorites?'，收藏内容也已删除':'，收藏内容已保留'}`);
}

function syncProviderFields(){
  const mode=state.settings.travelMode||'taxi',select=$('#map-provider'),amapOnly=['transit','ebike','bicycle'].includes(mode);if(amapOnly){if(!select.dataset.savedProvider)select.dataset.savedProvider=select.value;select.value='amap';select.disabled=true}else{if(select.disabled&&select.dataset.savedProvider)select.value=select.dataset.savedProvider;delete select.dataset.savedProvider;select.disabled=false}const provider=select.value;$('#amap-key-field').hidden=!amapOnly&&provider!=='amap';$('#baidu-key-field').hidden=amapOnly||provider!=='baidu';
}

function openSettings(){
  delete $('#map-provider').dataset.savedProvider;$('#map-provider').disabled=false;$('#map-provider').value=state.settings.mapProvider;$('#amap-key').value=state.settings.amapKey;$('#baidu-ak').value=state.settings.ak;$('#origin-address').value=state.settings.origin;$('#city').value=state.settings.city;$('#max-one-way-km').value=state.settings.maxOneWayKm;$('#buffer-minutes').value=state.settings.bufferMinutes;$('#default-hours').value=state.settings.defaultHours;$('#minimum-net').value=state.settings.minimumNet;syncProviderFields();els.settingsDialog.showModal();
}

function changeTravelMode(selectedMode){
  selectedMode=['taxi','transit','ebike','bicycle','free'].includes(selectedMode)?selectedMode:'taxi';const oldMode=state.settings.travelMode||'taxi';if(selectedMode===oldMode)return;if(state.calculating.size||state.bulk.active){render();toast('请等待当前路线计算完成后再切换出行方式');return}const orders=state.orders.filter(o=>!o.demo);orders.forEach(o=>cacheCurrentRoute(o,oldMode));state.settings.travelMode=selectedMode;orders.forEach(o=>{if(!restoreCachedRoute(o,selectedMode))clearActiveRoute(o,selectedMode,`尚未计算${travelModeLabel(selectedMode)}路线，请补算未完成`)});save();render();const pending=actionablePendingRouteOrders().length;toast(pending?`已切换为${travelModeLabel(selectedMode)}：还有 ${pending} 条需要补算`:`已切换为${travelModeLabel(selectedMode)}：已全部计算完毕`);
}

function openEdit(){
  const o=state.orders.find(item=>item.id===state.selectedId);if(!o)return;
  roundRouteValues(o);
  els.editForm.innerHTML=`<div class="modal-head"><div><p class="eyebrow">CHECK & CORRECT</p><h2>核对订单</h2></div><button class="icon-button" value="cancel" aria-label="关闭">×</button></div><div class="edit-grid"><label>年级<input name="grade" value="${esc(o.grade)}"></label><label>科目<input name="subject" value="${esc(o.subject)}"></label></div><label>上课地址<input name="address" value="${esc(o.address)}"></label><div class="edit-grid"><label>每小时单价<input name="hourlyRate" type="number" min="0" step="1" value="${o.hourlyRate??''}"></label><label>每次授课时长（自动识别）<input name="hours" type="number" min="0.5" step="0.5" value="${o.hours??''}"></label><label>每周次数<input name="weeklyTimes" type="number" min="1" max="7" value="${o.weeklyTimes??1}"></label><label>上课时间<input name="schedule" value="${esc(o.schedule)}"></label></div><div class="edit-grid"><label>往返出行费（当前：${travelModeLabel(orderTravelMode(o))}）<input name="travelCost" type="number" min="0" step="0.5" value="${orderTravelCost(o)??''}"></label><label>往返里程 km<input name="distanceKm" type="number" min="0" step="0.1" value="${o.distanceKm??''}"></label><label>往返通勤分钟<input name="driveMinutes" type="number" min="0" step="1" value="${o.driveMinutes??''}"></label><label>来源群<input name="source" value="${esc(o.source)}"></label></div><label>原始消息<textarea name="rawText" rows="4">${esc(o.rawText)}</textarea></label><div class="form-actions"><button type="button" class="text-button danger" data-action="delete-order">删除订单</button><span class="spacer"></span><button value="cancel" class="ghost-button">取消</button><button type="button" class="primary-button" data-action="save-edit">保存修改</button></div>`;
  els.editDialog.showModal();
}

function saveEdit(){
  const order=state.orders.find(item=>item.id===state.selectedId);if(!order)return;const fd=new FormData(els.editForm);const oldAddress=order.address;
  ['grade','subject','address','schedule','source','rawText'].forEach(key=>order[key]=String(fd.get(key)||'').trim());
  ['hourlyRate','hours','weeklyTimes','travelCost','distanceKm','driveMinutes'].forEach(key=>order[key]=num(fd.get(key)));
  roundRouteValues(order);
  order.requiresEmployedTeacher=TutorParser.requiresEmployedTeacher(order.rawText||'');order.teacherGenderRequirement=TutorParser.parseTeacherGenderRequirement(order.rawText||'');order.transportCovered=TutorParser.hasTransportReimbursement(order.rawText||'');
  order.addressSource='manual';
  order.hourlyRateMin=order.hourlyRate;order.hourlyRateMax=order.hourlyRate;order.hoursMax=order.hours;order.weeklyTimesMax=order.weeklyTimes;order.addressAmbiguous=isAmbiguousAddress(order.address);order.assumedHours=false;order.durationSource='manual';order.durationMatched='';
  order.travelMode=order.travelMode||state.settings.travelMode||'taxi';order.taxiCost=order.travelMode==='taxi'?order.travelCost:null;
  if(order.address!==oldAddress){order.routeResults={};clearActiveRoute(order,order.travelMode,'地址已修改，请重新计算路线')}else if(Number.isFinite(order.travelCost)){order.routeSource=order.routeSource||'manual'}
  if(order.transportCovered){order.travelCost=0;order.taxiCost=order.travelMode==='taxi'?0:null;if(order.routeError?.includes('费用'))order.routeError=null}else if(Number.isFinite(order.travelCost)&&order.travelCost<=0&&order.travelMode!=='free'){order.travelCost=null;order.taxiCost=null;order.routeSource=null;order.routeError='往返出行费必须大于 0，请重新计算或填写有效费用'}
  if(order.address===oldAddress&&Number.isFinite(order.driveMinutes)&&travelCostIsValid(order))cacheCurrentRoute(order,order.travelMode);
  if(order.source&&!state.groups.includes(order.source))state.groups.push(order.source);
  save();els.editDialog.close();render();toast('订单已更新');
}

function importMessages(){
  const raw=$('#message-input').value;const source=selectedImportSource();const blocks=splitMessages(raw);if(!blocks.length){toast('请先粘贴群消息');return}
  const codeMap=new Map(),withoutCode=[];
  blocks.map(block=>parseOrder(block,source)).forEach(item=>item.orderCode?codeMap.set(item.orderCode,item):withoutCode.push(item));
  const incoming=[...withoutCode,...codeMap.values()],known=new Set(state.orders.filter(o=>!o.demo).map(o=>normalizeRaw(o.rawText)));
  state.orders=state.orders.filter(o=>!o.demo);const changed=[];let added=0,updated=0;
  incoming.forEach(item=>{
    const existingIndex=item.orderCode?state.orders.findIndex(o=>o.orderCode===item.orderCode):-1;
    if(existingIndex>=0){
      const old=state.orders[existingIndex],sameAddress=old.address===item.address;
      if(sameAddress){['travelMode','routeResults','travelCost','taxiCost','distanceKm','driveMinutes','resolvedMapAddress','routeSource','routeError','geoConfidence','geoLevel','roundTripEstimated','transitBoardingsOneWay','transitTransfersOneWay','transitWalkingMetersOneWay','transitLegs','updatedAt'].forEach(key=>item[key]=old[key]??item[key]);if(item.transportCovered){item.travelCost=0;item.taxiCost=item.travelMode==='taxi'?0:null}}
      item.id=old.id;item.createdAt=old.createdAt||item.createdAt;state.orders[existingIndex]=item;changed.push(item);updated++;
    }else if(!known.has(normalizeRaw(item.rawText))){state.orders.push(item);changed.push(item);added++}
  });
  if(!changed.length){toast('这些消息已经导入过了');return}
  if(!state.groups.includes(source))state.groups.push(source);
  state.selectedId=changed[0].id;state.groupFilter=source;save();els.importDialog.close();$('#message-input').value='';render();toast(`已导入到“${source}”：新增 ${added} 条，更新 ${updated} 条`);calculateQueue(changed.filter(o=>!routeComplete(o)));
}

function saveSettings(){
  const oldOrigin=state.settings.origin,oldCity=state.settings.city,oldProvider=state.settings.mapProvider,oldMode=state.settings.travelMode||'taxi',selectedMode=oldMode,providerValue=['transit','ebike','bicycle'].includes(selectedMode)?($('#map-provider').dataset.savedProvider||state.settings.mapProvider):$('#map-provider').value,newOrigin=$('#origin-address').value.trim()||defaults.origin,newCity=$('#city').value.trim()||defaults.city,newProvider=providerValue==='amap'?'amap':'baidu',routeContextChanged=oldOrigin!==newOrigin||oldCity!==newCity||oldProvider!==newProvider;const orders=state.orders.filter(o=>!o.demo);if(routeContextChanged)orders.forEach(o=>cacheCurrentRoute(o,oldMode));state.settings={mapProvider:newProvider,travelMode:selectedMode,amapKey:$('#amap-key').value.trim(),ak:$('#baidu-ak').value.trim(),teacherGender:state.settings.teacherGender||'any',origin:newOrigin,city:newCity,maxOneWayKm:num($('#max-one-way-km').value)??defaults.maxOneWayKm,bufferMinutes:num($('#buffer-minutes').value)??defaults.bufferMinutes,defaultHours:num($('#default-hours').value)??defaults.defaultHours,minimumNet:num($('#minimum-net').value)??defaults.minimumNet};
  if(routeContextChanged)orders.forEach(o=>{const reason=oldCity!==newCity?'家教所在城市已修改，请重新计算路线':oldOrigin!==newOrigin?'出发点已修改，请重新计算路线':'地图服务商已修改，请重新计算路线';if(!restoreCachedRoute(o,selectedMode))clearActiveRoute(o,selectedMode,reason)});
  save();els.settingsDialog.close();render();toast(activeRouteKey()?`设置已保存，当前按${travelModeLabel()}计算`:`设置已保存，尚未填写${routeProviderName()}密钥`);
}

function exportCsv(){
  if(!state.orders.length){toast('没有可导出的订单');return}
  const headers=['排名','订单号','发布时间','来源群','年级','科目','地址','最低每小时单价','最高每小时单价','每次最少小时','每次最多小时','每周最少次数','每周最多次数','时间','出行方式','往返公里','往返分钟','往返出行费','单程公交换乘次数','公交站台方案','单次收入（保守）','净现金收益（保守）','实际净时薪（保守）','预计月净收益（保守）','路线来源'];
  const rows=sortedOrders().map((o,i)=>[i+1,o.orderCode,o.postedAt,o.source,o.grade,o.subject,o.address,o.hourlyRate,o.hourlyRateMax,o.hours,o.hoursMax,o.weeklyTimes,o.weeklyTimesMax,o.schedule,travelModeLabel(orderTravelMode(o)),o.distanceKm,o.driveMinutes,o.travelCost,o.transitTransfersOneWay,Array.isArray(o.transitLegs)?o.transitLegs.map(leg=>`${String(leg.line||'').replace(/\(.*/,'')}：${leg.departureStop||''}→${leg.arrivalStop||''}`).join('；'):'',o.income,o.cashNet,o.netHourly,o.monthlyNet,o.routeSource]);
  const csv=[headers,...rows].map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`课值订单_${new Date().toISOString().slice(0,10)}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),500);toast('CSV 已导出');
}

document.addEventListener('click',event=>{
  const copyButton=event.target.closest('[data-copy-order]');if(copyButton){event.stopPropagation();copyOrder(copyButton.dataset.copyOrder);return}
  const favoriteButton=event.target.closest('[data-favorite-order]');if(favoriteButton){event.stopPropagation();toggleFavorite(favoriteButton.dataset.favoriteOrder);return}
  const groupPage=event.target.closest('[data-group-source]');if(groupPage){state.groupFilter=groupPage.dataset.groupSource;els.groupsDialog.close();render();return}
  const orderCard=event.target.closest('[data-order-id]');if(orderCard){state.selectedId=orderCard.dataset.orderId;render();return}
  const filter=event.target.closest('[data-filter]');if(filter){state.filter=filter.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===filter));render();return}
  const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
  if(action==='open-import'){renderImportGroups();els.importDialog.showModal()}
  if(action==='open-groups'){renderGroupControls();els.groupsDialog.showModal()}
  if(action==='open-settings')openSettings();
  if(action==='open-edit')openEdit();
  if(action==='fill-sample')$('#message-input').value='💤\n2026年08月25日 20:25\n育林1002697 秀洲开学\n学员地址：天星·如意湾\n辅导科目：英语数学\n学员情况：开学初一\n时间安排：周末2次，每次2h\n教员要求：男女不限，负责耐心，有经验\n老师薪水：80/h';
  if(action==='parse')importMessages();
  if(action==='save-settings')saveSettings();
  if(action==='save-edit')saveEdit();
  if(action==='toggle-ak'){const input=$('#baidu-ak');input.type=input.type==='password'?'text':'password';event.target.textContent=input.type==='password'?'显示':'隐藏'}
  if(action==='toggle-amap-key'){const input=$('#amap-key');input.type=input.type==='password'?'text':'password';event.target.textContent=input.type==='password'?'显示':'隐藏'}
  if(action==='recalculate')calculateOrder(state.selectedId);
  if(action==='recalculate-pending')recalculatePending();
  if(action==='recalculate-group')recalculateSelectedGroup();
  if(action==='delete-group')deleteSelectedGroup();
  if(action==='confirm-delete-group')confirmDeleteSelectedGroup();
  if(action==='open-clear-all')openClearAll();
  if(action==='confirm-clear-all')confirmClearAll();
  if(action==='export')exportCsv();
  if(action==='delete-order'){if(confirm('确定删除这条订单吗？')){state.orders=state.orders.filter(o=>o.id!==state.selectedId);state.selectedId=null;save();els.editDialog.close();render();toast('订单已删除')}}
});

els.search.addEventListener('input',event=>{state.search=event.target.value;render()});
els.groupFilter.addEventListener('change',event=>{state.groupFilter=event.target.value;render()});
els.importGroupSelect.addEventListener('change',event=>{els.newGroupField.hidden=event.target.value!=='__new__'});
els.teacherGender.addEventListener('change',event=>{state.settings.teacherGender=['male','female'].includes(event.target.value)?event.target.value:'any';save();state.selectedId=null;render();toast(state.settings.teacherGender==='any'?'尚未启用性别筛选':`已切换为${state.settings.teacherGender==='female'?'女老师':'男老师'}，不符合订单已自动 PASS`)});
$('#map-provider').addEventListener('change',syncProviderFields);
$('#travel-mode').addEventListener('change',event=>changeTravelMode(event.target.value));
document.addEventListener('keydown',event=>{const card=document.activeElement?.closest?.('[data-order-id]');if(card&&(event.key==='Enter'||event.key===' ')){event.preventDefault();state.selectedId=card.dataset.orderId;render()}});

migrateStoredSplitOrders();
if(!Array.isArray(state.groups))state.groups=[];
if(!Array.isArray(state.favorites))state.favorites=[];
state.favorites=[...new Map(state.favorites.filter(item=>item&&item.id).map(item=>[item.id,item])).values()];
state.groups=[...new Set([...state.groups,...state.orders.filter(o=>!o.demo).map(o=>o.source||'未命名群')].filter(Boolean))];
state.orders.forEach(order=>{
  roundRouteValues(order);
  if(order.routeResults&&typeof order.routeResults==='object')Object.values(order.routeResults).forEach(snapshot=>{if(!snapshot||typeof snapshot!=='object')return;if(Number.isFinite(snapshot.distanceKm))snapshot.distanceKm=Math.round(snapshot.distanceKm*10)/10;if(Number.isFinite(snapshot.driveMinutes))snapshot.driveMinutes=Math.round(snapshot.driveMinutes)});
  order.requiresEmployedTeacher=TutorParser.requiresEmployedTeacher(order.rawText||'');
  order.teacherGenderRequirement=TutorParser.parseTeacherGenderRequirement(order.rawText||'');
  order.transportCovered=TutorParser.hasTransportReimbursement(order.rawText||'');
  order.travelMode=order.travelMode||(Number.isFinite(order.taxiCost)?'taxi':state.settings.travelMode||'taxi');
  if(!Number.isFinite(order.travelCost)&&order.travelMode==='taxi'&&Number.isFinite(order.taxiCost))order.travelCost=order.taxiCost;
  if(order.travelMode==='free'&&!Number.isFinite(order.travelCost))order.travelCost=0;
  if(order.transportCovered){order.travelCost=0;order.taxiCost=order.travelMode==='taxi'?0:null;if(order.routeError?.includes('0 元打车费'))order.routeError=null}
  if(!order.demo&&!order.addressSource){
    const explicitAddress=parseAddress(order.rawText||''),looksLikeSender=/(?:发单人|发单老师|联系人|发布人|老师\s*[（(]\s*发单)/.test(order.address||'');
    if(explicitAddress&&explicitAddress!==order.address){order.address=explicitAddress;order.travelCost=order.transportCovered?0:null;order.taxiCost=order.transportCovered&&order.travelMode==='taxi'?0:null;order.distanceKm=null;order.driveMinutes=null;order.resolvedMapAddress=null;order.routeSource=null;order.transitLegs=[];order.routeError='已按地址前缀修正，请重新计算路线'}
    else if(!explicitAddress&&looksLikeSender){order.address='';order.travelCost=order.transportCovered?0:null;order.taxiCost=order.transportCovered&&order.travelMode==='taxi'?0:null;order.distanceKm=null;order.driveMinutes=null;order.resolvedMapAddress=null;order.routeSource=null;order.transitLegs=[];order.routeError='原地址疑似发单人信息，请补充明确的学员地址'}
    order.addressSource=explicitAddress?'explicit-prefix':order.address?'legacy':'missing';
  }
  const detected=TutorParser.detectDuration(order.rawText||'');
  const correctedContextualDuration=Number.isFinite(detected.hours)&&detected.matched&&detected.matched!==order.durationMatched&&/(?:每次|一次|单次|每节|一节)/.test(detected.matched);
  if(Number.isFinite(detected.hours)&&(order.assumedHours||!order.durationSource||order.demo||correctedContextualDuration)){
    order.hours=detected.hours;order.hoursMax=detected.hoursMax??detected.hours;order.assumedHours=false;order.durationSource=detected.source;order.durationMatched=detected.matched;
    if(detected.source==='time-range')order.schedule=parseSchedule(order.rawText||'');
  }else if(!order.durationSource&&Number.isFinite(order.hours))order.durationSource='existing';
  if(!Number.isFinite(order.hoursMax)&&Number.isFinite(order.hours))order.hoursMax=order.hours;
  const correctedPrice=TutorParser.parseCompensation(order.rawText||'',order.hours,order.hoursMax??order.hours);
  const priceChanged=Number.isFinite(correctedPrice.hourlyRate)&&(!Number.isFinite(order.hourlyRate)||order.hourlyRate<10||correctedPrice.hourlyRate!==order.hourlyRate||(correctedPrice.hourlyRateMax??correctedPrice.hourlyRate)!==(order.hourlyRateMax??order.hourlyRate)||(Number.isFinite(correctedPrice.totalPrice)&&correctedPrice.totalPrice!==order.totalPrice));
  if(priceChanged){order.hourlyRate=correctedPrice.hourlyRate;order.hourlyRateMin=correctedPrice.hourlyRateMin;order.hourlyRateMax=correctedPrice.hourlyRateMax;order.totalPrice=correctedPrice.totalPrice;order.totalPriceMax=correctedPrice.totalPriceMax??correctedPrice.totalPrice}
  if(!Number.isFinite(order.hourlyRateMin)&&Number.isFinite(order.hourlyRate))order.hourlyRateMin=order.hourlyRate;
  if(!Number.isFinite(order.hourlyRateMax)&&Number.isFinite(order.hourlyRate))order.hourlyRateMax=order.hourlyRate;
  if(!Number.isFinite(order.weeklyTimesMax))order.weeklyTimesMax=order.weeklyTimes||1;
  if(typeof order.addressAmbiguous!=='boolean')order.addressAmbiguous=isAmbiguousAddress(order.address);
  if(!order.transportCovered&&order.travelMode==='taxi'&&orderTravelCost(order)===0&&!order.routeError)order.routeError='地图服务曾返回 0 元打车费，该费用已排除出收益排名，请点击“补算未完成”';
});
state.orders.forEach(derive);state.selectedId=sortedOrders()[0]?.id||null;save();render();
