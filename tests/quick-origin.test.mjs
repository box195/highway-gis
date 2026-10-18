import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {quickOriginChoices,getOriginPreference,setOriginPreference,manualOriginDeparture,resolveQuickOrigin,ORIGIN_PREFERENCE_KEY} from '../data/quick-origin.mjs';
import {routeCacheKey} from '../data/quick-route-cache.mjs';
import {navigationCatalog,savedDestinationRoute,destinationPoint} from '../data/navigation-catalog.mjs';
import {buildGraph,availableOriginOptions,nearestHighwayPoint} from '../data/highway-routing.mjs';
import {TOLL_GATES} from '../data/highway-tollgates.mjs';
const graph=buildGraph(JSON.parse(fs.readFileSync(new URL('../data/highway-roads.json',import.meta.url),'utf8')));
const suwon={name:'수원신갈영업소',lat:37.26694,lng:127.10244};
const site={name:'동서울영업소',lat:37.516454,lng:127.220218};
const branch={name:'한국도로공사 동서울지사',lat:37.51413,lng:127.15375};
const data={offices:[suwon,site,branch],interchanges:[
  {name:'분당IC',lat:37.436,lng:127.123,route_name:'수도권제1순환고속도로'},
  {name:'광주JC',lat:37.448,lng:127.266,route_name:'중부고속도로'},
  {name:'송파IC',lat:37.4745,lng:127.1279}],
  manholes:[{name:'맨홀JC',lat:37.5,lng:127.2}]};
test('manual origin selector includes Suwon omitted as destination, offices, branch and GIS IC/JC, never manholes',()=>{
  const choices=quickOriginChoices(data),ids=choices.map(i=>i.id);
  assert.ok(ids.some(x=>x.includes('수원신갈')));
  assert.ok(ids.some(x=>x.includes('동서울지사')));
  assert.ok(ids.some(x=>x.includes('분당IC')));
  assert.ok(ids.some(x=>x.includes('광주JC')));
  assert.ok(ids.includes('junction:songpa'));
  assert.ok(ids.includes('junction:singal'));
  assert.ok(!ids.some(x=>x.includes('맨홀')));
  assert.equal(navigationCatalog(data).flatMap(x=>x.items).some(x=>x.label==='수원신갈영업소'),false);
});
test('selected office and IC/JC need no GPS and create source-side road topology, not arrival anchors',async()=>{
  const choices=quickOriginChoices(data);let calls=0;
  const failingGPS=()=>{calls++;throw Error('GPS must not be called');};
  const src=await resolveQuickOrigin('office:수원신갈영업소',choices,data,failingGPS);
  assert.equal(src.departureMode,'manual-office');assert.equal(src.officeName,'수원신갈영업소');
  assert.equal(src.gateName,'수원신갈톨게이트');
  const saved=savedDestinationRoute(src,navigationCatalog(data)[0].items[0],data);
  assert.equal(saved.waypoints.length,3);
  const jc=await resolveQuickOrigin('junction:singal',choices,data,failingGPS);
  assert.equal(jc.departureMode,'manual-junction');
  assert.equal(jc.snapToHighway,true);
  assert.equal(jc.arrivalAnchors,undefined);
  assert.equal(jc.hasGateTopology,undefined);
  assert.ok(nearestHighwayPoint(graph,jc).gap<400);
  const route=availableOriginOptions(graph,jc,destinationPoint(navigationCatalog(data)[0].items[0],data));
  assert.ok(route.choices.length>0);
  assert.equal(calls,0);
});
test('default and unknown origin selection use nearest GPS callback with no direct current-location storage',async()=>{
  const choices=quickOriginChoices(data);let gpsCalls=0;
  const gps=async()=>{gpsCalls++;return {officeName:'nearest',lat:37.4,lng:127.2,departureMode:'nearest-office'};};
  assert.equal((await resolveQuickOrigin('',choices,data,gps)).officeName,'nearest');
  assert.equal((await resolveQuickOrigin('missing:old',choices,data,gps)).officeName,'nearest');
  assert.equal(gpsCalls,2);
});
test('origin preference persists only a chosen stable ID and stale IDs fall back to default',()=>{
  const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const choices=quickOriginChoices(data);
  setOriginPreference('office:수원신갈영업소',storage);
  assert.equal(memory.get(ORIGIN_PREFERENCE_KEY),'office:수원신갈영업소');
  assert.equal(getOriginPreference(choices,storage),'office:수원신갈영업소');
  setOriginPreference('office:deleted',storage);
  assert.equal(getOriginPreference(choices,storage),'');
  assert.equal(memory.has(ORIGIN_PREFERENCE_KEY),false);
  setOriginPreference('',storage);assert.equal(getOriginPreference(choices,storage),'');
  const blocked={getItem(){throw Error('denied')},setItem(){throw Error('quota')},removeItem(){throw Error('denied')}};
  assert.doesNotThrow(()=>setOriginPreference('office:수원신갈영업소',blocked));
  assert.equal(getOriginPreference(choices,blocked),'');
});
test('manual origins partition persistent route-choice keys by selected ID and travel direction options',()=>{
  const choices=quickOriginChoices(data),dest=navigationCatalog(data)[0].items[0],goal=destinationPoint(dest,data);
  const a=manualOriginDeparture(choices.find(i=>i.id==='office:수원신갈영업소'),data,TOLL_GATES);
  const b=manualOriginDeparture(choices.find(i=>i.id==='junction:singal'),data,TOLL_GATES);
  assert.notEqual(routeCacheKey(a,dest,'highway',goal),routeCacheKey(b,dest,'highway',goal));
  assert.notEqual(routeCacheKey(a,dest,'highway',goal),routeCacheKey({...a,departureMode:'nearest-office',originId:undefined},dest,'highway',goal));
});
test('standalone quick-nav header contains accessible origin selector and narrow-screen rules',()=>{
  const source=fs.readFileSync(new URL('../data/quick-navigation.mjs',import.meta.url),'utf8');
  assert.match(source,/id="qn-origin" aria-label="출발 거점"/);
  assert.match(source,/max-width:680px/);
  assert.match(source,/resolveQuickOrigin/);
  assert.match(source,/setOriginPreference/);
  assert.ok(source.includes('if(flow.open)flow.close()'));
});

test('top Suwon SAVED RETURN control invokes stored route while retaining origin selector',()=>{
 const js=fs.readFileSync(new URL('../data/quick-navigation.mjs',import.meta.url),'utf8');
 assert.match(js,/id="qn-return-saved"/);assert.match(js,/getOrigin()/);
 assert.ok(js.includes("qn-return-saved').addEventListener"));assert.ok(js.includes("begin(item,'saved')"));
 assert.ok(js.includes("qn-origin').addEventListener('change'"));
});
