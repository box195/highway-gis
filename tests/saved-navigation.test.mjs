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
  assert.equal(back.waypoints.length,5);
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

test('Songpa saved return reverses the verified local corridor, not Ring 1/Gyeongbu',()=>{
 const office={name:'수원신갈영업소',lat:37.26694,lng:127.10244};
 const up=savedRoute('suwon','songpa',[office]),back=savedRoute('songpa','suwon',[office]);
 assert.deepEqual(back.start,SONGPA_RETURN_START);
 assert.deepEqual(back.goal,office);
 // Start on public OSM southbound EXIT link rather than on the Ring 1 merge.
 assert.deepEqual([back.start.lat,back.start.lng],[
  SONGPA_EXIT_ACCESS[1].destination.lat,SONGPA_EXIT_ACCESS[1].destination.lng]);
 assert.notDeepEqual(back.start,up.goal);
 assert.equal(back.waypoints.length,5);
 assert.deepEqual(back.waypoints.map(p=>p.code),[
  '8Q99F48C+QWM','OSM:186410728:south','OSM:473590580:south',
  'OSM:277611773:south','OSM:624073974:south']);
 assert.deepEqual(back.roads,[
  '송파대로','헌릉로','헌릉로758길','탄천로','여수대로','대왕판교로','신수로']);
 assert.ok(back.roads.every(s=>!s.includes('고속도로')),'reject motorway fallback');
 assert.deepEqual(up.waypoints.map(p=>[p.lat,p.lng]),[
  [37.3778625,127.101984375],[37.4562625,127.119484375],[37.4671625,127.1218]]);
 assert.deepEqual([up.goal.lat,up.goal.lng],[37.4743032763,127.1294794184]);
 // Reverse lanes lie WEST of two-way OSM centerlines and original north points.
 assert.deepEqual([back.waypoints[0].lat,back.waypoints[0].lng],[37.4669625,127.122296875]);
 const osmCenters=[127.121754505,127.119450392,127.101943322];
 for(let i=1;i<3;i++){
  const p=back.waypoints[i];
  assert.ok(p.lng<osmCenters[i]&&p.lng<up.waypoints[2-i].lng);
  const lateralMeters=(osmCenters[i]-p.lng)*88100;
  assert.ok(lateralMeters>=3&&lateralMeters<=9.5,'reverse lane offset '+i);
  assert.ok(Math.abs(p.lat-up.waypoints[2-i].lat)<0.00005);
 }
 // Shinsu-ro way 277611773: primary one-way south, bearing 179.8 deg.
 // Shinsu-ro way 624073974: secondary one-way south, bearing 193.7 deg.
 assert.deepEqual(back.waypoints.slice(3).map(p=>[p.lat,p.lng]),[
  [37.34,127.102675866],[37.3,127.101818703]]);
 assert.ok(back.waypoints.every((p,i,a)=>i===0||a[i-1].lat>p.lat));
 for(const p of back.waypoints)assert.ok(![
  [37.467587435693986,127.12534885167113],
  [37.40764245477234,127.10681988958095],
  [37.3778653722917,127.10309435514655],
  [37.27021872946055,127.10367176332836]
 ].some(v=>v[0]===p.lat&&v[1]===p.lng),'wrong motorway guide');
 assert.equal(back.points.length,7);
 assert.deepEqual(back.points[0],back.start);
 assert.deepEqual(back.points.at(-1),back.goal);
 const q=new URL(kakaoNavigationURL(back)).searchParams;
 assert.equal(q.get('sp'),back.start.lat+','+back.start.lng);
 assert.equal(q.get('ep'),office.lat+','+office.lng);assert.equal(q.get('by'),'car');
 for(let i=0;i<5;i++)assert.equal(q.get(i?'vp'+(i+1):'vp'),
  back.waypoints[i].lat+','+back.waypoints[i].lng);
 assert.equal(q.has('vp6'),false);
 const n=new URL(navigationURL(back,'https://example.com/')).searchParams;
 for(let i=0;i<5;i++)assert.equal(
  n.get('v'+(i+1)+'lat')+','+n.get('v'+(i+1)+'lng'),q.get(i?'vp'+(i+1):'vp'));
});
