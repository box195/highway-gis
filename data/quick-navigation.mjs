import {loadGraph,gps} from './navigation-runtime.mjs?v=20261019-songpa-return';
import {availableOriginOptions,navigationURL} from './highway-routing.mjs?v=20261019-songpa-return';
import {nearestOfficeDeparture} from './highway-endpoints.mjs?v=20261019-songpa-return';
import {quickOriginChoices,getOriginPreference,setOriginPreference,resolveQuickOrigin} from './quick-origin.mjs?v=20261019-quick-origin';
import {kakaoNavigationURL} from './kakao-navigation.mjs?v=20261019-songpa-return';
import {TOLL_GATES} from './highway-tollgates.mjs';
import {resolveQuickChoices,routeCache} from './quick-route-cache.mjs?v=20261019-route-cache';
import {navigationCatalog,destinationPoint,savedDestinationRoute,returnDestination} from './navigation-catalog.mjs?v=20261019-songpa-return';

const page=document.createElement('section');page.id='quick-navigation-page';page.hidden=true;page.setAttribute('aria-label','빠른 길찾기');
page.innerHTML=`<header class="qn-header"><button id="qn-back" type="button">← GIS</button><h1>빠른 길찾기</h1><label class="qn-origin">출발<select id="qn-origin" aria-label="출발 거점"><option value="">현재 위치 · 가까운 거점</option></select></label><label class="qn-provider">지도앱<select id="qn-provider" aria-label="지도앱"><option value="kakao">카카오맵</option><option value="naver">네이버지도</option></select></label></header>
<main class="qn-content"><div class="qn-return"><button id="qn-return-highway" type="button"><small>수원영</small><strong>고속도로 복귀</strong></button><button id="qn-return-saved" type="button"><small>수원영</small><strong>저장경로 복귀</strong></button></div>
<p class="qn-note">출발 거점을 고르거나 기본값(현재 위치에서 가장 가까운 거점)을 유지한 뒤 목적지·경로·진행 방향을 선택하세요.</p><p id="qn-page-status" role="status"></p><div id="qn-destinations"></div></main>`;
const flow=document.createElement('dialog');flow.id='quick-navigation-flow';flow.setAttribute('aria-labelledby','qn-flow-title');
flow.innerHTML=`<header class="qn-flow-header"><h2 id="qn-flow-title">경로 선택</h2><button id="qn-flow-close" type="button" aria-label="길찾기 선택창 닫기">✕</button></header><div class="qn-flow-body"><p id="qn-flow-source" class="qn-note"></p><p id="qn-flow-status" role="status" aria-live="polite"></p><div id="qn-flow-options"></div></div>`;
page.append(flow);document.body.append(page);
const style=document.createElement('style');style.textContent=`
#quick-navigation-page{position:fixed;inset:0;z-index:10000;background:#0b1220;color:#e2e8f0;overflow:auto;overscroll-behavior:contain;font:16px/1.5 system-ui;padding-bottom:env(safe-area-inset-bottom)}#quick-navigation-page[hidden]{display:none}
#quick-navigation-page button,#quick-navigation-page select,#quick-navigation-page a{font-family:inherit;touch-action:manipulation}#quick-navigation-page button,#quick-navigation-page a{cursor:pointer}#quick-navigation-page button:disabled{opacity:.5;cursor:wait}
.qn-header{position:sticky;top:0;z-index:2;display:grid;grid-template-columns:auto auto minmax(170px,1fr) auto;align-items:center;gap:10px;background:#0f172a;padding:12px max(12px,env(safe-area-inset-left));border-bottom:1px solid #334155}.qn-header h1{font-size:19px;font-weight:800;margin:0}.qn-header button,.qn-provider select,.qn-origin select{min-height:44px;background:#1e293b;border:1px solid #475569;border-radius:10px;color:#f8fafc;padding:8px 12px}.qn-provider{display:flex;align-items:center;gap:6px;font-size:12px;flex-shrink:0}.qn-provider select{font-size:14px}.qn-origin{display:flex;align-items:center;gap:7px;min-width:0;font-size:13px;font-weight:600;color:#cbd5e1}.qn-origin select{display:block;max-width:390px;min-width:0;width:100%;font-size:14px;text-overflow:ellipsis}
.qn-content{max-width:850px;margin:auto;padding:18px 16px 60px}.qn-return{display:grid;grid-template-columns:1fr 1fr;gap:12px}.qn-return button{min-height:100px;border:1px solid #0891b2;border-radius:16px;background:#0e7490;color:white;padding:16px}.qn-return button+button{background:#1e293b;border-color:#64748b}.qn-return small,.qn-return strong{display:block}.qn-return strong{font-size:20px}.qn-note{color:#a5b4c8;font-size:13px;margin:12px 0}.qn-group{margin:26px 0}.qn-group h2{font-size:16px;font-weight:700;color:#cbd5e1;margin:0 0 10px}.qn-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.qn-destination{min-height:64px;text-align:left;padding:14px;border-radius:12px;border:1px solid #334155;background:#162135;color:#f8fafc;overflow-wrap:anywhere}.qn-destination span{display:block;font-size:12px;color:#fbbf24}.qn-destination:active{background:#164e63}
#quick-navigation-flow{width:min(94vw,580px);max-height:90dvh;margin:auto;padding:0;border-radius:18px;border:1px solid #475569;background:#0f172a;color:#f1f5f9;overflow:auto;font:16px/1.5 system-ui}#quick-navigation-flow::backdrop{background:#020617c9}.qn-flow-header{display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid #334155}.qn-flow-header h2{font-size:20px;font-weight:800;margin:0}.qn-flow-header button{min-width:44px;min-height:44px;border-radius:10px;background:#1e293b;color:white;border:0}.qn-flow-body{padding:18px}.qn-mode-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.qn-mode,.qn-direction{display:block;width:100%;min-height:86px;padding:18px;border:1px solid #0891b2;border-radius:14px;background:#155e75;color:#fff;font-size:23px;font-weight:800;text-align:center;text-decoration:none}.qn-mode+button{background:#334155;border-color:#64748b}.qn-direction{font-size:18px;text-align:left;margin-top:12px}.qn-direction small{display:block;font-size:13px;font-weight:400;color:#cbd5e1;margin-top:6px}.qn-launch-kakao{background:#fee500;color:#191919;border-color:#fee500}.qn-launch-kakao small{color:#4b4530}.qn-error{color:#fda4af}#quick-navigation-page :focus-visible{outline:3px solid #67e8f9;outline-offset:3px}
@media(max-width:680px){.qn-header{grid-template-columns:auto minmax(0,1fr) auto;column-gap:7px;row-gap:4px}.qn-header h1{grid-column:1/-1;grid-row:2;font-size:16px}.qn-origin{grid-column:2;grid-row:1;font-size:0}.qn-origin select{font-size:13px;padding:7px 5px;max-width:100%}.qn-provider{grid-column:3;grid-row:1}.qn-provider select{font-size:13px;padding:7px 5px}.qn-header #qn-back{grid-column:1;grid-row:1;padding:7px 9px}}
@media(max-width:420px){.qn-provider{font-size:0}.qn-provider select{font-size:13px;padding:8px}.qn-return button{padding:14px 6px}.qn-return strong{font-size:17px}.qn-content{padding:14px 12px 50px}}
`;document.head.append(style);
const $=id=>document.getElementById(id);
const data=()=>window.HighwayApp.navigationData||window.HighwayApp.data||{};
let groups=[],serial=0,prepared=null,activeItem=null,gpsContext=null,gpsPending=null,pushed=false,oldOverflow='',previousFocus=null;
const inertState=new Map();
try{$('qn-provider').value=localStorage.getItem('highway-navigation-provider')==='naver'?'naver':'kakao';}catch{}
function localStorageSafe(){try{return window.localStorage;}catch{return null;}}
function message(text,error=false){$('qn-flow-status').textContent=text;$('qn-flow-status').className=error?'qn-error':'';}
function clearFlow(){serial++;prepared=null;$('qn-flow-options').replaceChildren();$('qn-flow-source').textContent='';}
function render(){
  groups=navigationCatalog(data());$('qn-destinations').replaceChildren();
  const origins=quickOriginChoices(data()),select=$('qn-origin');
  const previous=select.value;
  select.replaceChildren(new Option('현재 위치 · 가까운 거점',''));
  for(const [group,label] of [['saved-hubs','영업소 · 지사 · 거점'],['junctions','IC · JC']]){
    const entries=origins.filter(o=>o.group===group);
    if(!entries.length)continue;
    const optgroup=document.createElement('optgroup');optgroup.label=label;
    for(const item of entries)optgroup.append(new Option(item.label,item.id));
    select.append(optgroup);
  }
  const preferred=getOriginPreference(origins,localStorageSafe());
  select.value=origins.some(o=>o.id===previous)?previous:preferred;
  if(select.selectedIndex<0)select.value='';

  for(const g of groups){
    if(!g.items.length)continue;
    const section=document.createElement('section');section.className='qn-group';section.dataset.group=g.key;
    const heading=document.createElement('h2');heading.textContent=g.label;section.append(heading);
    const grid=document.createElement('div');grid.className='qn-grid';
    for(const item of g.items){const b=document.createElement('button');b.type='button';b.className='qn-destination';b.dataset.destination=item.id;b.append(document.createTextNode(item.label));
      if(item.approximate){const note=document.createElement('span');note.textContent='추정 위치';b.append(note);}
      b.addEventListener('click',()=>begin(item));grid.append(b);
    }section.append(grid);$('qn-destinations').append(section);
  }
  $('qn-return-highway').disabled=!returnDestination(groups,data());
  $('qn-page-status').textContent=(data().offices||[]).length?'':'거점 데이터를 불러오는 중입니다. GIS 데이터팩이 없으면 먼저 등록해주세요.';
}
function showPage(push=true){
  if(!page.hidden)return;
  previousFocus=document.activeElement;oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  for(const el of document.body.children)if(el!==page&&!['STYLE','SCRIPT'].includes(el.tagName)){inertState.set(el,el.inert);el.inert=true;}
  page.hidden=false;render();$('qn-back').focus();
  if(push&&location.hash!=='#navigation'){history.pushState({quickNavigation:true},'',`${location.pathname}${location.search}#navigation`);pushed=true;}
}
function hidePage(){
  if(flow.open)flow.close();clearFlow();gpsContext=null;page.hidden=true;document.body.style.overflow=oldOverflow;
  for(const [el,value] of inertState)el.inert=value;inertState.clear();previousFocus?.focus?.();
}
function backToGIS(){
  hidePage();
  if(location.hash==='#navigation'){
    if(pushed){pushed=false;history.back();}
    else history.replaceState(history.state,'',`${location.pathname}${location.search}`);
  }
}
function modeOptions(){
  clearFlow();$('qn-flow-title').textContent=activeItem.label;message('이동할 경로를 선택하세요.');
  const row=document.createElement('div');row.className='qn-mode-row';
  for(const [mode,label] of [['highway','고속도로'],['saved','국도']]){
    const b=document.createElement('button');b.type='button';b.className='qn-mode';b.textContent=label;b.addEventListener('click',()=>prepare(mode));row.append(b);
  }$('qn-flow-options').append(row);
}
function begin(item,mode){
  activeItem=item;if(!flow.open)flow.showModal();modeOptions();if(mode)prepare(mode);
}
function addStageBack(){
  const b=document.createElement('button');b.type='button';b.textContent='← 경로 방식 다시 선택';b.style.cssText='padding:12px 0;color:#a5b4fc;background:none;border:0;';b.addEventListener('click',modeOptions);$('qn-flow-options').append(b);
}
async function getOrigin(){
  return resolveQuickOrigin($('qn-origin').value,quickOriginChoices(data()),data(),gpsOrigin);
}
async function gpsOrigin(){
  const now=Date.now();
  if(!gpsContext||now-gpsContext.time>30000){
    if(!gpsPending)gpsPending=gps().then(point=>{gpsContext={point,time:Date.now()};}).finally(()=>{gpsPending=null;});
    await gpsPending;
  }
  return nearestOfficeDeparture(gpsContext.point,data().offices||[],data().interchanges||[],TOLL_GATES);
}
async function prepare(mode){
  clearFlow();const token=serial,item=activeItem;$('qn-flow-title').textContent=item.label;
  message(mode==='highway'?'선택한 출발 거점의 고속도로 경로를 확인하고 있습니다.':'선택한 출발 거점의 저장경로를 확인하고 있습니다.');
  try{
    const start=await getOrigin();
    if(token!==serial||!flow.open||page.hidden)return;
    $('qn-flow-source').textContent=start.departureMode==='nearest-office'?
      `출발: ${start.officeName} · 현재 위치에서 직선 약 ${(start.officeDistance/1000).toFixed(1)}km`:
      `출발: ${start.officeName} · 직접 선택한 거점`;
    const {choices}=await resolveQuickChoices({
      start,item,mode,destination:destinationPoint(item,data()),cache:routeCache(),
      loadGraph,availableOriginOptions,savedDestinationRoute,data:data()
    });
    if(token!==serial||!flow.open||page.hidden)return;
    prepared={item,mode,choices,created:Date.now()};showDirections();
  }catch(e){if(token!==serial||!flow.open)return;message(e.message,true);addStageBack();}
}
function appURL(result){return $('qn-provider').value==='kakao'?kakaoNavigationURL(result,/Android/i.test(navigator.userAgent)):navigationURL(result,location.origin+location.pathname,/Android/i.test(navigator.userAgent));}
function showDirections(){
  if(!prepared)return;$('qn-flow-options').replaceChildren();message('진행할 방향을 누르면 지도앱으로 바로 연결됩니다.');
  for(const choice of prepared.choices){
    const result=choice.result,a=document.createElement('a');a.className='qn-direction'+($('qn-provider').value==='kakao'?' qn-launch-kakao':'');a.href=appURL(result);a.append(document.createTextNode(choice.label));
    const info=document.createElement('small');info.textContent=[result.roads?.map(s=>s.replace('고속도로','선')).join(' → '),result.arrivalDirection,`경유 ${result.waypoints.length}개 · ${$('qn-provider').value==='kakao'?'카카오맵':'네이버지도'}`].filter(Boolean).join(' · ');a.append(info);
    a.addEventListener('click',e=>{
      if(!prepared||Date.now()-prepared.created>120000){e.preventDefault();if(prepared)prepare(prepared.mode);return;}
      // The native app URL is ready before this user click; no asynchronous
      // location fetch here, which would lose mobile launch activation.
      message('지도앱에서 경유지와 최종 경로를 확인해주세요.');
    });$('qn-flow-options').append(a);
  }addStageBack();
}
$('qn-back').addEventListener('click',backToGIS);
$('qn-flow-close').addEventListener('click',()=>flow.close());flow.addEventListener('close',clearFlow);
$('qn-return-highway').addEventListener('click',()=>{const item=returnDestination(groups,data());if(item)begin(item,'highway');});
$('qn-return-saved').addEventListener('click',()=>{const item=returnDestination(groups,data());
  if(item)begin(item,'saved');
  else{$('qn-page-status').textContent='수원신갈영업소 데이터가 없어 복귀 목적지를 선택할 수 없습니다.';}
});
$('qn-origin').addEventListener('change',()=>{
  setOriginPreference($('qn-origin').value,localStorageSafe());
  if(flow.open)flow.close();
  clearFlow();
});
$('qn-provider').addEventListener('change',()=>{try{localStorage.setItem('highway-navigation-provider',$('qn-provider').value);}catch{}if(prepared)showDirections();});
for(const id of ['btn-quick-navigation','btn-quick-navigation-mobile'])$(id)?.addEventListener('click',()=>showPage());
const syncHistory=()=>{if(location.hash==='#navigation')showPage(false);else if(!page.hidden)hidePage();};
window.addEventListener('popstate',syncHistory);window.addEventListener('hashchange',syncHistory);
window.addEventListener('highway:datachange',()=>{gpsContext=null;if(!page.hidden){if(flow.open)flow.close();render();}});
syncHistory();
