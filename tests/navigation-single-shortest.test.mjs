import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph,availableOriginOptions,navigationURL,route,shortestHighwayRoute,ROADS,distance} from '../data/highway-routing.mjs';
import {kakaoNavigationURL} from '../data/kakao-navigation.mjs';
import {navigationCatalog,destinationPoint,savedDestinationRoute} from '../data/navigation-catalog.mjs';
import {savedOfficeDeparture,officeEndpoint} from '../data/highway-endpoints.mjs';
import {TOLL_GATES} from '../data/highway-tollgates.mjs';
import {resolveQuickChoices,routeCache,routeCacheKey} from '../data/quick-route-cache.mjs';

const graph=buildGraph(JSON.parse(fs.readFileSync(new URL('../data/highway-roads.json',import.meta.url),'utf8')));
const suwon={name:'수원신갈영업소',lat:37.26694,lng:127.10244};
const sample={offices:[suwon,{name:'서이천영업소',lat:37.2548,lng:127.3712},{name:'경기광주지사',lat:37.35,lng:127.32}],interchanges:[{name:'송파IC',lat:37.4745104494,lng:127.1278789719}]};
const start=savedOfficeDeparture(suwon,sample.interchanges,TOLL_GATES);
const groups=navigationCatalog(sample);
const songpa=groups[0].items[0],songpaGoal=destinationPoint(songpa,sample);
const suwonItem={id:'office:수원신갈영업소',kind:'office',label:'수원신갈영업소',source:suwon};
const store=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const args=(origin,item,mode,destination)=>({start:origin,item,mode,destination,data:sample,cache:routeCache(store()),
  loadGraph:async()=>graph,availableOriginOptions,savedDestinationRoute});

test('singleShortest returns exactly one legal motorway choice without corridor/direction prompts',()=>{
  const original=availableOriginOptions(graph,start,songpaGoal);
  const shortest=availableOriginOptions(graph,start,songpaGoal,{singleShortest:true});
  assert.equal(shortest.choices.length,1);
  assert.equal(shortest.choices[0].key,'shortest');
  const result=shortest.choices[0].result;
  assert.equal(result.kind,'highway-shortest');
  assert.equal(result.routeVerification,'app-embedded-osm-directed-network');
  assert.ok(result.length>0&&result.waypoints.length<=5);
  assert.ok(original.choices.length>=1);
  assert.ok(result.length<=Math.min(...original.choices.map(c=>c.result.length))+1);
  assert.ok(result.roads.every(r=>['수도권제1순환고속도로','경부고속도로','중부고속도로','제2중부고속도로','영동고속도로'].includes(r)));
  assert.ok(!result.roads.includes('제2중부고속도로'));
});

test('quick navigation highway route uses one result and cached type/distance survive reload',async()=>{
  const storage=store(),origin={...start,officeName:'수원신갈영업소',departureMode:'manual-office'};
  const input={...args(origin,songpa,'highway',songpaGoal),cache:routeCache(storage,1000)};
  const fresh=await resolveQuickChoices(input);
  assert.equal(fresh.choices.length,1);
  assert.equal(fresh.choices[0].result.kind,'highway-shortest');
  const length=fresh.choices[0].result.length;
  const cached=await resolveQuickChoices({...input,cache:routeCache(storage,1001),loadGraph:()=>{throw Error('unexpected graph load');}});
  assert.equal(cached.fromCache,true);
  assert.equal(cached.choices[0].result.length,length);
  assert.equal(cached.choices[0].result.kind,'highway-shortest');
});

test('unregistered saved pair passes zero guides to both apps, uses user-pinned destination when present',async()=>{
  const origin={...start,officeName:'수원신갈영업소',departureMode:'manual-office'};
  const item={id:'office:새영업소',kind:'office',label:'새영업소',source:{name:'새영업소',lat:37.39,lng:127.2}};
  const destination={lat:37.38,lng:127.19,name:'새영업소',original:{lat:37.39,lng:127.2},userArrivalOverride:{lat:37.40,lng:127.21}};
  const out=await resolveQuickChoices({...args(origin,item,'saved',destination),savedDestinationRoute:()=>{throw Error('must not call registered route');},loadGraph:()=>{throw Error('must not load graph');}});
  assert.equal(out.choices.length,1);
  const r=out.choices[0].result;
  assert.equal(r.kind,'destination-only');assert.deepEqual(r.waypoints,[]);
  assert.deepEqual([r.goal.lat,r.goal.lng],[37.4,127.21]);
  const n=new URL(navigationURL(r,'https://example.test/')).searchParams;
  const k=new URL(kakaoNavigationURL(r)).searchParams;
  assert.equal(n.get('v1lat'),null);assert.equal(k.get('vp'),null);
  assert.equal(k.get('ep'),'37.4,127.21');
});

