import {loadGraph,gps,replaceGraph} from './navigation-runtime.mjs?v=20261110-shortest1';
import {ROAD_QUERY,buildGraph,availableOriginOptions,validPoint,navigationURL} from './highway-routing.mjs?v=20261110-shortest1';
import {officeEndpoint,nearestOfficeDeparture,savedOfficeDeparture,roadFrom,supportsHighwayOffice} from './highway-endpoints.mjs?v=20261110-shortest1';
import {TOLL_GATES} from './highway-tollgates.mjs';
import {kakaoNavigationURL} from './kakao-navigation.mjs?v=20261019-s3-dscoord-ga4';
import {navigationCatalog,destinationPoint,savedDestinationRoute,uncertainCoordinate} from './navigation-catalog.mjs?v=20261110-shortest1';
import {resolveQuickChoices,routeCache} from './quick-route-cache.mjs?v=20261110-shortest1';

let generation=0,previewLayer=null,currentResult=null,openedSelection=null;
const button=document.getElementById('btn-highway-navigation');
const modal=document.createElement('dialog');
modal.id='highway-navigation-dialog';
modal.setAttribute('aria-labelledby','highway-navigation-title');
modal.innerHTML=`<form method="dialog" class="hn-header"><h2 id="highway-navigation-title">길찾기</h2><button aria-label="닫기">✕</button></form>
<div class="hn-body">
<label for="hn-route-mode">경로 방식</label><select id="hn-route-mode">
<option value="highway">고속도로 · 최단거리 1개</option><option value="saved">저장경로 우선 · 미등록 시 목적지 안내</option></select>
<label for="hn-goal">목적지 · 등록된 GIS 지점</label><select id="hn-goal"></select>
<label for="hn-origin-mode">출발지 기준</label><select id="hn-origin-mode"><option value="nearest-office">현재 위치에서 가장 가까운 거점</option><option value="saved-office">출발 거점 직접 선택</option></select>
<label id="hn-origin-office-label" for="hn-origin-office" hidden>출발 거점</label><select id="hn-origin-office" hidden></select>
<p class="hn-muted">현재 위치와 거점 간 거리는 직선거리로 비교합니다. 경로는 선택된 거점부터 계산하며, 거점까지의 이동은 포함하지 않습니다.</p>
<p id="hn-origin-info" class="hn-muted" hidden></p>
<label for="hn-provider">외부 지도앱</label><select id="hn-provider"><option value="kakao">카카오맵</option><option value="naver">네이버지도</option></select>
<button type="button" id="hn-build" class="hn-primary">경로 계산하기</button>
<p id="hn-status" role="status" aria-live="polite"></p><div id="hn-preview"></div>
<a id="hn-launch" class="hn-primary" hidden>선택한 지도앱으로 열기</a>
<p id="hn-launch-note" class="hn-muted" hidden>지도앱은 전달받은 지점 사이를 다시 탐색합니다. GIS의 경로와 같다고 보장할 수 없습니다.</p>
<p id="hn-highway-note" class="hn-muted">고속도로 결과와 거리는 앱에 포함된 도로망 기준입니다. 일방통행·진출입이 확인되지 않는 구간은 경로로 만들지 않습니다. 광암터널관리동은 기존 판교방향 본선 조건을 유지합니다.</p>
<details id="hn-highway-data"><summary>공개 도로 데이터</summary><p class="hn-muted">OpenStreetMap의 허용 노선 5개를 사용합니다. 시설물 좌표를 도로 데이터 서버에 보내지 않습니다.</p>
<label for="hn-import">도로 데이터 가져오기 (Overpass JSON)</label><input id="hn-import" type="file" accept=".json,application/json">
<button id="hn-query" type="button">도로 조회문 복사</button><p class="hn-muted"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors · ODbL</a></p></details></div>`;
document.body.append(modal);
const style=document.createElement('style');
style.textContent=`#highway-navigation-dialog{background:#0f172a;color:#e2e8f0;border:1px solid #475569;border-radius:16px;padding:0;width:min(94vw,540px);max-height:88dvh;margin:auto;font:14px/1.5 system-ui;z-index:9999}#highway-navigation-dialog::backdrop{background:#020617b8}.hn-header{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #334155}.hn-header h2{font-weight:800;font-size:17px}.hn-header button{padding:4px 10px}.hn-body{padding:16px;display:flex;flex-direction:column;gap:12px}.hn-body select{background:#020617;border:1px solid #475569;padding:10px;border-radius:8px;max-width:100%;color:#fff}.hn-primary{display:block;text-align:center;padding:12px;border-radius:10px;background:#0891b2;color:white;font-weight:700;cursor:pointer}.hn-primary[hidden]{display:none}.hn-primary:disabled{opacity:.5;cursor:wait}.hn-muted{color:#94a3b8;font-size:12px}.hn-body ol{padding-left:22px;list-style:decimal}.hn-body details{border-top:1px solid #334155;padding-top:12px;font-size:12px}.hn-body input{max-width:100%;margin:8px 0}.hn-body #hn-query{padding:6px;border:1px solid #475569;border-radius:6px}.hn-body #hn-status[data-error=true]{color:#fda4af}.hn-body a:focus-visible,.hn-body button:focus-visible,.hn-body select:focus-visible{outline:2px solid #67e8f9;outline-offset:3px}`;
document.head.append(style);
const $=id=>document.getElementById(id);
const navData=()=>window.HighwayApp.navigationData||window.HighwayApp.data||{};
let destinations=[],origins=[];
try{$('hn-provider').value=localStorage.getItem('highway-navigation-provider')==='naver'?'naver':'kakao';}catch{}
const blocked=p=>!p||uncertainCoordinate(p)||!validPoint({lat:Number(p.lat),lng:Number(p.lng)});
function status(value,error=false){$('hn-status').textContent=value;$('hn-status').dataset.error=String(error);}
function reset(){generation++;currentResult=null;$('hn-launch').hidden=true;$('hn-launch-note').hidden=true;$('hn-launch').removeAttribute('href');$('hn-preview').replaceChildren();if(previewLayer){previewLayer.remove();previewLayer=null;}}
function optionGroup(label,items){
  const group=document.createElement('optgroup');group.label=label;
  for(const p of items){if(!p)continue;
    const invalid=blocked(p.source)||!validPoint(p);
    const option=new Option(p.name+(invalid?' · 좌표 미확인':''),invalid?'':String(destinations.push(p)-1));
    option.disabled=invalid;group.append(option);
  }
  if(group.children.length)$('hn-goal').append(group);
}
function point(item,label,office=false){
  if(!item)return null;
  const name=label||item.name||item.title||item.id||'선택한 지점';
  if(office){
    if(!supportsHighwayOffice(item))return null;
    const goal=blocked(item)?null:officeEndpoint(item,navData().interchanges||[],TOLL_GATES,name);
    return {...goal,name,source:item,navItem:{kind:'office',id:'office:'+name.replace(/한국도로공사|\s/g,''),label:name,source:item}};
  }
  return {lat:Number(item.lat),lng:Number(item.lng),name,source:item,
    roadHint:roadFrom(`${item.section||''} ${item.route_name||''} ${item.route||''}`),
    navItem:{kind:'facility',id:'facility:'+name,label:name,source:item}};
}
function open(){
  reset();openedSelection=window.HighwayApp.selected;$('hn-origin-info').hidden=true;destinations=[];$('hn-goal').replaceChildren();
  const {data,selected,officeFor}=window.HighwayApp;
  const all=navData();
  if(selected){
    const {type,item}=selected;
    if(type==='inspection'&&item.type==='OFFICE'){
      const office=officeFor(item);if(office)optionGroup('선택한 점검지',[point(office,undefined,true)]);
    }else if(type==='inspection'&&item.type==='LINE'){
      const names=item.line?.manhole_names||[];
      const branch=item.branch_code||(item.branch_name?.includes('동서울')?'DONGSEOUL':item.branch_name?.includes('광주')?'GWANGJU':/중부|광주/.test(item.title||'')?'GWANGJU':'DONGSEOUL');
      optionGroup('선택한 점검계획의 지점',(data.manholes||[]).filter(m=>names.includes(m.name)&&(!m.branch_code||m.branch_code===branch)).map(m=>point(m)));
    }else optionGroup('선택한 지점',[point(item,undefined,type==='office')]);
  }
  const offices=(all.offices||[]).slice().sort((a,b)=>Number(/수원.*(신갈|영업)/.test(b.name))-Number(/수원.*(신갈|영업)/.test(a.name)));
  optionGroup('등록된 거점',offices.map(o=>point(o,undefined,true)));
  const junctions=navigationCatalog(all).filter(g=>['junctions','other-junctions'].includes(g.key)).flatMap(g=>g.items);
  optionGroup('등록된 IC · JC',junctions.map(item=>({
    ...(blocked(item.source)?{lat:NaN,lng:NaN}:destinationPoint(item,all)),name:item.label,source:item.source,navItem:item
  })));
  origins=offices.filter(o=>supportsHighwayOffice(o)&&!blocked(o));
  $('hn-origin-office').replaceChildren(new Option('출발 거점을 선택하세요',''),...origins.map((o,i)=>new Option(o.name,String(i))));
  $('hn-origin-office').hidden=$('hn-origin-office-label').hidden=$('hn-origin-mode').value!=='saved-office';
  optionGroup('등록된 맨홀·수공',(data.manholes||[]).map(m=>point(m,`${m.name} · ${m.section||m.branch_name||''}`)));
  updateMode();modal.showModal();
}
function updateMode(){
  const saved=$('hn-route-mode').value==='saved';
  $('hn-highway-note').hidden=saved;$('hn-highway-data').hidden=saved;
  $('hn-build').textContent=saved?'저장경로 / 목적지 안내':'고속도로 최단거리 계산';
  $('hn-build').disabled=!destinations.length;
  status(!destinations.length?'확인된 좌표의 목적지를 찾지 못했습니다.':saved?'등록된 저장경로가 있으면 우선 사용하고, 없으면 경유지 없이 지도앱에 목적지를 전달합니다.':'한 번 계산하면 앱 도로망 기준 최단거리 결과 하나를 표시합니다.');
}
function appURL(result){
  return $('hn-provider').value==='kakao'?kakaoNavigationURL(result,/Android/i.test(navigator.userAgent)):navigationURL(result,location.origin+location.pathname,/Android/i.test(navigator.userAgent));
}
function refreshLink(){
  if(!currentResult)return;
  $('hn-launch').href=appURL(currentResult);$('hn-launch').hidden=false;
  $('hn-launch').textContent=($('hn-provider').value==='kakao'?'카카오맵':'네이버지도')+'으로 경로 확인';
  $('hn-launch-note').hidden=false;
}
function renderResult(result,start,choiceCount){
  const box=$('hn-preview');const title=document.createElement('p');title.style.fontWeight='700';
  title.textContent=`${result.start.name||start.officeName||'출발지'} → ${result.goal.name||'목적지'}`;box.append(title);
  const note=document.createElement('p');note.className='hn-muted';
  if(result.kind==='destination-only')note.textContent='목적지 안내 · 등록 경유지 없음. 경로 제한 조건은 따로 지정하지 않았습니다. 지도앱이 실제 주행 경로를 계산합니다.';
  else if(result.kind==='highway-shortest')note.textContent=`앱에 포함된 도로망 기준 약 ${(result.length/1000).toFixed(1)}km · 최단거리 1개. 실제 지도앱 경로 및 소요거리는 다를 수 있습니다.`;
  else note.textContent='등록된 저장경로의 출발·경유·도착 순서입니다. 실제 주행 경로는 지도앱에서 확인하세요.';
  box.append(note);
  if(result.roads?.length){const p=document.createElement('p');p.className='hn-muted';p.textContent=result.roads.map(n=>n.replace('고속도로','선')).join(' → ');box.append(p);}
  if(result.arrivalDirection){const p=document.createElement('p');p.className='hn-muted';p.textContent=result.arrivalDirection;box.append(p);}
  if(result.waypoints.length){
    const list=document.createElement('ol');
    for(const w of result.waypoints){const li=document.createElement('li');li.textContent=w.code||w.name;list.append(li);}
    box.append(list);
  }
  const map=window.HighwayApp.map;
  previewLayer=L.layerGroup().addTo(map);
  const shown=[result.start,...result.waypoints,result.goal].filter(validPoint);
  if(result.kind==='highway-shortest'&&result.points?.length>1)
    L.polyline(result.points.map(p=>[p.lat,p.lng]),{color:'#22d3ee',weight:6}).addTo(previewLayer);
  shown.forEach((p,i)=>{
    const label=i===0?'출발':i===shown.length-1?'도착':`${i}. 경유지`;
    L.circleMarker([p.lat,p.lng],{radius:8,color:i===0?'#22c55e':i===shown.length-1?'#f87171':'#22d3ee',fillOpacity:.85}).addTo(previewLayer).bindTooltip(label+': '+(p.code||p.name||''));
  });
  const bounds=result.kind==='highway-shortest'&&result.points?.length>1?result.points:shown;
  if(bounds.length)map.fitBounds(L.latLngBounds(bounds.map(p=>[p.lat,p.lng])),{padding:[35,35]});
  refreshLink();
  status(result.kind==='destination-only'?'목적지 안내 · 등록 경유지 없음. 지도앱에서 최종 주행 경로를 확인하세요.':result.kind==='highway-shortest'?'고속도로 최단거리 결과 1개를 만들었습니다. 앱에 포함된 도로망 기준입니다.':'등록된 저장경로를 우선 적용했습니다. 지도앱에서 경유지와 최종 경로를 확인하세요.');
  const show=document.createElement('button');show.type='button';show.className='hn-primary';show.textContent='GIS 지도에서 표시된 지점 보기';show.addEventListener('click',()=>modal.close('preview'));box.append(show);
}
$('hn-build').addEventListener('click',async()=>{
  reset();const token=generation,goal=$('hn-goal').value===''?null:destinations[Number($('hn-goal').value)];if(!goal){status('목적지 좌표가 미확인·추정 또는 오류로 표시되어 안내를 보류합니다.',true);return;}
  $('hn-build').disabled=true;status('경로를 확인하고 있습니다.');
  try{
    const all=navData(),manual=$('hn-origin-mode').value==='saved-office';
    if(manual&&$('hn-origin-office').value==='')throw new Error('출발 거점을 선택해주세요.');
    const raw=manual?null:await gps();
    if(token!==generation||!modal.open)return;
    const selectedOffice=manual?origins[Number($('hn-origin-office').value)]:null;
    const start=manual?{...savedOfficeDeparture(selectedOffice,all.interchanges||[],TOLL_GATES),departureMode:'manual-office',originId:'office:'+selectedOffice.name.replace(/한국도로공사|\s/g,'')}:
      nearestOfficeDeparture(raw,all.offices||[],all.interchanges||[],TOLL_GATES);
    $('hn-origin-info').hidden=false;
    $('hn-origin-info').textContent=manual?`출발: ${start.officeName} · 직접 선택한 거점`:`출발: ${start.officeName} · 현재 위치에서 직선 약 ${(start.officeDistance/1000).toFixed(1)}km`;
    const item=goal.navItem,destination=goal;
    const {choices}=await resolveQuickChoices({start,item,mode:$('hn-route-mode').value,destination,
      cache:routeCache(),loadGraph,availableOriginOptions,savedDestinationRoute,data:all});
    if(token!==generation||!modal.open)return;
    if(!choices.length)throw new Error('연결 가능한 경로가 없습니다.');
    const chosen=choices[0];
    currentResult={...chosen.result,created:Date.now()};
    renderResult(currentResult,start,choices.length);
  }catch(e){if(token===generation&&modal.open)status(e.message,true);}
  finally{if(token===generation)$('hn-build').disabled=false;}
});
for(const id of ['hn-goal','hn-route-mode','hn-origin-mode','hn-origin-office'])$(id).addEventListener('change',()=>{
  reset();$('hn-origin-info').hidden=true;
  $('hn-origin-office').hidden=$('hn-origin-office-label').hidden=$('hn-origin-mode').value!=='saved-office';
  updateMode();
});
$('hn-provider').addEventListener('change',()=>{try{localStorage.setItem('highway-navigation-provider',$('hn-provider').value);}catch{}if(currentResult)refreshLink();});
$('hn-launch').addEventListener('click',e=>{
  if(!currentResult||currentResult.kind!=='saved'&&Date.now()-currentResult.created>120000){
    e.preventDefault();reset();status('현재 안내를 열기 전 경로를 다시 계산해주세요.',true);
  }
});
$('hn-import').addEventListener('change',async e=>{
  reset();const token=generation;
  try{const f=e.target.files[0];if(!f)return;if(f.size>50*1024*1024)throw new Error('도로 데이터는 50MB 이하로 가져와주세요.');
    const graph=buildGraph(JSON.parse(await f.text()));if(token!==generation)return;replaceGraph(graph);status('허용된 다섯 노선의 데이터를 교체했습니다. 경로를 다시 계산해주세요.');
  }catch(err){status(err.message,true);}finally{$('hn-build').disabled=!destinations.length;e.target.value='';}
});
$('hn-query').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(ROAD_QUERY);status('공개 도로 조회문을 복사했습니다.');}catch{status('클립보드를 사용할 수 없습니다.',true);}});
modal.addEventListener('close',()=>{generation++;$('hn-build').disabled=!destinations.length;if(modal.returnValue!=='preview')reset();modal.returnValue='';});
button?.addEventListener('click',()=>{
  const selected=window.HighwayApp.selected;
  if(currentResult&&selected?.item===openedSelection?.item&&selected?.type===openedSelection?.type&&Date.now()-currentResult.created<120000&&!modal.open){modal.showModal();return;}
  open();
});
