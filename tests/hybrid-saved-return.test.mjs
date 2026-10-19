import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph,distance,navigationURL} from '../data/highway-routing.mjs';
import {TOLL_GATES} from '../data/highway-tollgates.mjs';
import {SONGPA_EXIT_ACCESS} from '../data/songpa-exit-access.mjs';
import {quickOriginChoices,manualOriginDeparture} from '../data/quick-origin.mjs';
import {nearestOfficeDeparture} from '../data/highway-endpoints.mjs';
import {navigationCatalog,returnDestination,destinationPoint,savedDestinationRoute} from '../data/navigation-catalog.mjs';
import {savedRoute,SONGPA_RETURN_START} from '../data/saved-navigation.mjs';
import {routeCache,routeCacheKey,resolveQuickChoices} from '../data/quick-route-cache.mjs';
import {kakaoNavigationURL} from '../data/kakao-navigation.mjs';
const graph=buildGraph(JSON.parse(fs.readFileSync(new URL('../data/highway-roads.json',import.meta.url),'utf8')));
const gate=n=>{const p=TOLL_GATES.find(g=>g.name===n);assert.ok(p,n);return {lat:p.lat,lng:p.lng};};
const hubs=[{name:'구리남양주영업소',...gate('구리남양주')},{name:'토평영업소',...gate('토평')},
{name:'하남영업소',...gate('하남요금소')},
{name:'한국도로공사 동서울지사',lat:37.51413,lng:127.15375},
{name:'한국도로공사 서울경기본부',lat:37.5145,lng:127.1551},
{name:'광암터널관리동',lat:37.51638,lng:127.175}];
const data={offices:[...hubs,{name:'수원신갈영업소',lat:37.26694,lng:127.10244}],interchanges:[]};
const item=returnDestination(navigationCatalog(data),data),destination=destinationPoint(item,data);
const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
const sources=quickOriginChoices(data);
const run=(start,extra={})=>resolveQuickChoices({start,item,mode:'saved',destination,data,cache:routeCache(storage,1000),
loadGraph:async()=>graph,savedDestinationRoute,...extra});
const exact=[[37.4669625,127.122296875],[37.456263302,127.1193993],[37.2711125,127.096515625]];
test('six manual and nearest hubs: original waypoint 2 removed, four exact guides, both providers',async()=>{
 for(const hub of hubs){
  const option=sources.find(o=>o.source===hub);assert.ok(option,hub.name);
  const manual=manualOriginDeparture(option,data,TOLL_GATES);
  const nearest=nearestOfficeDeparture({...hub,accuracy:5},data.offices,data.interchanges,TOLL_GATES);
  assert.equal(nearest.officeName,hub.name);
  for(const start of [manual,nearest]){
   const {choices}=await run(start);assert.ok(choices.length,hub.name);
   for(const {key,result:r} of choices){
    assert.match(key,/^hybrid:/);assert.equal(r.kind,'hybrid-saved-return');
    assert.equal(r.waypoints.length,4);assert.ok(r.roads.includes('송파IC 진출로'));
    const exit=SONGPA_EXIT_ACCESS.find(a=>a.approach===r.songpaExitApproach);
    assert.ok(SONGPA_EXIT_ACCESS.every(a=>r.waypoints.every(p=>distance(a.destination,p)>2)),'original exit waypoint #2 must be absent');
    assert.ok(exit,hub.name);assert.equal(r.songpaExitApproach,exit.approach);
    assert.equal(exit.approach,'southbound','do not hide motorway-scale opposite carriageway loops');
    assert.ok(r.roads.filter(x=>x.includes('고속도로')).length<=2);
    assert.deepEqual(r.waypoints.slice(1).map(p=>[p.lat,p.lng]),exact);
    assert.deepEqual([r.goal.lat,r.goal.lng],[37.2674875,127.102359375]);
    assert.notDeepEqual([r.start.lat,r.start.lng],[SONGPA_RETURN_START.lat,SONGPA_RETURN_START.lng]);
    const kakao=new URL(kakaoNavigationURL(r)).searchParams;
    const naver=new URL(navigationURL(r,'https://example.org/gis')).searchParams;
    assert.equal(kakao.get('ep'),'37.2674875,127.102359375');
    assert.equal(naver.get('dlat'),'37.2674875');
    for(let i=0;i<4;i++){
     assert.equal(kakao.get(i?'vp'+(i+1):'vp'),r.waypoints[i].lat+','+r.waypoints[i].lng);
     assert.equal(naver.get('v'+(i+1)+'lat'),String(r.waypoints[i].lat));
    }
   }
  }
  assert.notEqual(routeCacheKey(manual,item,'saved',destination),routeCacheKey(nearest,item,'saved',destination));
  console.log('HUB PASS',hub.name);
 }
});
test('cache hit skips graph and partitions by source and mode',async()=>{
 const a=manualOriginDeparture(sources.find(o=>o.source===hubs[0]),data,TOLL_GATES);
 const b=manualOriginDeparture(sources.find(o=>o.source===hubs[1]),data,TOLL_GATES);
 await run(a);const hit=await run(a,{loadGraph:()=>{throw Error('graph loaded despite hit');}});
 assert.equal(hit.fromCache,true);assert.equal(hit.choices[0].result.kind,'hybrid-saved-return');
 assert.notEqual(routeCacheKey(a,item,'saved',destination),routeCacheKey(b,item,'saved',destination));
 assert.notEqual(routeCacheKey(a,item,'saved',destination),routeCacheKey(a,item,'highway',destination));
});
test('manual Songpa pure saved and outbound unchanged; unknown origin unsupported',async()=>{
 const songpa=manualOriginDeparture(sources.find(s=>s.id==='junction:songpa'),data,TOLL_GATES);
 const pure=await run(songpa,{loadGraph:()=>{throw Error('pure route graph loaded');}});
 assert.equal(pure.choices[0].result.waypoints.length,2);
 assert.deepEqual(pure.choices[0].result.start,SONGPA_RETURN_START);
 assert.deepEqual(savedRoute('suwon','songpa').waypoints.map(x=>x.code),['8Q9994H2+4QX','8Q99F449+GQ5','8Q99F48C+VP7']);
 const unsupported=nearestOfficeDeparture({lat:37.26694,lng:127.10244},data.offices,[],TOLL_GATES);
 await assert.rejects(run(unsupported),/아직 없습니다/);
});

