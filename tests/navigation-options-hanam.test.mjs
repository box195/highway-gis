import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph,shortestHighwayRoute,navigationURL} from '../data/highway-routing.mjs';
import {navigationCatalog,destinationPoint} from '../data/navigation-catalog.mjs';
import {quickOriginChoices,manualOriginDeparture,resolveQuickOrigin,gpsCurrentDeparture,gpsNearestOfficeDeparture} from '../data/quick-origin.mjs';
import {officeEndpoint} from '../data/highway-endpoints.mjs';
import {kakaoNavigationURL} from '../data/kakao-navigation.mjs';
import {TOLL_GATES} from '../data/highway-tollgates.mjs';
import {GWANGAM_REENTRY} from '../data/gwangam-reentry.mjs';
const graph=buildGraph(JSON.parse(fs.readFileSync(new URL('../data/highway-roads.json',import.meta.url),'utf8')));
const sample={offices:[{name:'수원신갈영업소',lat:37.26694,lng:127.10244}],interchanges:[]};

test('public reference Seoul office, Pangyo IC and Seongnam IC appear as start and destination options',()=>{
 const all=navigationCatalog(sample).flatMap(g=>g.items);
 const starts=quickOriginChoices(sample);
 for(const name of ['서울영업소','판교IC','성남IC']){
   const dest=all.find(x=>x.label===name),origin=starts.find(x=>x.label===name);
   assert.ok(dest&&origin,name+' should be present in both selectors');
   assert.equal(dest.source.coordinate_status,'PUBLIC_REFERENCE');
   const final=destinationPoint(dest,sample);
   assert.ok(Number.isFinite(final.lat)&&Number.isFinite(final.lng));
   assert.equal(final.roadHint,dest.source.roadHint);
   const departure=manualOriginDeparture(origin,sample,TOLL_GATES);
   assert.equal(departure.departureMode,name==='서울영업소'?'manual-office':'manual-junction');
   assert.equal(departure.roadHint,dest.source.roadHint);
 }
 assert.equal(all.find(x=>x.label==='서울영업소').source.lat,37.3651583);
 const service=manualOriginDeparture({kind:'office',id:'office:서울영업소',source:{name:'한국도로공사 서울영업소',lat:37.3651583,lng:127.10335}},sample,TOLL_GATES);
 assert.equal(service.roadHint,'경부고속도로');
 assert.equal(all.find(x=>x.label==='판교IC').source.lat,37.39742);
 assert.equal(all.find(x=>x.label==='성남IC').source.lat,37.42724);
});

test('existing valid GIS coordinates override public-reference centre for same IC',()=>{
 const fresh={...sample,interchanges:[{name:'판교IC',lat:37.39766,lng:127.10077,route_name:'경부고속도로'}]};
 const item=navigationCatalog(fresh).flatMap(g=>g.items).find(x=>x.label==='판교IC');
 assert.equal(item.source.lat,37.39766);
 assert.equal(navigationCatalog(fresh).flatMap(g=>g.items).filter(x=>x.label==='판교IC').length,1);
});

test('GPS remains default but optional nearest office resolves only when explicitly selected',async()=>{
 const gps={lat:37.36520,lng:127.10335,accuracy:12,speed:0,heading:null};
 const choices=quickOriginChoices(sample);
 const defaultOrigin=await resolveQuickOrigin('',choices,sample,async mode=>{assert.equal(mode,'gps-current');return gpsCurrentDeparture(gps);});
 assert.equal(defaultOrigin.departureMode,'gps-current');
 assert.equal(defaultOrigin.lat,gps.lat);
 const nearby=await resolveQuickOrigin('nearest-office',choices,sample,async mode=>{assert.equal(mode,'nearest-office');return gpsNearestOfficeDeparture(gps,sample,TOLL_GATES);});
 assert.equal(nearby.departureMode,'nearest-office');
 assert.equal(nearby.officeName,'서울영업소');
 assert.notEqual(nearby.lat,gps.lat);
 assert.ok(nearby.officeDistance<100);
 await assert.rejects(resolveQuickOrigin('nearest-office',choices,sample,async()=>{throw Error('GPS 권한 거부');}),/GPS 권한 거부/);
 const code=fs.readFileSync(new URL('../data/quick-navigation.mjs',import.meta.url),'utf8');
 assert.ok(code.includes("$('qn-origin').value='';render()"));
 assert.ok(code.includes("new Option('가까운 거점"));
});

