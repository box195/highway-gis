import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph,route,availableOriginOptions,navigationURL} from '../data/highway-routing.mjs';
import {officeEndpoint,savedOfficeDeparture} from '../data/highway-endpoints.mjs';
import {kakaoNavigationURL} from '../data/kakao-navigation.mjs';
import {routeCache,routeCacheKey} from '../data/quick-route-cache.mjs';
import {savedRoute,SONGPA_RETURN_START,SONGPA_IC} from '../data/saved-navigation.mjs';
const graph=buildGraph(JSON.parse(fs.readFileSync(new URL('../data/highway-roads.json',import.meta.url),'utf8')));
test('POI search handoff and cache preserve named-place identity',()=>{
 const site={name:'동서울영업소',lat:37.51755,lng:127.22215},goal=officeEndpoint(site,[],[]);
 assert.equal(goal.officeDestination,null);assert.equal(goal.providerPlace.placeId,null);
 const r=route(graph,{lat:37.26694,lng:127.10244,roadHint:'경부고속도로'},goal);
 const url='https://map.kakao.com/link/search/'+encodeURIComponent(site.name);
 assert.equal(kakaoNavigationURL(r),url);assert.ok(navigationURL(r,'https://example.com/').includes('search/'));
 assert.notEqual(r.goal.lat,site.lat);
 const map=new Map(),db={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const key=routeCacheKey({officeName:'수원신갈영업소',lat:37.26,lng:127.1},{id:'office:동서울영업소',source:site},'highway',goal);
 routeCache(db,1000).set(key,[{key:'one',label:'route',result:r}]);
 assert.equal(kakaoNavigationURL(routeCache(db,1001).get(key)[0].result),url);
 assert.equal(map.get('highway-quick-choices-v1').includes('"original"'),false);
});
test('Gwangam opposite lane uses bounded rest-area path to Pangyo carriageway',()=>{
 const goal=officeEndpoint({name:'광암터널관리동',lat:37.517,lng:127.172});
 assert.equal(goal.arrivalAnchors[0].edgeKey,'1000475753:2153572261');
 const r=route(graph,{lat:37.5160558,lng:127.174612,roadHint:goal.roadHint,heading:77},goal,77);
 assert.equal(r.gwangamReentry,true);assert.equal(r.arrivalBearing,257);
 assert.ok(r.length<12000&&r.waypoints.length===5);
 assert.equal(r.goal.lat,37.5163803548384);assert.equal(r.goal.lng,127.17451770787038);
 assert.ok(r.arrivalDirection.includes('판교'));
});
test('Songpa exact OLC first return guide, existing remaining guides and departure',()=>{
 const a=savedRoute('songpa','suwon'),b=savedRoute('suwon','songpa');
 assert.equal(a.waypoints[0].code,'8Q99F48C+QWM');
 assert.deepEqual([a.waypoints[0].lat,a.waypoints[0].lng],[37.4669625,127.122296875]);
 assert.equal(a.waypoints.length,5);assert.deepEqual(a.start,SONGPA_RETURN_START);
 assert.deepEqual(b.goal,SONGPA_IC);
 assert.equal(new URL(kakaoNavigationURL(a)).searchParams.get('vp'),'37.4669625,127.122296875');
});
