import {loadGraph,gps,replaceGraph} from './navigation-runtime.mjs?v=20261018-toll-office2';
import {ROAD_QUERY,buildGraph,route,availableOriginOptions,validPoint,navigationURL} from './highway-routing.mjs?v=20261018-toll-office2';
import {officeEndpoint,departureEndpoint,nearestOfficeDeparture,savedOfficeDeparture,roadFrom,supportsHighwayOffice} from './highway-endpoints.mjs?v=20261018-toll-office2';
import {TOLL_GATES} from './highway-tollgates.mjs';
import {SAVED_HUBS,savedRoute} from './saved-navigation.mjs?v=20261018-toll-office2';
import {kakaoNavigationURL} from './kakao-navigation.mjs?v=20261018-toll-office2';

let generation=0, previewLayer, currentResult, context, openedSelection;
const button=document.getElementById('btn-highway-navigation');
const modal=document.createElement('dialog');
modal.id='highway-navigation-dialog';
modal.setAttribute('aria-labelledby','highway-navigation-title');
modal.innerHTML=`<form method="dialog" class="hn-header"><h2 id="highway-navigation-title">길찾기</h2><button aria-label="닫기">✕</button></form>
  <div class="hn-body"><label for="hn-route-mode">경로 방식</label><select id="hn-route-mode"><option value="highway">고속도로</option><option value="saved">저장 경로</option></select>
  <div id="hn-saved-controls" class="hn-fields" hidden>
  <label for="hn-saved-start">출발지</label><select id="hn-saved-start"></select>
  <label for="hn-saved-goal">목적지</label><select id="hn-saved-goal"></select>
  <p class="hn-muted">수원신갈영업소에서 송파IC로 가는 경유지 3개를 그대로 사용합니다. 수원신갈톨게이트는 통과할 수 있습니다. 실제 주행 경로는 연결한 지도앱에서 확인하세요.</p></div>
  <div id="hn-highway-controls" class="hn-fields"><label for="hn-goal">목적지 · 저장된 GIS 지점</label><select id="hn-goal"></select>
  <label for="hn-origin-mode">출발지 기준</label><select id="hn-origin-mode"><option value="nearest-office">현재 위치에서 가장 가까운 거점</option></select>
  <label id="hn-origin-office-label" for="hn-origin-office" hidden>출발 거점</label><select id="hn-origin-office" hidden></select>
  <p class="hn-muted">가까운 거점은 현재 위치와의 직선거리로 고릅니다. 거점 출발은 그 거점부터의 경로이며, 현재 위치에서 거점까지의 이동은 포함하지 않습니다.</p>
  <p id="hn-origin-info" class="hn-muted" hidden></p>
  <p class="hn-muted">거점은 지정된 톨게이트·IC 접속점으로 안내합니다. 광암터널관리동은 지정 위치를 사용하며, 교통센터는 제외합니다. 제2중부선은 그 위의 점검 지점을 갈 때만 이용합니다.</p>
  <label id="hn-direction-label" for="hn-direction" hidden>출발 고속도로 · 진행 방향</label><select id="hn-direction" hidden></select></div>
  <button type="button" id="hn-build" class="hn-primary">고속도로 경로 만들기</button>
  <p id="hn-status" role="status" aria-live="polite"></p><div id="hn-preview"></div>
  <a id="hn-launch" class="hn-primary" hidden>네이버지도에서 경로 확인</a>
  <a id="hn-kakao-launch" class="hn-primary hn-kakao" hidden>카카오맵 앱에서 경로 확인</a>
  <p id="hn-kakao-note" class="hn-muted" hidden>카카오맵이 설치된 휴대폰에서 열어주세요. 선택한 출발·도착·경유지를 전달합니다. 앱에서 실제 경로를 확인한 후 안내를 시작합니다.</p>
  <p id="hn-highway-note" class="hn-muted">고속도로 본선과 노선 간 연결로로 경유지를 만듭니다. 진출입 구간은 일반도로가 포함될 수 있으며, 네이버가 계산한 최종 경로는 다를 수 있습니다.</p>
  <details id="hn-highway-data"><summary>공개 도로 데이터</summary><p class="hn-muted">앱에 포함된 OpenStreetMap의 다섯 노선을 이용합니다. 현재 위치와 시설물 좌표는 도로 데이터 서버에 전송하지 않습니다. 갱신한 원본 OSM JSON 파일을 가져와 사용할 수도 있습니다.</p>
  <label for="hn-import">도로 데이터 가져오기 (Overpass JSON)</label><input id="hn-import" type="file" accept=".json,application/json"><button id="hn-query" type="button">도로 조회문 복사</button>
  <p class="hn-muted"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors · ODbL</a></p></details></div>`;