test('Suwon to Gwangam uses Hanam Dream directed OSM reversal instead of Hobep loop',()=>{
 const origin=gpsCurrentDeparture({lat:37.26694,lng:127.10244,accuracy:10,speed:0,heading:null});
 const goal=officeEndpoint({name:'광암터널관리동',lat:37.517,lng:127.172});
 const r=shortestHighwayRoute(graph,origin,goal);
 assert.equal(r.gwangamReentry,true);
 assert.ok(r.length>30000&&r.length<45000);
 assert.ok(r.waypoints.length<=5);
 assert.ok(!r.roads.some(x=>x.includes('호법')));
 for(const anchor of GWANGAM_REENTRY.anchors.slice(0,3))assert.ok(r.waypoints.some(x=>x.lat===anchor.lat&&x.lng===anchor.lng));
 assert.deepEqual([r.start.lat,r.start.lng],[origin.lat,origin.lng]);
 const kakao=new URL(kakaoNavigationURL(r)).searchParams;
 const naver=new URL(navigationURL(r,'https://box195.github.io/highway-gis/')).searchParams;
 assert.equal(kakao.get('sp'),'37.26694,127.10244');
 assert.equal(naver.get('slat'),'37.26694');
 assert.equal(kakao.get('vp3'),GWANGAM_REENTRY.anchors[0].lat+','+GWANGAM_REENTRY.anchors[0].lng);
 assert.equal(naver.get('v5lat'),String(GWANGAM_REENTRY.anchors[2].lat));
});

test('direct Dongseoul approach stays short; Seongnam and Pangyo can reach Hanam Dream',()=>{
 const goal=officeEndpoint({name:'광암터널관리동',lat:37.517,lng:127.172});
 const dongseoul=shortestHighwayRoute(graph,{lat:37.51645,lng:127.22021},goal);
 assert.ok(dongseoul.length<10000&&!dongseoul.gwangamReentry);
 for(const from of [{lat:37.43628,lng:127.12194},{lat:37.39742,lng:127.10066}]){
   const r=shortestHighwayRoute(graph,from,goal);
   assert.equal(r.gwangamReentry,true);
   assert.ok(r.length<30000&&r.waypoints.length<=5);
 }
});

test('extra locations are last within existing groups, without separate sections',()=>{
  const groups=navigationCatalog(sample);
  assert.deepEqual(groups.map(g=>g.key),['junctions','branches','offices','other-junctions']);
  assert.deepEqual(groups[0].items.map(i=>i.label),['송파IC','신갈JC']);
  assert.deepEqual(groups.at(-1).items.slice(-2).map(i=>i.label),['판교IC','성남IC']);
  assert.equal(groups.find(g=>g.key==='offices').items.at(-1).label,'서울영업소');
  const origins=quickOriginChoices(sample);
  assert.deepEqual(origins.filter(i=>i.group==='junctions').map(i=>i.label),['송파IC','신갈JC']);
  assert.deepEqual(origins.filter(i=>i.group==='other-junctions').slice(-2).map(i=>i.label),['판교IC','성남IC']);
  assert.equal(origins.filter(i=>i.group==='saved-hubs').at(-1).label,'서울영업소');
  const quick=fs.readFileSync(new URL('../data/quick-navigation.mjs',import.meta.url),'utf8');
  const detail=fs.readFileSync(new URL('../data/highway-navigation.mjs',import.meta.url),'utf8');
  assert.ok(!quick.includes("['extra-junctions'")&&!quick.includes("['out-of-area'"));
  assert.ok(!detail.includes("optionGroup('추가 IC · 관외 참고'")&&!detail.includes("optionGroup('관외 영업소'"));
  assert.ok(detail.includes("optionGroup('IC · JC (송파·신갈)'"));
});
