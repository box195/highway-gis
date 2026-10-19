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
test('six manual and nearest hubs: directed exit, immutable guides, max five, both provider URLs',async()=>{
 for(const hub of hubs){
  const option=sources.find(o=>o.source===hub);assert.ok(option,hub.name);
  const manual=manualOriginDeparture(option,data,TOLL_GATES);
  const nearest=nearestOfficeDeparture({...hub,accuracy:5},data.offices,data.interchanges,TOLL_GATES);
  assert.equal(nearest.officeName,hub.name);
  for(const start of [manual,nearest]){
   const {choices}=await run(start);assert.ok(choices.length,hub.name);
   for(const {key,result:r} of choices){
    assert.match(key,/^hybrid:/);assert.equal(r.kind,'hybrid-saved-return');
    assert.equal(r.waypoints.length,5);assert.ok(r.roads.includes('송파IC 진출로'));
    const exit=SONGPA_EXIT_ACCESS.find(a=>distance(a.destination,r.waypoints[1])<2);
    assert.ok(exit,hub.name);assert.equal(r.songpaExitApproach,exit.approach);
    assert.equal(exit.approach,'southbound','do not hide motorway-scale opposite carriageway loops');
    assert.ok(r.roads.filter(x=>x.includes('고속도로')).length<=2);
    assert.deepEqual(r.waypoints.slice(2).map(p=>[p.lat,p.lng]),exact);
    assert.deepEqual([r.goal.lat,r.goal.lng],[37.2674875,127.102359375]);
    assert.notDeepEqual([r.start.lat,r.start.lng],[SONGPA_RETURN_START.lat,SONGPA_RETURN_START.lng]);
    const kakao=new URL(kakaoNavigationURL(r)).searchParams;
    const naver=new URL(navigationURL(r,'https://example.org/gis')).searchParams;
    assert.equal(kakao.get('ep'),'37.2674875,127.102359375');
    assert.equal(naver.get('dlat'),'37.2674875');
    for(let i=0;i<5;i++){
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
 assert.equal(pure.choices[0].result.waypoints.length,3);
 assert.deepEqual(pure.choices[0].result.start,SONGPA_RETURN_START);
 assert.deepEqual(savedRoute('suwon','songpa').waypoints.map(x=>x.code),['8Q9994H2+4QX','8Q99F449+GQ5','8Q99F48C+VP7']);
 const unsupported=nearestOfficeDeparture({lat:37.26694,lng:127.10244},data.offices,[],TOLL_GATES);
 await assert.rejects(run(unsupported),/아직 없습니다/);
});
