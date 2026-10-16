import test from 'node:test';
import assert from 'node:assert/strict';
import {ROADS,ROAD_QUERY,buildGraph,route,navigationURL,makeWaypoints,originOptions} from '../data/highway-routing.mjs';

function fixture(){
  const elements=[];
  // Two disconnected crossing motorways plus three isolated allowed roads.
  const node=(id,lat,lon)=>elements.push({type:'node',id,lat,lon});
  node(1,37,127);node(2,37,127.02);node(3,37,127.04);
  node(4,37.0002,127.04);node(5,37.0002,127.02);node(6,37.0002,127);
  node(7,36.99,127.025);node(8,37.01,127.025);node(11,37.02,127.025);
  node(9,37.005,127.022);node(10,37.007,127.024);
  const way=(id,nodes,name,highway='motorway',extra={})=>elements.push({type:'way',id,nodes,tags:{highway,name,oneway:'yes',...extra}});
  way(101,[1,2,3],ROADS[1]);way(102,[4,5,6],ROADS[1]);way(103,[7,8,11],ROADS[0]);
  for(let i=2;i<5;i++){node(20+i*2,37.1+i*.1,127);node(21+i*2,37.1+i*.1,127.1);way(200+i,[20+i*2,21+i*2],ROADS[i]);}
  return {elements,node,way};
}
test('query is fixed public topology; five permitted names only',()=>{
  assert.ok(ROAD_QUERY.includes('bbox:34,126,38.8,130'));
  assert.equal(ROADS.length,5);assert.ok(!ROAD_QUERY.includes('start'));
});
test('same directed segment is clipped correctly',()=>{
  const g=buildGraph(fixture()), r=route(g,{lat:37,lng:127.003},{lat:37,lng:127.014},90);
  assert.ok(r.length>900&&r.length<1100);assert.equal(r.points.length,2);
  assert.deepEqual(r.roads,[ROADS[1]]);assert.ok(r.waypoints.length<=5);
});
test('adjacent segments with no intervening Dijkstra edges preserve middle geometry',()=>{
  const g=buildGraph(fixture()),r=route(g,{lat:37,lng:127.01},{lat:37,lng:127.03},90);
  assert.ok(r.points.some(p=>p.lng===127.02));assert.ok(r.length>1700&&r.length<1900);
});
test('motorway crossing is not a junction',()=>{
  assert.throws(()=>route(buildGraph(fixture()),{lat:37,lng:127.005},{lat:37.009,lng:127.025},90),/경로가 없습니다/);
});
test('directed ramps join permitted roads and preserve road sequence',()=>{
  const f=fixture();f.way(301,[2,9,10,8],'분기점','motorway_link');
  const r=route(buildGraph(f),{lat:37,lng:127.005},{lat:37.019,lng:127.025},90);
  assert.deepEqual(r.roads,[ROADS[1],ROADS[0]]);assert.ok(r.points.some(p=>p.lat===37.005));
  assert.throws(()=>route(buildGraph(f),{lat:37.019,lng:127.025},{lat:37,lng:127.005},0),/경로가 없습니다/);
});
test('private ramp and unknown ramp direction fail closed',()=>{
  for(const extra of [{access:'private'},{oneway:undefined}]){
    const f=fixture();f.way(301,[2,9,8],'분기점','motorway_link',extra);
    assert.throws(()=>route(buildGraph(f),{lat:37,lng:127.005},{lat:37.009,lng:127.025},90),/경로가 없습니다/);
  }
});
test('unlisted motorway and surface roads do not create a shortcut',()=>{
  const f=fixture();f.way(301,[2,9,8],'수도권제2순환고속도로');f.way(302,[2,10,8],'국도','primary');
  const g=buildGraph(f);assert.ok(!g.edges.some(e=>e.way===301||e.way===302));
});
test('reversed oneway is respected',()=>{
  const f=fixture();f.elements.find(w=>w.id===101).tags.oneway='-1';const g=buildGraph(f);
  assert.ok(g.edges.some(e=>e.a===3&&e.b===2));assert.ok(!g.edges.some(e=>e.a===2&&e.b===3));
});
test('invalid/missing data and remote endpoints reject',()=>{
  assert.throws(()=>buildGraph({}),/JSON/);const f=fixture();f.elements=f.elements.filter(e=>e.id!==202);
  assert.throws(()=>buildGraph(f),/누락/);
  assert.throws(()=>route(buildGraph(fixture()),{lat:0,lng:0},{lat:37,lng:127}),/올바르지/);
  assert.throws(()=>route(buildGraph(fixture()),{lat:38,lng:128},{lat:37,lng:127}),/3km/);
});
test('departure options distinguish carriageway direction',()=>{
  const options=originOptions(buildGraph(fixture()),{lat:37.0001,lng:127.01});
  assert.ok(options.some(o=>o.label.includes('동쪽')));assert.ok(options.some(o=>o.label.includes('서쪽')));
  const g=buildGraph(fixture()),key=options.find(o=>o.label.includes('동쪽')).key;
  const r=route(g,{lat:37.0001,lng:127.01},{lat:37,lng:127.03},null,key);assert.ok(r.length>0);
});
test('too many direction anchors never silently truncate',()=>{
  const points=Array.from({length:25},(_,i)=>({lat:37,lng:127+i*.04}));
  assert.throws(()=>makeWaypoints(points,points.map((_,i)=>ROADS[i%5])),/5개 넘게/);
});
test('a long two-road route uses one pre-junction and one post-junction anchor, without distance fillers',()=>{
  const points=Array.from({length:65},(_,i)=>({lat:37,lng:127+i*.02}));
  const roads=points.map((_,i)=>i<32?ROADS[4]:ROADS[2]);
  const waypoints=makeWaypoints(points,roads);
  assert.equal(waypoints.length,2);assert.ok(waypoints[0].name.includes('분기 전'));assert.ok(waypoints[1].name.includes('합류 후'));
});
test('Naver URL encodes all names, lat/lng order and exact waypoint count',()=>{
  const r={start:{lat:37.1,lng:127.2},goal:{lat:37.3,lng:127.4,name:'수원 & 신갈 #1'},waypoints:[{lat:37.2,lng:127.3,name:'경부 → 영동'}]};
  const u=new URL(navigationURL(r,'https://box195.github.io/highway-gis/'));
  assert.equal(u.protocol,'nmap:');assert.equal(u.searchParams.get('dname'),r.goal.name);
  assert.equal(u.searchParams.get('v1lat'),'37.2');assert.equal(u.searchParams.get('v1lng'),'127.3');
  assert.equal(u.searchParams.has('v2lat'),false);assert.ok(navigationURL(r,'https://example.com',true).includes('package=com.nhn.android.nmap;end'));
  assert.throws(()=>navigationURL({...r,waypoints:Array(6).fill(r.waypoints[0])},'x'),/올바르지/);
});

