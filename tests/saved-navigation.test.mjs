import test from 'node:test';
import assert from 'node:assert/strict';
import {savedRoute,SAVED_HUBS} from '../data/saved-navigation.mjs';
import {navigationURL} from '../data/highway-routing.mjs';

test('Songpa is a saved hub and both directions retain all three exact controls',()=>{
  assert.ok(SAVED_HUBS.some(h=>h.id==='songpa'&&h.name==='송파IC'));
  const up=savedRoute('suwon','songpa'),down=savedRoute('songpa','suwon');
  assert.deepEqual(up.waypoints.map(p=>p.code),['8Q9994H2+4QX','8Q99F449+GQ5','8Q99F48C+VM8']);
  assert.deepEqual(down.waypoints.map(p=>p.code),['8Q99F48C+VM7','8Q99F449+GQM','8Q9994H2+5Q2']);
  assert.equal(up.waypoints[0].lat,37.3778625);assert.equal(up.waypoints[0].lng,127.101984375);
  assert.equal(down.waypoints[2].lng,127.101890625);
  assert.ok(up.waypoints.every((p,i)=>p.lng!==down.waypoints[2-i].lng));
  assert.notDeepEqual(up.goal,down.start);assert.equal(up.goal.name,down.start.name);
  for(const r of [up,down]){
    assert.equal(r.kind,'saved');assert.equal(r.points.length,5);
    const q=new URL(navigationURL(r,'https://example.com/')).searchParams;
    assert.equal(q.get('sname'),r.start.name);assert.equal(q.get('dname'),r.goal.name);
    assert.equal(q.has('v4lat'),false);
    for(let i=0;i<3;i++){assert.equal(Number(q.get(`v${i+1}lat`)),r.waypoints[i].lat);assert.equal(Number(q.get(`v${i+1}lng`)),r.waypoints[i].lng);}
  }
});

test('saved paths use the runtime Suwon location without motorway correction and cannot mutate later loads',()=>{
  const office={name:'수원신갈영업소',lat:37.266,lng:127.101};
  const up=savedRoute('suwon','songpa',[office]),down=savedRoute('songpa','suwon',[office]);
  assert.deepEqual(up.start,office);assert.deepEqual(down.goal,office);
  up.waypoints[0].lat=0;assert.equal(savedRoute('suwon','songpa').waypoints[0].lat,37.3778625);
  assert.throws(()=>savedRoute('songpa','songpa'),/다르게 선택/);
  assert.throws(()=>savedRoute('other','suwon'),/저장되지 않은/);
});
