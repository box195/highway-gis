import test from 'node:test';
import assert from 'node:assert/strict';
import {savedRoute,SAVED_HUBS} from '../data/saved-navigation.mjs';
import {navigationURL} from '../data/highway-routing.mjs';
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
  assert.deepEqual(up.waypoints.map(p=>p.code),['8Q9994H2+4QX','8Q99F449+GQ5','8Q99F48C+VM9']);
  assert.equal(up.waypoints[0].lat,37.3778625);assert.equal(up.waypoints[0].lng,127.101984375);
  assert.equal(up.waypoints[2].lng,127.121734375);
  assert.throws(()=>savedRoute('songpa','suwon'),/저장되지 않은/);
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
