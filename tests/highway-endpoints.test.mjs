import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph,route,navigationURL,nearestHighwayPoint,ROADS,distance} from '../data/highway-routing.mjs';
import {officeEndpoint,departureEndpoint,roadFrom,GATE_PROFILES} from '../data/highway-endpoints.mjs';
import {TOLL_GATES} from '../data/highway-tollgates.mjs';
const graph=buildGraph(JSON.parse(fs.readFileSync(new URL('../data/highway-roads.json',import.meta.url),'utf8')));
const booth=id=>TOLL_GATES.find(g=>g.id===id);
// Synthetic office positions offset from public OSM toll nodes. No private
// infrastructure pack or user GPS position is committed in these tests.
const office=(name,id)=>({name,lat:booth(id).lat+.0007,lng:booth(id).lng-.0015});
const suwon=office('수원신갈영업소',1814821448),gonjiam=office('곤지암영업소',436295655),icheon=office('서이천영업소',436294773);
test('office identity resolves to its gate and correct motorway, not the nearest parallel road',()=>{
  for(const item of [gonjiam,icheon]){
    const p=officeEndpoint(item,[],TOLL_GATES);
    assert.equal(p.roadHint,'중부고속도로');assert.equal(p.endpointKind,'office');assert.equal(p.snapToHighway,true);
    assert.ok(p.gateName.includes(item.name.replace('영업소','')));assert.notEqual(p.lat,item.lat);
  }
  assert.equal(officeEndpoint(suwon,[],TOLL_GATES).roadHint,'경부고속도로');
  assert.equal(GATE_PROFILES.length,10);
});
test('ordinary office routes use Jungbu and Naver gets on-carriageway endpoints',()=>{
  const start=departureEndpoint(graph,{...suwon,speed:0,accuracy:10},[suwon],[],TOLL_GATES);
  assert.equal(start.endpointKind,'office');
  for(const item of [gonjiam,icheon]){
    const r=route(graph,start,officeEndpoint(item,[],TOLL_GATES));
    assert.equal(r.roads.at(-1),'중부고속도로');assert.ok(!r.roads.includes('제2중부고속도로'));
    assert.ok(nearestHighwayPoint(graph,r.start).gap<1);assert.ok(nearestHighwayPoint(graph,r.goal).gap<1);
    const q=new URL(navigationURL(r,'https://example.com/')).searchParams;
    assert.equal(Number(q.get('slat')),r.start.lat);assert.equal(Number(q.get('dlat')),r.goal.lat);
    assert.notEqual(Number(q.get('dlat')),item.lat);assert.ok(q.get('dname').includes('톨게이트'));
  }
});
test('IC fallback uses exact gate identity instead of another similarly named interchange',()=>{
  const interchanges=[{name:'동곤지암IC',lat:gonjiam.lat,lng:gonjiam.lng},{name:'곤지암IC',lat:gonjiam.lat+.002,lng:gonjiam.lng}];
  const p=officeEndpoint(gonjiam,interchanges,[]);
  assert.equal(p.lat,interchanges[1].lat);
});
test('on-road inspection coordinates remain unchanged even close to an office',()=>{
  const p=nearestHighwayPoint(graph,officeEndpoint(gonjiam,[],TOLL_GATES));
  const gps={lat:p.lat,lng:p.lng,speed:0};assert.equal(departureEndpoint(graph,gps,[gonjiam],[],TOLL_GATES),gps);
  const start=officeEndpoint(suwon,[],TOLL_GATES),goal={lat:p.lat,lng:p.lng,name:'도로 위 점검지',roadHint:'중부고속도로'};
  const r=route(graph,start,goal);assert.equal(r.goal,goal);assert.equal(r.goal.lat,goal.lat);
});
test('Second Jungbu is allowed for a destination actually on that motorway',()=>{
  const gate=booth(436295655);
  const e=graph.mainEdges.filter(e=>e.road===ROADS[3]).sort((a,b)=>distance(graph.nodes.get(a.a),gate)-distance(graph.nodes.get(b.a),gate))[0];
  const a=graph.nodes.get(e.a),b=graph.nodes.get(e.b),goal={lat:(a.lat+b.lat)/2,lng:(a.lng+b.lng)/2,name:'제2중부선 점검 인공',roadHint:ROADS[3]};
  const r=route(graph,officeEndpoint(suwon,[],TOLL_GATES),goal);
  assert.equal(r.roads.at(-1),ROADS[3]);assert.equal(r.goal,goal);
});
test('leaving Second Jungbu permits only an initial exit, without re-entering later',()=>{
  const gate=booth(436295655);
  const p=nearestHighwayPoint(graph,{...gate,roadHint:ROADS[3]});
  const r=route(graph,{lat:p.lat,lng:p.lng},officeEndpoint(gonjiam,[],TOLL_GATES));
  assert.equal(r.roads[0],ROADS[3]);assert.equal(r.roads.at(-1),'중부고속도로');assert.equal(r.roads.filter(n=>n===ROADS[3]).length,1);
});
test('facility metadata distinguishes Jungbu from Second Jungbu',()=>{
  assert.equal(roadFrom('제2중부선 (하남-호법)'),ROADS[3]);assert.equal(roadFrom('중부선 광주IC'),ROADS[2]);
});
