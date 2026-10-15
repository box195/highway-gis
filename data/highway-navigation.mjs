import {ROAD_QUERY,buildGraph,route,originOptions,validPoint,navigationURL} from './highway-routing.mjs';

let graphPromise, generation=0, previewLayer, currentResult, context, openedSelection;
const button=document.getElementById('btn-highway-navigation');
const modal=document.createElement('dialog');
modal.id='highway-navigation-dialog';
modal.setAttribute('aria-labelledby','highway-navigation-title');
modal.innerHTML=`<form method="dialog" class="hn-header"><h2 id="highway-navigation-title">고속도로 경유지 안내</h2><button aria-label="닫기">✕</button></form>
  <div class="hn-body"><label for="hn-goal">목적지 · 저장된 GIS 지점</label><select id="hn-goal"></select>
  <p class="hn-muted">현재 위치에서 출발 · 수도권제1순환선 / 경부선 / 중부선 / 제2중부선 / 영동선</p>
  <label id="hn-direction-label" for="hn-direction" hidden>출발 고속도로 · 진행 방향</label><select id="hn-direction" hidden></select>
  <button type="button" id="hn-build" class="hn-primary">현재 위치로 고속도로 경로 만들기</button>
  <p id="hn-status" role="status" aria-live="polite"></p><div id="hn-preview"></div>
  <a id="hn-launch" class="hn-primary" hidden>네이버지도에서 경로 확인</a>
  <p class="hn-muted">고속도로 본선과 노선 간 연결로로 경유지를 만듭니다. 진출입 구간은 일반도로가 포함될 수 있으며, 네이버가 계산한 최종 경로는 다를 수 있습니다.</p>
  <details><summary>공개 도로 데이터</summary><p class="hn-muted">OpenStreetMap의 다섯 노선 전체를 조회합니다. 현재 위치와 시설물 좌표는 이 조회에 전송하지 않습니다. 공개 API 연결이 안 되면 동일한 Overpass JSON 파일을 가져올 수 있습니다.</p>
  <label for="hn-import">도로 데이터 가져오기 (Overpass JSON)</label><input id="hn-import" type="file" accept=".json,application/json"><button id="hn-query" type="button">도로 조회문 복사</button>
  <p class="hn-muted"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors · ODbL</a></p></details></div>`;
