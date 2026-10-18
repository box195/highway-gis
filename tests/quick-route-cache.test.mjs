import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {navigationURL} from '../data/highway-routing.mjs';
import {kakaoNavigationURL} from '../data/kakao-navigation.mjs';
import {CACHE_KEY,routeCache,routeCacheKey,resolveQuickChoices,CACHE_MAX} from '../data/quick-route-cache.mjs';
import {navigationCatalog,returnDestination,savedDestinationRoute,destinationPoint} from '../data/navigation-catalog.mjs';
import {quickOriginChoices,manualOriginDeparture} from '../data/quick-origin.mjs';
const map=new Map();
const store={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
const start={officeName:'nearest office',gateName:'test toll',lat:37.42,lng:127.13,roadHint:'중부고속도로',accuracy:9};
const item={id:'junction:gis:test',label:'test',source:{lat:37.45,lng:127.14}};
const destination={lat:37.45,lng:127.14,roadHint:'중부고속도로'};
const route={start:{lat:37.42,lng:127.13,name:'origin',accuracy:19,original:{sensitive:'GIS'}},
  goal:{lat:37.45,lng:127.14,name:'destination',original:{sensitive:'GIS'}},
  waypoints:[{lat:37.43,lng:127.135,name:'guide'}],roads:['중부고속도로'],arrivalDirection:'north',points:[{sensitive:'GIS'}]};
const result={choices:[{key:'direction-n',label:'northbound',result:route}],rejected:[]};
const inputs=cache=>({start,item,mode:'highway',destination,cache,
  loadGraph:async()=>{calls++;return {};},availableOriginOptions:()=>result});
let calls=0;
test('persistent reload hit skips graph loading and routing; only minimized navigation artifacts stored',async()=>{
  map.clear();calls=0;
  let out=await resolveQuickChoices(inputs(routeCache(store,1000)));
  assert.equal(out.fromCache,false);assert.equal(calls,1);
  out=await resolveQuickChoices({...inputs(routeCache(store,1001)),loadGraph:()=>{throw Error('should not load');}});
  assert.equal(out.fromCache,true);assert.equal(calls,1);assert.equal(out.choices[0].result.goal.lat,37.45);
  const cached=out.choices[0].result;
  assert.equal(new URL(kakaoNavigationURL(cached)).searchParams.get('ep'),'37.45,127.14');
  assert.equal(new URL(navigationURL(cached,'https://example.com/')).searchParams.get('v1lat'),'37.43');
  const serialized=map.get(CACHE_KEY);
  for(const secret of ['accuracy','original','\"points\":','sensitive'])assert.equal(serialized.includes(secret),false,secret);
});
test('input changes and mode changes invalidate the cached entry',()=>{
  const key=routeCacheKey(start,item,'highway',destination);
  assert.notEqual(key,routeCacheKey({...start,lat:37.43},item,'highway',destination));
  assert.notEqual(key,routeCacheKey(start,item,'saved',destination));
  assert.notEqual(key,routeCacheKey(start,item,'highway',{...destination,lng:127.141}));
  assert.notEqual(key,routeCacheKey(start,{...item,source:{lat:37.45,lng:127.142}},'highway',destination));
});
test('revision mismatch, expiration and malformed/corrupt cache entries are rejected',()=>{
  map.clear();const key=routeCacheKey(start,item,'highway',destination);
  routeCache(store,1000).set(key,result.choices);
  assert.equal(routeCache(store,1000+8*86400000).get(key),null);
  map.set(CACHE_KEY,'{BROKEN JSON');
  assert.equal(routeCache(store).get(key),null);assert.equal(map.has(CACHE_KEY),false);
  routeCache(store,1000).set(key,result.choices);
  const x=JSON.parse(map.get(CACHE_KEY));x.revision='stale';map.set(CACHE_KEY,JSON.stringify(x));
  assert.equal(routeCache(store,1000).get(key),null);
  routeCache(store,1000).set(key,result.choices);
  const y=JSON.parse(map.get(CACHE_KEY));y.entries[0].choices[0].result.goal.lat=NaN;
  map.set(CACHE_KEY,JSON.stringify(y));assert.equal(routeCache(store,1000).get(key),null);
});
test('unavailable/quota storage gracefully falls back to recomputation',async()=>{
  const inaccessible={getItem(){throw Error('denied')},setItem(){throw Error('quota')},removeItem(){throw Error('denied')}};
  calls=0;
  await resolveQuickChoices(inputs(routeCache(inaccessible)));
  await resolveQuickChoices(inputs(routeCache(inaccessible)));
  assert.equal(calls,2);
});
test('bounded LRU entries and live saved route not conflated with highway',async()=>{
  map.clear();const cache=routeCache(store,1234);
  for(let i=0;i<CACHE_MAX+8;i++)cache.set(i.toString(16).padStart(16,'0'),result.choices);
  assert.equal(JSON.parse(map.get(CACHE_KEY)).entries.length,CACHE_MAX);
  const saved=await resolveQuickChoices({...inputs(cache),mode:'saved',loadGraph:()=>{throw Error('saved needs no graph')},
    savedDestinationRoute:()=>route});
  assert.equal(saved.choices[0].result.waypoints.length,1);
});
test('the pinned cache revision exactly fingerprints current graph/routing/endpoints/saved route files',()=>{
  assert.match(execFileSync(process.execPath,['scripts/stamp-route-cache.mjs','--check'],{encoding:'utf8'}),/fingerprint current/);
});

test('fingerprint is identical under simulated LF and CRLF checkout',()=>{
  assert.match(execFileSync(process.execPath,['scripts/stamp-route-cache.mjs','--verify-newlines'],{encoding:'utf8'}),/equivalence PASS/);
});
test('manually chosen origin and nearest GPS hub use independent cache keys even at same spot',()=>{
  const base=routeCacheKey(start,item,'highway',destination);
  const manual=routeCacheKey({...start,originId:'office:nearest',departureMode:'manual-office'},item,'highway',destination);
  const other=routeCacheKey({...start,originId:'junction:gis:nearest',departureMode:'manual-junction'},item,'highway',destination);
  assert.notEqual(base,manual);assert.notEqual(manual,other);
  assert.notEqual(base,routeCacheKey(start,item,'highway',{...destination,userArrivalOverride:{lat:37.43,lng:127.14}}));
});

test('Songpa manual origin + Suwon saved return button yields cached five-point route, partitioned from other origins',async()=>{
  const office={name:'수원신갈영업소',lat:37.26694,lng:127.10244};
  const d={offices:[office],interchanges:[{name:'송파IC',lat:37.4745104494,lng:127.1278789719}]};
  const group=navigationCatalog(d),item=returnDestination(group,d);
  const origin=quickOriginChoices(d).find(o=>o.id==='junction:songpa');assert.ok(origin);
  const manual=manualOriginDeparture(origin,d),destination=destinationPoint(item,d);
  assert.equal(manual.originId,'junction:songpa');
  const memory=new Map(),local={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const args={start:manual,item,mode:'saved',destination,data:d,loadGraph:()=>{throw Error('saved must not load road graph');},
    availableOriginOptions:()=>{throw Error('saved must not dynamically route');},savedDestinationRoute};
  const a=await resolveQuickChoices({...args,cache:routeCache(local,1000)});
  assert.equal(a.fromCache,false);assert.equal(a.choices[0].result.waypoints.length,5);
  const b=await resolveQuickChoices({...args,cache:routeCache(local,1001),savedDestinationRoute:()=>{throw Error('cache miss')}});
  assert.equal(b.fromCache,true);assert.equal(b.choices[0].result.waypoints.length,5);
  const key=routeCacheKey(manual,item,'saved',destination);
  assert.notEqual(key,routeCacheKey({...manual,originId:'office:동서울영업소',officeName:'동서울영업소'},item,'saved',destination));
  assert.notEqual(key,routeCacheKey(manual,item,'highway',destination));
  assert.ok(!memory.get(CACHE_KEY).includes('original'));
});