test('special-source saved returns preserve source-specific ORIGINAL controls in manual/GPS modes',async()=>{
 const special=[
  {name:'성남영업소',lat:37.435,lng:127.124,expected:['8Q99F48C+QWM','OSM:186410728:south','8Q9973CW+CJR']},
  {name:'서울영업소',lat:37.42,lng:127.12,expected:['8Q9973CW+CJR']},
  {name:'청계영업소',lat:37.379,lng:127.102,expected:['8Q9994H2+GVJ','8Q9973CW+CJR']}
 ]; // Coordinates above are synthetic test fixtures, NOT replacements for GIS records.
 const localData={offices:[...data.offices,...special],interchanges:[]};
 const localSources=quickOriginChoices(localData);
 const localItem=returnDestination(navigationCatalog(localData),localData);
 for(const office of special){
  const source=localSources.find(s=>s.source===office);assert.ok(source);
  const manual=manualOriginDeparture(source,localData,TOLL_GATES);
  const nearest=nearestOfficeDeparture({lat:office.lat,lng:office.lng},localData.offices,[],TOLL_GATES);
  assert.equal(nearest.officeName,office.name);
  for(const start of [manual,nearest]){
   const {choices}=await resolveQuickChoices({start,item:localItem,mode:'saved',
    destination:destinationPoint(localItem,localData),data:localData,cache:routeCache(null),
    loadGraph:async()=>{throw Error('special routes must not load highway graph');},savedDestinationRoute});
   assert.equal(choices.length,1);const r=choices[0].result;
   assert.deepEqual(r.waypoints.map(p=>p.code),office.expected);
   assert.equal(r.waypoints[0].name,'1. 저장 경유지');
   assert.deepEqual([r.goal.lat,r.goal.lng],[37.2674875,127.102359375]);
   const kakao=new URL(kakaoNavigationURL(r)).searchParams;
   const naver=new URL(navigationURL(r,'https://example.org/gis')).searchParams;
   assert.equal(kakao.has('vp'+(r.waypoints.length+1)),false);
   assert.equal(naver.has('v'+(r.waypoints.length+1)+'lat'),false);
   for(let i=0;i<r.waypoints.length;i++){
    assert.equal(kakao.get(i?'vp'+(i+1):'vp'),r.waypoints[i].lat+','+r.waypoints[i].lng);
    assert.equal(naver.get('v'+(i+1)+'lat'),String(r.waypoints[i].lat));
   }
  }
 }
 const ordered=navigationCatalog(localData).find(g=>g.key==='offices').items.map(x=>x.label);
 assert.deepEqual(ordered.slice(-2),['광암터널관리동','서울영업소']);
 assert.equal(navigationCatalog(data).find(g=>g.key==='offices').items.some(i=>i.label==='서울영업소'),false,
  'never synthesize missing GIS office coordinates');
});

test('Cheonggye eleven-character OLC center matches the supplied full Plus Code exactly',async()=>{
 const {CHEONGGYE_FIRST}=await import('../data/hybrid-saved-return.mjs');
 const alphabet='23456789CFGHJMPQRVWX',digits=CHEONGGYE_FIRST.code.replace('+','');
 let lat=-90,lng=-180,res=20;
 for(let i=0;i<10;i+=2){lat+=alphabet.indexOf(digits[i])*res;lng+=alphabet.indexOf(digits[i+1])*res;res/=20;}
 const last=alphabet.indexOf(digits[10]);
 lat+=(Math.floor(last/4)+0.5)*res*20/5;
 lng+=((last%4)+0.5)*res*20/4;
 assert.ok(Math.abs(lat-CHEONGGYE_FIRST.lat)<1e-10);
 assert.ok(Math.abs(lng-CHEONGGYE_FIRST.lng)<1e-10);
 assert.deepEqual([CHEONGGYE_FIRST.lat,CHEONGGYE_FIRST.lng],[37.3788375,127.102140625]);
});