document.body.append(modal);
const style=document.createElement('style');
style.textContent=`#highway-navigation-dialog{background:#0f172a;color:#e2e8f0;border:1px solid #475569;border-radius:16px;padding:0;width:min(94vw,540px);max-height:88dvh;margin:auto;font:14px/1.5 system-ui;z-index:9999}#highway-navigation-dialog::backdrop{background:#020617b8}.hn-header{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #334155}.hn-header h2{font-weight:800;font-size:17px}.hn-header button{padding:4px 10px}.hn-body{padding:16px;display:flex;flex-direction:column;gap:12px}.hn-body select{background:#020617;border:1px solid #475569;padding:10px;border-radius:8px;max-width:100%;color:#fff}.hn-primary{display:block;text-align:center;padding:12px;border-radius:10px;background:#0891b2;color:white;font-weight:700;cursor:pointer}.hn-primary[hidden]{display:none}.hn-primary:disabled{opacity:.5;cursor:wait}.hn-muted{color:#94a3b8;font-size:12px}.hn-body ol{padding-left:22px;list-style:decimal}.hn-body details{border-top:1px solid #334155;padding-top:12px;font-size:12px}.hn-body input{max-width:100%;margin:8px 0}.hn-body #hn-query{padding:6px;border:1px solid #475569;border-radius:6px}.hn-body #hn-status[data-error=true]{color:#fda4af}.hn-body a:focus-visible,.hn-body button:focus-visible,.hn-body select:focus-visible{outline:2px solid #67e8f9;outline-offset:3px}`;
document.head.append(style);
const $=id=>document.getElementById(id);
let destinations=[];
function status(text,error=false){$('hn-status').textContent=text;$('hn-status').dataset.error=String(error);}
function reset(){generation++;currentResult=null;$('hn-launch').hidden=true;$('hn-launch').removeAttribute('href');$('hn-preview').replaceChildren();if(previewLayer){previewLayer.remove();previewLayer=null;}}
function optionGroup(label,items){
  const group=document.createElement('optgroup');group.label=label;
  for(const p of items){if(!validPoint(p))continue;const i=destinations.push(p)-1;const o=new Option(p.name,String(i));group.append(o);}
  if(group.children.length)$('hn-goal').append(group);
}
function point(item,label){
  const approximate=['ESTIMATED','SOURCE_ERROR'].includes(item?.coordinate_status);
  return {lat:Number(item?.lat),lng:Number(item?.lng),name:(label||item?.name||item?.title||item?.id||'선택한 지점')+(approximate?' · 추정 위치':'')};
}
function open(){
  reset();context=null;openedSelection=window.HighwayApp.selected;$('hn-direction').hidden=true;$('hn-direction-label').hidden=true;destinations=[];$('hn-goal').replaceChildren();
  const {data,selected,officeFor}=window.HighwayApp;
  if(selected){const {type,item}=selected;
    if(type==='inspection'&&item.type==='OFFICE'){const off=officeFor(item);if(off)optionGroup('선택한 점검지',[point(off)]);}
    else if(type==='inspection'&&item.type==='LINE'){
      const names=item.line?.manhole_names||[];
      const branch=item.branch_code || (item.branch_name?.includes('동서울')?'DONGSEOUL':item.branch_name?.includes('광주')?'GWANGJU':/중부|광주/.test(item.title||'')?'GWANGJU':'DONGSEOUL');
      optionGroup('선택한 점검계획의 지점',(data.manholes||[]).filter(m=>names.includes(m.name)&&(!m.branch_code||m.branch_code===branch)).map(m=>point(m)));
    }else optionGroup('선택한 지점',[point(item)]);
  }
  const offices=(data.offices||[]).slice().sort((a,b)=>Number(/수원.*(신갈|영업)/.test(b.name))-Number(/수원.*(신갈|영업)/.test(a.name)));
  optionGroup('저장된 거점',offices.map(o=>point(o,`${o.name}${o.branch_name||o.branch_code?' · '+(o.branch_name||({DONGSEOUL:'동서울',GWANGJU:'경기광주'}[o.branch_code]||o.branch_code)):''}`)));
  optionGroup('저장된 맨홀·수공',(data.manholes||[]).map(m=>point(m,`${m.name} · ${m.section||m.branch_name||''}`)));
  status(destinations.length?'목적지를 선택한 뒤 현재 위치로 경로를 만드세요.':'좌표가 있는 데이터팩을 먼저 불러오세요.');
  $('hn-build').disabled=!destinations.length;
  modal.showModal();
}
async function loadGraph(){
  if(graphPromise)return graphPromise;
  graphPromise=(async()=>{
    let cache;const key=new URL('./highway-public-road-cache.json',import.meta.url).href;
    try{cache=await caches.open('highway-public-road-v1');const saved=await cache.match(key);
      if(saved && Date.now()-Number(saved.headers.get('x-saved-at'))<7*86400000)return buildGraph(await saved.json());
    }catch{/* Caching is optional, including private browsing. */}
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),135000);
    try{
      const res=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:ROAD_QUERY}),signal:controller.signal});
      if(!res.ok)throw new Error('HTTP '+res.status);
      const osm=await res.json();if(osm.remark)throw new Error(osm.remark);
      const graph=buildGraph(osm);
      try{await cache?.put(key,new Response(JSON.stringify(osm),{headers:{'Content-Type':'application/json','x-saved-at':String(Date.now())}}));}catch{/* Quota failure does not block navigation. */}
      return graph;
    }catch(error){throw new Error('공개 도로 데이터를 불러오지 못했습니다. 잠시 후 다시 시도하거나 공개 도로 데이터 메뉴에서 Overpass JSON을 가져오세요. ('+(error.name==='AbortError'?'응답 시간 초과':error.message)+')');}
    finally{clearTimeout(timeout);}
  })().catch(e=>{graphPromise=null;throw e;});
  return graphPromise;
}
function gps(){return new Promise((resolve,reject)=>{
  if(!window.isSecureContext)return reject(new Error('위치 기능은 HTTPS 또는 localhost에서 사용할 수 있습니다.'));
  if(!navigator.geolocation)return reject(new Error('이 브라우저는 현재 위치를 지원하지 않습니다.'));
  navigator.geolocation.getCurrentPosition(p=>{
    if(p.coords.accuracy>150)return reject(new Error('현재 위치의 오차가 150m보다 큽니다. GPS 수신이 좋은 곳에서 다시 시도하세요.'));
    resolve({lat:p.coords.latitude,lng:p.coords.longitude,heading:p.coords.speed>2?p.coords.heading:null,accuracy:p.coords.accuracy});
  },e=>reject(new Error(({1:'위치 권한을 허용한 뒤 다시 시도하세요.',2:'현재 위치를 확인할 수 없습니다.',3:'현재 위치 요청 시간이 초과됐습니다.'})[e.code]||'위치를 가져오지 못했습니다.')),{enableHighAccuracy:true,timeout:20000,maximumAge:0});
});}
$('hn-build').addEventListener('click',async()=>{
  reset();const token=generation, goal=destinations[Number($('hn-goal').value)];
  if(!goal)return;
  $('hn-build').disabled=true;status('GPS와 공개 고속도로 데이터를 확인하고 있습니다. 최초 도로 조회에는 최대 2분 정도 걸릴 수 있습니다.');
  try{
    const [start,graph]=context && Date.now()-context.time<30000?[context.start,context.graph]:await Promise.all([gps(),loadGraph()]);
    if(token!==generation||!modal.open)return;
    const choices=originOptions(graph,start);
    if(!Number.isFinite(start.heading) && choices.length>1){
      const direction=$('hn-direction');
      if(!context || !choices.some(c=>c.key===direction.value)){
        direction.replaceChildren(new Option('현재 주행할 방향을 선택하세요',''),...choices.map(c=>new Option(c.label,c.key)));
        direction.hidden=false;$('hn-direction-label').hidden=false;context={start,graph,time:Date.now()};
        status('GPS에서 진행 방향을 확인할 수 없습니다. 출발할 고속도로·방향을 선택하고 경로 만들기를 다시 누르세요.');return;
      }
    }
    const sourceKey=Number.isFinite(start.heading)?null:$('hn-direction').value||null;
    const result=route(graph,start,goal,start.heading,sourceKey);
    currentResult={...result,created:Date.now()};
    const box=$('hn-preview'),title=document.createElement('p');title.style.fontWeight='700';title.textContent=goal.name;box.append(title);
    const roads=document.createElement('p');roads.textContent=result.roads.map(n=>n.replace('고속도로','선')).join(' → ');box.append(roads);
    const info=document.createElement('p');info.className='hn-muted';info.textContent=`본선 약 ${(result.length/1000).toFixed(1)}km · 접속 직선거리 출발 ${Math.round(result.entryGap)}m / 도착 ${Math.round(result.exitGap)}m · GPS 오차 ${Math.round(start.accuracy)}m`;box.append(info);
    const list=document.createElement('ol');for(const wp of result.waypoints){const li=document.createElement('li');li.textContent=wp.name.replace(/^\d+\. /,'');list.append(li);}box.append(list);
    const map=window.HighwayApp.map;
    previewLayer=L.layerGroup().addTo(map);
    L.polyline(result.points.map(p=>[p.lat,p.lng]),{color:'#22d3ee',weight:6}).addTo(previewLayer);
    result.waypoints.forEach((wp,i)=>L.marker([wp.lat,wp.lng]).addTo(previewLayer).bindTooltip(`${i+1}. ${wp.name.replace(/^\d+\. /,'')}`));
    map.fitBounds(L.latLngBounds(result.points.map(p=>[p.lat,p.lng])),{padding:[35,35]});
    $('hn-launch').href=navigationURL(result,location.origin+location.pathname,/Android/i.test(navigator.userAgent));$('hn-launch').hidden=false;
    status('경유지가 준비됐습니다. 지도에서 출발 방향·진입 위치와 네이버 최종 경로를 확인하세요.');
    const show=document.createElement('button');show.type='button';show.className='hn-primary';show.textContent='GIS 지도에서 경로 보기';show.addEventListener('click',()=>{modal.close('preview');});box.append(show);
  }catch(e){if(token===generation&&modal.open)status(e.message,true);}
  finally{if(token===generation)$('hn-build').disabled=false;}
});
$('hn-goal').addEventListener('change',()=>{reset();$('hn-build').disabled=false;status('목적지가 바뀌었습니다. 경로를 다시 만드세요.');});
$('hn-direction').addEventListener('change',()=>{reset();$('hn-build').disabled=false;status('출발 방향을 선택했습니다. 경로 만들기를 누르세요.');});
$('hn-launch').addEventListener('click',e=>{
  if(!currentResult||Date.now()-currentResult.created>120000){e.preventDefault();reset();status('출발 위치를 갱신하기 위해 경로를 다시 만드세요.');return;}
});
$('hn-import').addEventListener('change',async e=>{
  reset();context=null;$('hn-direction').replaceChildren();$('hn-direction').hidden=true;$('hn-direction-label').hidden=true;const token=generation;
  try{const f=e.target.files[0];if(!f)return;if(f.size>50*1024*1024)throw new Error('도로 파일은 50MB 이하로 가져오세요.');
    const graph=buildGraph(JSON.parse(await f.text()));if(token!==generation)return;graphPromise=Promise.resolve(graph);status('다섯 노선 도로 데이터를 가져왔습니다. 현재 위치로 경로를 만드세요.');
  }catch(err){status(err.message,true);}finally{$('hn-build').disabled=!destinations.length;e.target.value='';}
});
$('hn-query').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(ROAD_QUERY);status('다섯 노선의 공개 도로 조회문을 복사했습니다. Overpass Turbo에서 실행 후 원본 JSON으로 내보내세요.');}catch{status('클립보드를 사용할 수 없습니다.',true);}});
modal.addEventListener('close',()=>{generation++;$('hn-build').disabled=!destinations.length;if(modal.returnValue!=='preview'){reset();}modal.returnValue='';});
button.addEventListener('click',()=>{
  // Reopen a prepared preview without discarding the launch link.
  const selected=window.HighwayApp.selected;
  if(currentResult && selected?.item===openedSelection?.item && selected?.type===openedSelection?.type && Date.now()-currentResult.created<120000 && !modal.open){modal.showModal();return;}
  open();
});
