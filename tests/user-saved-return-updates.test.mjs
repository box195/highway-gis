import test from 'node:test';
import assert from 'node:assert/strict';
import {quickOriginChoices,manualOriginDeparture} from '../data/quick-origin.mjs';
import {nearestOfficeDeparture,USER_ARRIVAL_OVERRIDES} from '../data/highway-endpoints.mjs';
import {navigationCatalog,destinationPoint,returnDestination,savedDestinationRoute} from '../data/navigation-catalog.mjs';
import {resolveQuickChoices,routeCache} from '../data/quick-route-cache.mjs';
import {savedRoute} from '../data/saved-navigation.mjs';
import {USER_SAVED_RETURN_DEPARTURES} from '../data/hybrid-saved-return.mjs';
import {kakaoNavigationURL} from '../data/kakao-navigation.mjs';
import {navigationURL} from '../data/highway-routing.mjs';
import {TOLL_GATES} from '../data/highway-tollgates.mjs';

const cases=[
  {name:'동서울영업소',gis:[37.5166,127.221],start:['8Q99G68C+4FH',37.5153125,127.221234375],vias:['8Q9973CW+CJR']},
  {name:'경기광주영업소',gis:[37.4465,127.2668],start:['8Q99C7W8+HQ3',37.4463875,127.266921875],vias:['8Q9996WJ+69C','8Q9994H2+GVJ','8Q9973CW+CJR']},
  {name:'곤지암영업소',gis:[37.355,127.3214],start:['8Q99983C+XG6',37.3549125,127.321265625],vias:['8Q9996WJ+69C','8Q9994H2+GVJ','8Q9973CW+CJR']},
  // Synthetic GIS coordinate fixture only; return itself MUST share Gonjiam's override.
  {name:'경기광주지사',gis:[37.30,127.27],start:['8Q99983C+XG6',37.3549125,127.321265625],vias:['8Q9996WJ+69C','8Q9994H2+GVJ','8Q9973CW+CJR']},
  {name:'서이천영업소',gis:[37.2705,127.1073],start:null,vias:['8Q99793C+WGJ','8Q996683+GGJ','8Q9974C4+5WH']}
];
const data={offices:[...cases.map(c=>({name:c.name,lat:c.gis[0],lng:c.gis[1]})),{name:'수원신갈영업소',lat:37.267,lng:127.1024}],interchanges:[]};
const item=returnDestination(navigationCatalog(data),data),destination=destinationPoint(item,data);
function decodeFullOLCCenter(code){
  assert.match(code,/^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{3}$/);
  const alphabet='23456789CFGHJMPQRVWX',digits=code.replace('+','');
  let lat=-90,lng=-180,res=20;
  for(let i=0;i<10;i+=2){lat+=alphabet.indexOf(digits[i])*res;lng+=alphabet.indexOf(digits[i+1])*res;res/=20;}
  const last=alphabet.indexOf(digits[10]);
  lat+=(Math.floor(last/4)+0.5)*res*20/5;
  lng+=((last%4)+0.5)*res*20/4;
  return [lat,lng];
}
const knownVias={
  '8Q999472+MJ5':[37.3641375,127.101609375],
  '8Q9992VF+3HG':[37.3926875,127.023953125],
  '8Q99F48C+QWM':[37.4669625,127.122296875],
  'OSM:186410728:south':[37.456263302,127.1193993],
  '8Q99793C+WGJ':[37.2548375,127.371265625],
  '8Q996683+GGJ':[37.2163375,127.203765625],
  '8Q9996WJ+69C':[37.3955625,127.230890625],
  '8Q9994H2+GVJ':[37.3788375,127.102140625],
  '8Q9973CW+CJR':[37.2711125,127.096515625],
  '8Q9974C4+5WH':[37.2704375,127.107359375],
  '8Q997482+XWX':[37.2674875,127.102359375]
};
test('exact user-provided 11-character OLC centres are locally reproducible',()=>{
  for(const c of cases)if(c.start)assert.deepEqual(decodeFullOLCCenter(c.start[0]).map(n=>+n.toFixed(12)),c.start.slice(1));
  for(const [code,center] of Object.entries(knownVias).filter(([code])=>code.includes('+')))
    assert.deepEqual(decodeFullOLCCenter(code).map(n=>+n.toFixed(12)),center);
});
test('five special offices and branches dispatch manually and GPS-nearest without graph, exact starts/vias, both providers',async()=>{
  const catalog=quickOriginChoices(data);
  for(const c of cases){
    const source=catalog.find(x=>x.label===c.name);assert.ok(source,c.name);
    const manual=manualOriginDeparture(source,data,TOLL_GATES);
    const nearest=nearestOfficeDeparture({lat:c.gis[0],lng:c.gis[1],accuracy:10},data.offices,data.interchanges,TOLL_GATES);
    assert.equal(nearest.officeName,c.name);
    for(const start of [manual,nearest]){
      const originalStart=[start.lat,start.lng],originalName=start.officeName;
      const {choices,fromCache}=await resolveQuickChoices({
        start,item,mode:'saved',destination,data,cache:routeCache(null),
        loadGraph:async()=>{throw Error('direct routes must not load graph');},savedDestinationRoute
      });
      assert.equal(fromCache,false);
      assert.equal(choices.length,1);
      const r=choices[0].result;
      assert.equal(r.kind,'saved');
      assert.deepEqual(r.points[0],r.start);
      assert.equal(r.sourceOffice,originalName);
      assert.equal(r.waypoints.length,c.vias.length);
      assert.deepEqual(r.waypoints.map(p=>p.code),c.vias);
      assert.deepEqual([start.lat,start.lng],originalStart,'route must not mutate the origin');
      assert.deepEqual([r.goal.lat,r.goal.lng],[37.2674875,127.102359375]);
      if(c.start){
        assert.deepEqual([r.start.plusCode,r.start.lat,r.start.lng],c.start);
        assert.deepEqual([r.start.lat,r.start.lng],USER_SAVED_RETURN_DEPARTURES[c.name]&&[USER_SAVED_RETURN_DEPARTURES[c.name].lat,USER_SAVED_RETURN_DEPARTURES[c.name].lng]);
      }else{
        assert.deepEqual([r.start.lat,r.start.lng],originalStart,'Seoicheon departure remains existing');
      }
      for(const p of r.waypoints)assert.deepEqual([p.lat,p.lng],knownVias[p.code]);
      const kakao=new URL(kakaoNavigationURL(r)).searchParams;
      const naver=new URL(navigationURL(r,'https://example.org/gis')).searchParams;
      assert.equal(kakao.get('sp'),r.start.lat+','+r.start.lng);
      assert.equal(kakao.get('ep'),'37.2674875,127.102359375');
      assert.equal(naver.get('slat'),String(r.start.lat));
      assert.equal(naver.get('slng'),String(r.start.lng));
      assert.equal(naver.get('dlat'),'37.2674875');
      for(let i=0;i<r.waypoints.length;i++){
        assert.equal(kakao.get(i?'vp'+(i+1):'vp'),r.waypoints[i].lat+','+r.waypoints[i].lng);
        assert.equal(naver.get('v'+(i+1)+'lat'),String(r.waypoints[i].lat));
      }
      assert.equal(kakao.has('vp'+(r.waypoints.length+1)),false);
    }
  }
});
test('Dongseoul arrival pin and original office/GIS and Songpa saved-return remain unchanged',()=>{
  const dong=data.offices.find(o=>o.name==='동서울영업소');
  const before=JSON.stringify(dong);
  const arrival=destinationPoint({id:'office:동서울영업소',kind:'office',label:dong.name,source:dong},data);
  assert.deepEqual(arrival.userArrivalOverride,{lat:37.5166875,lng:127.221015625});
  assert.equal(arrival.userArrivalPlusCode,'8Q99G68C+MCC');
  assert.equal(USER_ARRIVAL_OVERRIDES.find(p=>p.match.test(dong.name)).plusCode,'8Q99G68C+MCC');
  assert.equal(JSON.stringify(dong),before);
  assert.deepEqual(savedRoute('songpa','suwon',data.offices).waypoints.map(p=>p.code),['8Q99F48C+QWM','8Q9973CW+CJR']);
  assert.deepEqual(savedRoute('suwon','songpa',data.offices).waypoints.map(p=>p.code),['8Q9994H2+4QX','8Q99F449+GQ5','8Q99F48C+VP7']);
});
test('branch shares Gonjiam immutable return controls and departure override',()=>{
  assert.equal(USER_SAVED_RETURN_DEPARTURES['경기광주지사'],USER_SAVED_RETURN_DEPARTURES['곤지암영업소']);
  assert.notEqual(USER_SAVED_RETURN_DEPARTURES['경기광주지사'],USER_SAVED_RETURN_DEPARTURES['경기광주영업소']);
  assert.deepEqual(cases.find(c=>c.name==='경기광주지사').vias,cases.find(c=>c.name==='곤지암영업소').vias);
});