test('registered Suwon-to-Songpa follows original three guides; failed registered route never silently falls back',async()=>{
  const origin={...start,officeName:'수원신갈영업소',departureMode:'manual-office'};
  const out=await resolveQuickChoices(args(origin,songpa,'saved',songpaGoal));
  assert.equal(out.choices[0].result.kind,'saved');
  assert.deepEqual(out.choices[0].result.waypoints.map(p=>p.code),['8Q9994H2+4QX','8Q99F449+GQ5','8Q99F48C+VP7']);
  await assert.rejects(resolveQuickChoices({...args(origin,songpa,'saved',songpaGoal),savedDestinationRoute:()=>{throw Error('registered-route-error');}}),/registered-route-error/);
});

test('Seoicheon return retains second waypoint and Gwangju branch direct return matches Gonjiam recipe',async()=>{
  const make=(name)=>({...start,officeName:name,departureMode:'manual-office'});
  const eo=await resolveQuickChoices(args(make('서이천영업소'),suwonItem,'saved',destinationPoint(suwonItem,sample)));
  assert.deepEqual(eo.choices[0].result.waypoints.map(p=>p.code),['8Q99793C+WGJ','8Q996683+GGJ','8Q9974C4+5WH']);
  const go=await resolveQuickChoices(args(make('경기광주지사'),suwonItem,'saved',destinationPoint(suwonItem,sample)));
  const gi=await resolveQuickChoices(args(make('곤지암영업소'),suwonItem,'saved',destinationPoint(suwonItem,sample)));
  assert.deepEqual(go.choices[0].result.waypoints.map(p=>p.code),gi.choices[0].result.waypoints.map(p=>p.code));
});

test('estimated and source-error destinations are held instead of creating fabricated direct routes',async()=>{
  const origin={...start,officeName:'수원신갈영업소',departureMode:'manual-office'};
  const destination={lat:37.39,lng:127.2,name:'추정 위치'};
  for(const status of ['ESTIMATED','SOURCE_ERROR']){
    const item={id:'office:unknown',kind:'office',label:'추정 위치',source:{...destination,coordinate_status:status}};
    await assert.rejects(resolveQuickChoices(args(origin,item,'saved',destination)),/안내를 보류/);
  }
  const missing={id:'office:missing',kind:'office',label:'미확인',source:{name:'미확인'}};
  await assert.rejects(resolveQuickChoices(args(origin,missing,'saved',{lat:NaN,lng:NaN})),/안내를 보류/);
});

test('shortest mode blocks unreasonably long five-road loops for adjacent toll offices',()=>{
  const guri={name:'구리남양주영업소',lat:37.59044,lng:127.15527};
  const topyeong={name:'토평영업소',lat:37.58198,lng:127.15603};
  const from=savedOfficeDeparture(guri,[],TOLL_GATES),to=officeEndpoint(topyeong,[],TOLL_GATES);
  const raw=route(graph,from,to,null,null,{distanceFirst:true});
  assert.ok(raw.length>35000 && raw.length>4*distance(from,to));
  assert.throws(()=>shortestHighwayRoute(graph,from,to),/과도한 우회 경로/);
  const selected=availableOriginOptions(graph,from,to,{singleShortest:true});
  assert.equal(selected.choices.length,0);
  assert.match(selected.rejected[0].error,/안내를 보류/);
});

test('shortest mode adds only verified motorway mainline guides without discarding essential exit guides',()=>{
  const output=shortestHighwayRoute(graph,start,songpaGoal);
  assert.ok(output.waypoints.length<=5);
  assert.ok(output.waypoints.every(p=>ROADS.some(r=>p.name.includes(r))));
  assert.ok(output.waypoints.every(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)));
  assert.ok(output.waypoints.some(p=>/진출 방향|분기 전|본선 유지/.test(p.name)));
  const n=new URL(navigationURL(output,'https://example.com')).searchParams;
  const k=new URL(kakaoNavigationURL(output)).searchParams;
  assert.equal(n.get('v'+output.waypoints.length+'lat'),String(output.waypoints.at(-1).lat));
  assert.equal(k.get(output.waypoints.length===1?'vp':'vp'+output.waypoints.length),String(output.waypoints.at(-1).lat)+','+String(output.waypoints.at(-1).lng));
});