test('through-toll routes omit the merge guide but retain the pre-plaza guide',()=>{
  const points=Array.from({length:31},(_,i)=>({lat:37,lng:127+i*.002}));
  const roads=points.map((_,i)=>ROADS[Math.min(2,Math.floor(i/10))]);
  const waypoints=makeWaypoints(points,roads,{kind:'through',offset:700});
  assert.equal(waypoints.length,3);
  assert.ok(waypoints.slice(0,-1).every(p=>p.name.includes('분기 전')));
  assert.ok(waypoints.at(-1).name.includes('요금소 진입 방향'));
  assert.ok(!waypoints.some(p=>p.name.includes('합류 후')));
});

test('six runs fit only with a known snapped departure and preserve all later guides',()=>{
  const points=Array.from({length:61},(_,i)=>({lat:37,lng:127+i*.002}));
  const roads=points.map((_,i)=>ROADS[Math.floor(i/10)%5]);
  const arrival={kind:'through',offset:700};
  assert.throws(()=>makeWaypoints(points,roads,arrival),/5개 넘게/);
  const waypoints=makeWaypoints(points,roads,arrival,{anchoredStart:true});
  assert.equal(waypoints.length,5);
  for(let i=0;i<4;i++)assert.ok(waypoints[i].name.includes(ROADS[i+1]+' · 분기 전'));
  assert.ok(waypoints.at(-1).name.includes('요금소 진입 방향'));
  assert.ok(waypoints.every((p,i)=>!i||p.lng>waypoints[i-1].lng));
  const longer=Array.from({length:71},(_,i)=>({lat:37,lng:127+i*.002}));
  assert.throws(()=>makeWaypoints(longer,longer.map((_,i)=>ROADS[Math.floor(i/10)%5]),arrival,{anchoredStart:true}),/5개 넘게/);
});

test('a snapped mainline destination replaces only its final merge guide',()=>{
  const points=Array.from({length:21},(_,i)=>({lat:37,lng:127+i*.002}));
  const roads=points.map((_,i)=>i<10?ROADS[1]:ROADS[2]);
  const regular=makeWaypoints(points,roads),anchored=makeWaypoints(points,roads,null,{anchoredGoal:true});
  assert.equal(regular.length,2);assert.equal(anchored.length,1);
  assert.deepEqual(anchored[0],regular[0]);
});