document.body.append(modal);
const style=document.createElement('style');
style.textContent=`#highway-navigation-dialog{background:#0f172a;color:#e2e8f0;border:1px solid #475569;border-radius:16px;padding:0;width:min(94vw,540px);max-height:88dvh;margin:auto;font:14px/1.5 system-ui;z-index:9999}#highway-navigation-dialog::backdrop{background:#020617b8}.hn-header{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #334155}.hn-header h2{font-weight:800;font-size:17px}.hn-header button{padding:4px 10px}.hn-body{padding:16px;display:flex;flex-direction:column;gap:12px}.hn-body select{background:#020617;border:1px solid #475569;padding:10px;border-radius:8px;max-width:100%;color:#fff}.hn-primary{display:block;text-align:center;padding:12px;border-radius:10px;background:#0891b2;color:white;font-weight:700;cursor:pointer}.hn-primary[hidden]{display:none}.hn-primary:disabled{opacity:.5;cursor:wait}.hn-muted{color:#94a3b8;font-size:12px}.hn-body ol{padding-left:22px;list-style:decimal}.hn-body details{border-top:1px solid #334155;padding-top:12px;font-size:12px}.hn-body input{max-width:100%;margin:8px 0}.hn-body #hn-query{padding:6px;border:1px solid #475569;border-radius:6px}.hn-body #hn-status[data-error=true]{color:#fda4af}.hn-body a:focus-visible,.hn-body button:focus-visible,.hn-body select:focus-visible{outline:2px solid #67e8f9;outline-offset:3px}`;
document.head.append(style);
style.textContent+=' .hn-fields{display:flex;flex-direction:column;gap:12px}.hn-fields[hidden]{display:none}';
style.textContent+=' .hn-kakao{background:#fee500;color:#191919}';
const $=id=>document.getElementById(id);
let destinations=[],origins=[];
const canBuild=()=>$('hn-route-mode').value==='saved'||destinations.length>0;
for(const id of ['hn-saved-start','hn-saved-goal'])$(id).replaceChildren(...SAVED_HUBS.filter(h=>h.id===(id==='hn-saved-start'?'suwon':'songpa')).map(h=>new Option(h.name,h.id)));
$('hn-saved-goal').value='songpa';
function updateMode(){
  const saved=$('hn-route-mode').value==='saved';
  $('hn-saved-controls').hidden=!saved;$('hn-highway-controls').hidden=saved;
  $('hn-highway-note').hidden=saved;$('hn-highway-data').hidden=saved;
  $('hn-build').textContent=saved?'저장 경로 불러오기':'고속도로 경로 만들기';
  $('hn-build').disabled=!canBuild();
  status(saved?'출발지와 목적지를 고른 뒤 저장 경로를 불러오세요.':destinations.length?'목적지와 출발지를 고른 뒤 경로를 만드세요.':'좌표가 있는 데이터팩을 먼저 불러오세요.');
}
function status(text,error=false){$('hn-status').textContent=text;$('hn-status').dataset.error=String(error);}
function reset(){generation++;currentResult=null;for(const id of ['hn-launch','hn-kakao-launch']){$(id).hidden=true;$(id).removeAttribute('href');}$('hn-kakao-note').hidden=true;$('hn-preview').replaceChildren();if(previewLayer){previewLayer.remove();previewLayer=null;}}
function optionGroup(label,items){
  const group=document.createElement('optgroup');group.label=label;
  for(const p of items){if(!validPoint(p))continue;const i=destinations.push(p)-1;const o=new Option(p.name,String(i));group.append(o);}
  if(group.children.length)$('hn-goal').append(group);
}
function point(item,label,office=false){
  if(office)return supportsHighwayOffice(item)?officeEndpoint(item,window.HighwayApp.data.interchanges||[],TOLL_GATES,label):null;
  const approximate=['ESTIMATED','SOURCE_ERROR'].includes(item?.coordinate_status);
  return {lat:Number(item?.lat),lng:Number(item?.lng),roadHint:roadFrom(`${item?.section||''} ${item?.route_name||''} ${item?.route||''}`),name:(label||item?.name||item?.title||item?.id||'선택한 지점')+(approximate?' · 추정 위치':'')};
}
function open(){
  reset();context=null;openedSelection=window.HighwayApp.selected;$('hn-origin-info').hidden=true;$('hn-direction').replaceChildren();$('hn-direction').hidden=true;$('hn-direction-label').hidden=true;destinations=[];$('hn-goal').replaceChildren();
  const {data,selected,officeFor}=window.HighwayApp;
  if(selected){const {type,item}=selected;
    if(type==='inspection'&&item.type==='OFFICE'){const off=officeFor(item);if(off)optionGroup('선택한 점검지',[point(off,undefined,true)]);}
    else if(type==='inspection'&&item.type==='LINE'){
      const names=item.line?.manhole_names||[];
      const branch=item.branch_code || (item.branch_name?.includes('동서울')?'DONGSEOUL':item.branch_name?.includes('광주')?'GWANGJU':/중부|광주/.test(item.title||'')?'GWANGJU':'DONGSEOUL');
      optionGroup('선택한 점검계획의 지점',(data.manholes||[]).filter(m=>names.includes(m.name)&&(!m.branch_code||m.branch_code===branch)).map(m=>point(m)));
    }else optionGroup('선택한 지점',[point(item,undefined,type==='office')]);
  }
  const offices=(data.offices||[]).slice().sort((a,b)=>Number(/수원.*(신갈|영업)/.test(b.name))-Number(/수원.*(신갈|영업)/.test(a.name)));
  optionGroup('저장된 거점',offices.map(o=>point(o,undefined,true)));
  origins=offices.filter(o=>supportsHighwayOffice(o)&&validPoint({lat:Number(o.lat),lng:Number(o.lng)}));
  $('hn-origin-office').replaceChildren(new Option('출발 거점을 선택하세요',''),...origins.map((o,i)=>new Option(o.name,String(i))));
  $('hn-origin-office').hidden=$('hn-origin-office-label').hidden=$('hn-origin-mode').value!=='saved-office';
  optionGroup('저장된 맨홀·수공',(data.manholes||[]).map(m=>point(m,`${m.name} · ${m.section||m.branch_name||''}`)));
  updateMode();
  modal.showModal();
}
function showSavedRoute(){
  try{
    const result=savedRoute($('hn-saved-start').value,$('hn-saved-goal').value,window.HighwayApp.data.offices||[]);
    currentResult={...result,created:Date.now()};
    const box=$('hn-preview'),title=document.createElement('p');title.style.fontWeight='700';title.textContent=`${result.start.name} → ${result.goal.name}`;box.append(title);
    const list=document.createElement('ol');for(const wp of result.waypoints){const li=document.createElement('li');li.textContent=wp.code;list.append(li);}box.append(list);
    const note=document.createElement('p');note.className='hn-muted';note.textContent='지도에는 출발·도착·경유지 위치만 표시합니다. 도로를 따라가는 실제 경로는 연결한 지도앱에서 확인하세요.';box.append(note);
    const map=window.HighwayApp.map;previewLayer=L.layerGroup().addTo(map);
    for(const [i,p] of result.points.entries()){
      const label=document.createElement('span');label.textContent=i===0?`출발: ${p.name}`:i===result.points.length-1?`도착: ${p.name}`:`${i}. ${p.code}`;
      L.circleMarker([p.lat,p.lng],{radius:8,color:i===0?'#22c55e':i===result.points.length-1?'#f87171':'#22d3ee',fillOpacity:.8}).addTo(previewLayer).bindTooltip(label);
    }
    map.fitBounds(L.latLngBounds(result.points.map(p=>[p.lat,p.lng])),{padding:[35,35]});
    $('hn-launch').href=navigationURL(result,location.origin+location.pathname,/Android/i.test(navigator.userAgent));$('hn-launch').hidden=false;
    $('hn-kakao-launch').href=kakaoNavigationURL(result,/Android/i.test(navigator.userAgent));$('hn-kakao-launch').hidden=false;$('hn-kakao-note').hidden=false;
    const show=document.createElement('button');show.type='button';show.className='hn-primary';show.textContent='GIS 지도에서 저장 지점 보기';show.addEventListener('click',()=>modal.close('preview'));box.append(show);
    status('저장 경유지 3개를 준비했습니다. 네이버지도 또는 카카오맵 앱에서 원하는 길로 연결되는지 확인하세요.');
  }catch(e){status(e.message,true);}
}
$('hn-build').addEventListener('click',async()=>{
  reset();if($('hn-route-mode').value==='saved'){showSavedRoute();return;}
  const token=generation, goal=destinations[Number($('hn-goal').value)];
  if(!goal)return;
  $('hn-build').disabled=true;status('출발지와 고속도로 지도를 확인하고 있습니다.');
  try{
    const manual=$('hn-origin-mode').value==='saved-office';
    if(manual&&$('hn-origin-office').value==='')throw new Error('출발 거점을 선택해주세요.');
    const [rawStart,graph]=context && Date.now()-context.time<30000?[context.start,context.graph]:await Promise.all([manual?null:gps(),loadGraph()]);
    if(token!==generation||!modal.open)return;
    const data=window.HighwayApp.data;
    const fromOffice=$('hn-origin-mode').value==='nearest-office';
    const start=manual?savedOfficeDeparture(origins[Number($('hn-origin-office').value)],data.interchanges||[],TOLL_GATES):fromOffice?nearestOfficeDeparture(rawStart,data.offices||[],data.interchanges||[],TOLL_GATES):departureEndpoint(graph,rawStart,data.offices||[],data.interchanges||[],TOLL_GATES);
    $('hn-origin-info').hidden=false;
    $('hn-origin-info').textContent=manual?`출발: ${start.officeName} · 선택한 거점 기준 경로입니다.`:fromOffice?`출발: ${start.officeName} · 현재 위치에서 직선 약 ${(start.officeDistance/1000).toFixed(1)}km`:`출발: ${start.endpointKind==='office'?start.name:'현재 위치'}`;
    const {choices,rejected}=availableOriginOptions(graph,start,goal);
    if(!choices.length)throw new Error(rejected[0]?.error||'이 출발지와 목적지를 연결하는 경로가 없습니다.');
    const corridorChoices=choices.some(c=>c.key.includes('|'));
    if((corridorChoices||!Number.isFinite(start.heading)) && choices.length>1){
      const direction=$('hn-direction');
      if(!context || !choices.some(c=>c.key===direction.value)){
        direction.replaceChildren(new Option(corridorChoices?'중간에 거칠 분기점 경로를 선택하세요':'출발 지점에서 진행할 방향을 선택하세요',''),...choices.map(c=>new Option(c.label,c.key)));
        direction.hidden=false;$('hn-direction-label').hidden=false;context={start:rawStart,graph,time:Date.now()};
        $('hn-direction-label').textContent=corridorChoices?'중간 경유 경로':'출발 지점의 고속도로 · 진행 방향';
        status(corridorChoices?'두 경로 모두 경부선 북상으로 출발합니다. 판교·하남 또는 신갈·호법에서 연결되는 경로를 선택하고 다시 만드세요.':manual||fromOffice?'출발 거점에서 진행할 고속도로·방향을 선택하고 경로 만들기를 다시 누르세요.':'GPS에서 진행 방향을 확인할 수 없습니다. 출발 지점에서 진행할 고속도로·방향을 선택하고 경로 만들기를 다시 누르세요.');return;
      }
    }
    if(choices.length===1){$('hn-direction').hidden=true;$('hn-direction-label').hidden=true;}
    const sourceKey=corridorChoices||!Number.isFinite(start.heading)?(choices.length===1?choices[0].key:$('hn-direction').value)||null:null;
    const result=sourceKey?choices.find(c=>c.key===sourceKey).result:route(graph,start,goal,start.heading);
    currentResult={...result,created:Date.now()};
    const box=$('hn-preview'),title=document.createElement('p');title.style.fontWeight='700';title.textContent=goal.name;box.append(title);
    const roads=document.createElement('p');roads.textContent=result.roads.map(n=>n.replace('고속도로','선')).join(' → ');box.append(roads);
    if(start.endpointKind==='office'){const p=document.createElement('p');p.className='hn-muted';p.textContent=`출발 보정: ${result.start.name}`;box.append(p);}
    if(goal.endpointKind==='office'){const p=document.createElement('p');p.className='hn-muted';p.textContent=goal.endpointNote||(result.arrivalAtOffice?'통과형 톨게이트는 저장된 영업소 위치로 안내합니다.':result.arrivalAtToll?'도착지는 선택한 접근 방향의 실제 톨게이트입니다.':'도착지는 지정된 IC 본선 접속점입니다.');box.append(p);}
    if(result.arrivalDirection){const p=document.createElement('p');p.className='hn-muted';p.textContent=`도착 방향: ${result.arrivalDirection}`;box.append(p);}
    if(result.arrivalOffset){const p=document.createElement('p');p.className='hn-muted';p.textContent=`넓은 요금소 영역에서 반대편으로 잡히지 않도록 통과 후 약 ${result.arrivalOffset}m의 같은 방향 본선으로 안내합니다.`;box.append(p);}
    const info=document.createElement('p');info.className='hn-muted';info.textContent=`본선 약 ${(result.length/1000).toFixed(1)}km · 접속 직선거리 출발 ${Math.round(result.entryGap)}m / 도착 ${Math.round(result.exitGap)}m${Number.isFinite(start.accuracy)?` · GPS 오차 ${Math.round(start.accuracy)}m`:''}`;box.append(info);
    const list=document.createElement('ol');for(const wp of result.waypoints){const li=document.createElement('li');li.textContent=wp.name.replace(/^\d+\. /,'');list.append(li);}box.append(list);
    const map=window.HighwayApp.map;
    previewLayer=L.layerGroup().addTo(map);
    L.polyline(result.points.map(p=>[p.lat,p.lng]),{color:'#22d3ee',weight:6}).addTo(previewLayer);
    L.marker([result.goal.lat,result.goal.lng]).addTo(previewLayer).bindTooltip(`도착: ${result.goal.name}`);
    result.waypoints.forEach((wp,i)=>L.marker([wp.lat,wp.lng]).addTo(previewLayer).bindTooltip(`${i+1}. ${wp.name.replace(/^\d+\. /,'')}`));
    map.fitBounds(L.latLngBounds(result.points.map(p=>[p.lat,p.lng])),{padding:[35,35]});
    $('hn-launch').href=navigationURL(result,location.origin+location.pathname,/Android/i.test(navigator.userAgent));$('hn-launch').hidden=false;
    $('hn-kakao-launch').href=kakaoNavigationURL(result,/Android/i.test(navigator.userAgent));$('hn-kakao-launch').hidden=false;$('hn-kakao-note').hidden=false;
    status('경유지가 준비됐습니다. 지도에서 출발 방향·진입 위치와 지도앱의 최종 경로를 확인하세요.');
    const show=document.createElement('button');show.type='button';show.className='hn-primary';show.textContent='GIS 지도에서 경로 보기';show.addEventListener('click',()=>{modal.close('preview');});box.append(show);
  }catch(e){if(token===generation&&modal.open)status(e.message,true);}
  finally{if(token===generation)$('hn-build').disabled=false;}
});
$('hn-route-mode').addEventListener('change',()=>{reset();context=null;$('hn-direction').replaceChildren();$('hn-direction').hidden=true;$('hn-direction-label').hidden=true;updateMode();});
for(const id of ['hn-saved-start','hn-saved-goal'])$(id).addEventListener('change',()=>{
  reset();context=null;
  status('저장 경로의 출발·도착지가 바뀌었습니다. 다시 불러오세요.');
});
$('hn-goal').addEventListener('change',()=>{reset();$('hn-build').disabled=false;status('목적지가 바뀌었습니다. 경로를 다시 만드세요.');});
$('hn-direction').addEventListener('change',()=>{reset();$('hn-build').disabled=false;status('경로 선택을 반영하려면 경로 만들기를 누르세요.');});
$('hn-origin-mode').addEventListener('change',()=>{
  reset();context=null;$('hn-origin-info').hidden=true;$('hn-direction').replaceChildren();$('hn-direction').hidden=true;$('hn-direction-label').hidden=true;
  $('hn-origin-office').hidden=$('hn-origin-office-label').hidden=$('hn-origin-mode').value!=='saved-office';
  $('hn-build').disabled=!canBuild();status('출발지 기준이 바뀌었습니다. 경로를 다시 만드세요.');
});
$('hn-origin-office').addEventListener('change',()=>{
  reset();context=null;$('hn-origin-info').hidden=true;$('hn-direction').replaceChildren();$('hn-direction').hidden=true;$('hn-direction-label').hidden=true;
  $('hn-build').disabled=!canBuild();status('출발 거점이 바뀌었습니다. 경로를 다시 만드세요.');
});
for(const id of ['hn-launch','hn-kakao-launch'])$(id).addEventListener('click',e=>{
  if(!currentResult||currentResult.kind!=='saved'&&Date.now()-currentResult.created>120000){e.preventDefault();reset();status('출발 위치를 갱신하기 위해 경로를 다시 만드세요.');return;}
});
$('hn-import').addEventListener('change',async e=>{
  reset();context=null;$('hn-direction').replaceChildren();$('hn-direction').hidden=true;$('hn-direction-label').hidden=true;const token=generation;
  try{const f=e.target.files[0];if(!f)return;if(f.size>50*1024*1024)throw new Error('도로 파일은 50MB 이하로 가져오세요.');
    const graph=buildGraph(JSON.parse(await f.text()));if(token!==generation)return;replaceGraph(graph);status('다섯 노선 도로 데이터를 가져왔습니다. 현재 위치로 경로를 만드세요.');
  }catch(err){status(err.message,true);}finally{$('hn-build').disabled=!canBuild();e.target.value='';}
});
$('hn-query').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(ROAD_QUERY);status('다섯 노선의 공개 도로 조회문을 복사했습니다. Overpass Turbo에서 실행 후 원본 JSON으로 내보내세요.');}catch{status('클립보드를 사용할 수 없습니다.',true);}});
modal.addEventListener('close',()=>{generation++;$('hn-build').disabled=!canBuild();if(modal.returnValue!=='preview'){reset();}modal.returnValue='';});
button.addEventListener('click',()=>{
  // Reopen a prepared preview without discarding the launch link.
  const selected=window.HighwayApp.selected;
  if(currentResult && selected?.item===openedSelection?.item && selected?.type===openedSelection?.type && Date.now()-currentResult.created<120000 && !modal.open){modal.showModal();return;}
  open();
});
