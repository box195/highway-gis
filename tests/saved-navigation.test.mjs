import test from 'node:test';
import assert from 'node:assert/strict';
import {savedRoute,SAVED_HUBS,SONGPA_RETURN_START} from '../data/saved-navigation.mjs';
import {navigationURL} from '../data/highway-routing.mjs';
import {SONGPA_EXIT_ACCESS} from '../data/songpa-exit-access.mjs';
import {kakaoNavigationURL} from '../data/kakao-navigation.mjs';

test('KakaoMap receives all three exact Songpa controls in order without desktop redirect',()=>{
  const office={name:'수원신갈영업소',lat:37.26694,lng:127.10244};
  const r=savedRoute('suwon','songpa',[office]);
  const before=JSON.stringify(r),url=kakaoNavigationURL(r),q=new URL(url).searchParams;
  assert.ok(url.startsWith('kakaomap://route?'));
  assert.equal(q.get('sp'),`${office.lat},${office.lng}`);
  assert.equal(q.get('ep'),`${r.goal.lat},${r.goal.lng}`);assert.equal(q.get('by'),'car');
  for(let i=0;i<3;i++)assert.equal(q.get(i===0?'vp':`vp${i+1}`),`${r.waypoints[i].lat},${r.waypoints[i].lng}`);
  assert.equal(q.has('vp1'),false);assert.equal(q.has('vp4'),false);
  const android=kakaoNavigationURL(r,true);
  assert.ok(android.startsWith('intent://route?'));assert.ok(android.includes('scheme=kakaomap;'));
  assert.ok(android.includes('package=net.daum.android.map;'));
  assert.equal(new URL(android).search,new URL(url).search);assert.equal(JSON.stringify(r),before);
});

test('KakaoMap rejects invalid routes and preserves the five-waypoint limit',()=>{
  assert.throws(()=>kakaoNavigationURL(null),/올바르지/);
  const r=savedRoute('suwon','songpa');
  assert.throws(()=>kakaoNavigationURL({...r,goal:{lat:NaN,lng:127}}),/올바르지/);
  assert.throws(()=>kakaoNavigationURL({...r,waypoints:[{lat:37}]}),/올바르지/);
  assert.throws(()=>kakaoNavigationURL({...r,waypoints:null}),/올바르지/);
  const five={...r,waypoints:[...r.waypoints,r.start,r.goal]};
  assert.ok(new URL(kakaoNavigationURL(five)).searchParams.has('vp5'));
  assert.throws(()=>kakaoNavigationURL({...five,waypoints:[...five.waypoints,r.start]}),/올바르지/);
});

test('Songpa outbound route retains all three controls with the updated third point',()=>{
  assert.ok(SAVED_HUBS.some(h=>h.id==='songpa'&&h.name==='송파IC'));
  const up=savedRoute('suwon','songpa');
  assert.deepEqual(up.waypoints.map(p=>p.code),['8Q9994H2+4QX','8Q99F449+GQ5','8Q99F48C+VP7']);
  assert.equal(up.waypoints[0].lat,37.3778625);assert.equal(up.waypoints[0].lng,127.101984375);
  assert.equal(up.waypoints[2].lat,37.4671625);assert.equal(up.waypoints[2].lng,127.1218);
  // Northbound is the east side of this roughly N-S two-way road.
  assert.ok(up.waypoints[2].lng>127.1217531089459);
  const back=savedRoute('songpa','suwon');
  assert.equal(back.waypoints.length,3);
  assert.notDeepEqual(back.waypoints.map(p=>[p.lat,p.lng]),[...up.waypoints].reverse().map(p=>[p.lat,p.lng]));
  for(const r of [up]){
    assert.equal(r.kind,'saved');assert.equal(r.points.length,5);
    const q=new URL(navigationURL(r,'https://example.com/')).searchParams;
    assert.equal(q.get('sname'),r.start.name);assert.equal(q.get('dname'),r.goal.name);
    assert.equal(q.has('v4lat'),false);
    for(let i=0;i<3;i++){assert.equal(Number(q.get(`v${i+1}lat`)),r.waypoints[i].lat);assert.equal(Number(q.get(`v${i+1}lng`)),r.waypoints[i].lng);}
  }
});

test('saved paths use the runtime Suwon location without motorway correction and cannot mutate later loads',()=>{
  const office={name:'수원신갈영업소',lat:37.266,lng:127.101};
  const up=savedRoute('suwon','songpa',[office]);
  assert.deepEqual(up.start,office);
  up.waypoints[0].lat=0;assert.equal(savedRoute('suwon','songpa').waypoints[0].lat,37.3778625);
  assert.throws(()=>savedRoute('songpa','songpa'),/다르게 선택/);
  assert.throws(()=>savedRoute('other','suwon'),/저장되지 않은/);
});

test('Songpa saved return has precisely three guides and exact navigation-only Suwon destination',()=>{
 const office={name:'수원신갈영업소',lat:37.26694,lng:127.10244};
 const before={...office};
 const up=savedRoute('suwon','songpa',[office]),back=savedRoute('songpa','suwon',[office]);
 assert.deepEqual(back.start,SONGPA_RETURN_START);
 assert.deepEqual([back.start.lat,back.start.lng],[37.4788875,127.133921875]);
 assert.notDeepEqual(back.start,up.goal);
 assert.equal(back.start.plusCode,'8Q99F4HM+HH3');
 assert.equal(back.goal.plusCode,'8Q997482+XWX');
 assert.deepEqual([back.goal.lat,back.goal.lng],[37.2674875,127.102359375]);
 assert.notDeepEqual(back.goal,office);
 assert.deepEqual(office,before);
 assert.deepEqual(up.start,office);
 assert.deepEqual(back.waypoints.map(p=>p.code),['8Q99F48C+QWM','OSM:186410728:south','8Q9973CW+CJR']);
 assert.deepEqual(back.waypoints.map(p=>[p.lat,p.lng]),[
  [37.4669625,127.122296875],[37.456263302,127.1193993],[37.2711125,127.096515625]]);
 assert.equal(back.waypoints.length,3);
 assert.equal(back.points.length,5);
 assert.deepEqual(back.points[0],back.start);
 assert.deepEqual(back.points.at(-1),back.goal);
 assert.ok(back.roads.every(s=>!s.includes('고속도로')));
 assert.deepEqual(up.waypoints.map(p=>[p.lat,p.lng]),[
  [37.3778625,127.101984375],[37.4562625,127.119484375],[37.4671625,127.1218]]);
 assert.deepEqual([up.goal.lat,up.goal.lng],[37.4743032763,127.1294794184]);
 const q=new URL(kakaoNavigationURL(back)).searchParams;
 assert.equal(q.get('sp'),'37.4788875,127.133921875');
 assert.equal(q.get('ep'),'37.2674875,127.102359375');
 assert.equal(q.get('by'),'car');
 for(let i=0;i<3;i++)assert.equal(q.get(i?'vp'+(i+1):'vp'),
  back.waypoints[i].lat+','+back.waypoints[i].lng);
 assert.equal(q.has('vp4'),false);
 const n=new URL(navigationURL(back,'https://example.com/')).searchParams;
 assert.equal(n.get('dlat'),'37.2674875');assert.equal(n.get('dlng'),'127.102359375');
 assert.equal(n.has('v4lat'),false);
 for(let i=0;i<3;i++)assert.equal(
  n.get('v'+(i+1)+'lat')+','+n.get('v'+(i+1)+'lng'),q.get(i?'vp'+(i+1):'vp'));
});
