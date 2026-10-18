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
 assert.deepEqual([a.start.lat,a.start.lng],[37.4788875,127.133921875]);
 assert.equal(a.start.plusCode,'8Q99F4HM+HH3');
 assert.deepEqual(b.goal,SONGPA_IC);
 assert.equal(new URL(kakaoNavigationURL(a)).searchParams.get('vp'),'37.4669625,127.122296875');
});

import {quickOriginChoices,manualOriginDeparture} from '../data/quick-origin.mjs';
import {navigationCatalog,savedDestinationRoute,returnDestination} from '../data/navigation-catalog.mjs';
const decodeOLC=code=>{
 const alphabet='23456789CFGHJMPQRVWX',s=code.replace('+','');
 let lat=-90,lng=-180,stepLat=20,stepLng=20;
 for(let i=0;i<10;i+=2){if(i){stepLat/=20;stepLng/=20;}lat+=alphabet.indexOf(s[i])*stepLat;lng+=alphabet.indexOf(s[i+1])*stepLng;}
 for(let i=10;i<s.length;i++){stepLat/=5;stepLng/=4;const n=alphabet.indexOf(s[i]);lat+=Math.floor(n/4)*stepLat;lng+=(n%4)*stepLng;}
 return {lat:Number((lat+stepLat/2).toFixed(12)),lng:Number((lng+stepLng/2).toFixed(12))};
};
test('exact user Songpa departure OLC is preserved for saved return and manual source only',()=>{
 const code='8Q99F4HM+HH3',point=decodeOLC(code);
 assert.deepEqual(point,{lat:37.4788875,lng:127.133921875});
 assert.deepEqual({lat:SONGPA_RETURN_START.lat,lng:SONGPA_RETURN_START.lng},point);
 const userData={offices:[{name:'수원신갈영업소',lat:37.26694,lng:127.10244}]};
 const manualItem=quickOriginChoices(userData).find(v=>v.id==='junction:songpa');
 assert.ok(manualItem);
 assert.deepEqual({lat:manualItem.source.lat,lng:manualItem.source.lng},point);
 const manual=manualOriginDeparture(manualItem,userData);
 assert.deepEqual({lat:manual.lat,lng:manual.lng},point);
 assert.equal(manual.snapToHighway,false);
 assert.equal(manual.originId,'junction:songpa');
 const suwon=returnDestination(navigationCatalog(userData),userData);
 const ret=savedDestinationRoute(manual,suwon,userData);
 assert.deepEqual({lat:ret.start.lat,lng:ret.start.lng},point);
 assert.deepEqual(ret.waypoints.map(v=>v.code),['8Q99F48C+QWM','OSM:186410728:south','OSM:473590580:south','OSM:277611773:south','OSM:624073974:south']);
 const songpaDest=navigationCatalog(userData)[0].items[0];
 assert.deepEqual({lat:songpaDest.source.lat,lng:songpaDest.source.lng},{lat:SONGPA_IC.lat,lng:SONGPA_IC.lng});
 assert.notDeepEqual({lat:songpaDest.source.lat,lng:songpaDest.source.lng},point);
 assert.deepEqual(savedRoute('suwon','songpa',userData.offices).goal,SONGPA_IC);
 const web=new URL(kakaoNavigationURL(ret)).searchParams;
 assert.equal(web.get('sp'),'37.4788875,127.133921875');
 assert.equal(web.get('vp'),'37.4669625,127.122296875');
 assert.equal(web.has('vp6'),false);
});