test('Cheonggye outbound only uses exact single via and destination, both providers, GPS and manual',async()=>{
  const office={name:'청계영업소',lat:37.379,lng:127.102};
  const fixture={...data,offices:[...data.offices,office]};
  const target=navigationCatalog(fixture).flatMap(g=>g.items).find(i=>i.label===office.name);
  const dest=destinationPoint(target,fixture);
  const manual=manualOriginDeparture(quickOriginChoices(fixture).find(i=>i.label==='수원신갈영업소'),fixture,TOLL_GATES);
  const gps={lat:37.267,lng:127.1024,name:'현재 위치',officeName:'현재 위치',departureMode:'gps-current'};
  for(const start of [gps,manual]){
    const {choices}=await resolveQuickChoices({start,item:target,mode:'saved',destination:dest,data:fixture,cache:routeCache(null),loadGraph:async()=>{throw Error('saved outbound must not load graph');},savedDestinationRoute});
    const r=choices[0].result;
    assert.equal(r.kind,'saved');assert.equal(r.waypoints.length,1);
    assert.equal(r.waypoints[0].code,'8Q999472+MJ5');assert.equal(r.goal.plusCode,'8Q9992VF+3HG');
    assert.deepEqual([r.waypoints[0].lat,r.waypoints[0].lng],knownVias['8Q999472+MJ5']);
    assert.deepEqual([r.goal.lat,r.goal.lng],knownVias['8Q9992VF+3HG']);
    const origin=start.original||start;assert.deepEqual([r.start.lat,r.start.lng],[origin.lat,origin.lng]);
    const k=new URL(kakaoNavigationURL(r)).searchParams,n=new URL(navigationURL(r,'https://example.org/gis')).searchParams;
    assert.equal(k.get('vp'),'37.3641375,127.101609375');assert.equal(k.get('ep'),'37.3926875,127.023953125');assert.equal(k.has('vp2'),false);
    assert.equal(n.get('v1lat'),'37.3641375');assert.equal(n.get('v1lng'),'127.101609375');assert.equal(n.get('dlat'),'37.3926875');assert.equal(n.get('dlng'),'127.023953125');assert.equal(n.has('v2lat'),false);
  }
  const start=manualOriginDeparture(quickOriginChoices(fixture).find(i=>i.label===office.name),fixture,TOLL_GATES);
  const {choices}=await resolveQuickChoices({start,item,mode:'saved',destination,data:fixture,cache:routeCache(null),loadGraph:async()=>{throw Error('saved return must not load graph');},savedDestinationRoute});
  assert.deepEqual(choices[0].result.waypoints.map(p=>p.code),['8Q9994H2+GVJ','8Q9973CW+CJR']);
  assert.deepEqual([choices[0].result.goal.lat,choices[0].result.goal.lng],[37.2674875,127.102359375]);
});
