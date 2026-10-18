import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph,route,availableOriginOptions,originOptions,distance,navigationURL} from '../data/highway-routing.mjs';
import {navigationCatalog,destinationPoint,savedDestinationRoute} from '../data/navigation-catalog.mjs';
import {SONGPA_IC,savedRoute} from '../data/saved-navigation.mjs';
import {SONGPA_EXIT_ACCESS} from '../data/songpa-exit-access.mjs';
import {kakaoNavigationURL} from '../data/kakao-navigation.mjs';
import {TOLL_GATES} from '../data/highway-tollgates.mjs';
import {savedOfficeDeparture} from '../data/highway-endpoints.mjs';

const graph=buildGraph(JSON.parse(fs.readFileSync(new URL('../data/highway-roads.json',import.meta.url),'utf8')));
const item=navigationCatalog()[0].items[0],goal=destinationPoint(item);
const pairs=SONGPA_EXIT_ACCESS.map(a=>[a.approach,a.destination]);
const coord=p=>String(p.lat)+','+String(p.lng);
const providerParity=r=>{
  const n=new URL(navigationURL(r,'https://example.com/')).searchParams;
  const k=new URL(kakaoNavigationURL(r)).searchParams;
  assert.equal(k.get('ep'),n.get('dlat')+','+n.get('dlng'));
  assert.equal(k.get('sp'),n.get('slat')+','+n.get('slng'));
  assert.equal(n.get('dlat')+','+n.get('dlng'),coord(r.goal));
  assert.ok(r.waypoints.length<=5);
  r.waypoints.forEach((p,i)=>assert.equal(k.get(i===0?'vp':'vp'+(i+1)),
    n.get('v'+(i+1)+'lat')+','+n.get('v'+(i+1)+'lng')));
};

test('Songpa mode separation preserves saved entry point and exact three controls',()=>{
  const saved=savedRoute('suwon','songpa');
  assert.deepEqual([saved.goal.lat,saved.goal.lng],[37.4743032763,127.1294794184]);
  assert.deepEqual(saved.goal,SONGPA_IC);
  assert.deepEqual(saved.waypoints.map(p=>[p.lat,p.lng]),[
    [37.3778625,127.101984375],[37.4562625,127.119484375],[37.4671625,127.1218]]);
  assert.equal(goal.snapToHighway,true);
  assert.equal(goal.hasGateTopology,true);
  assert.deepEqual(goal.arrivalAnchors,SONGPA_EXIT_ACCESS);
  assert.equal(goal.arrivalAnchors.length,2);
  assert.equal(item.source.lat,SONGPA_IC.lat);assert.equal(item.source.lng,SONGPA_IC.lng);
  for(const a of SONGPA_EXIT_ACCESS)assert.notEqual(coord(a.destination),coord(saved.goal));
});

test('each directed Ring carriageway reaches its own Songpa exit, not entry or opposite lane',()=>{
  assert.deepEqual(SONGPA_EXIT_ACCESS.map(a=>a.approach),['northbound','southbound']);
  assert.notEqual(coord(SONGPA_EXIT_ACCESS[0].destination),coord(SONGPA_EXIT_ACCESS[1].destination));
  for(const a of SONGPA_EXIT_ACCESS){
    assert.equal(a.kind,'ic-exit');assert.equal(a.road,goal.roadHint);
    assert.equal(a.terminalOffsetMeters,35);
    const e=graph.mainEdgeByKey.get(a.edgeKey);
    assert.ok(e,'directed carriageway anchor '+a.approach);
    assert.equal(e.road,a.road);assert.ok(distance(a,graph.nodes.get(e.b))<32);
    assert.deepEqual(a.rampPoints.at(-1),a.destination);
    const synthetic={name:a.approach, ...graph.nodes.get(e.a),roadHint:a.road,snapToHighway:true};
    const r=route(graph,synthetic,goal,a.bearing);
    assert.equal(coord(r.goal),coord(a.destination),a.approach);
    assert.ok(distance(r.points.at(-1),r.goal)<.01);
    assert.ok(r.arrivalDirection.includes('IC'));
    assert.equal(r.arrivalAtToll,false);
    providerParity(r);
  }
});

test('Suwon highway directions select a real Songpa exit and keep both provider coordinates aligned',()=>{
  const gate=TOLL_GATES.find(g=>g.id===1814821448);
  const office={...gate,name:savedRoute('suwon','songpa').start.name};
  const start=savedOfficeDeparture(office,[],TOLL_GATES);
  const options=availableOriginOptions(graph,start,goal);
  assert.ok(options.choices.length,JSON.stringify(options.rejected));
  for(const {result:r} of options.choices){
    assert.ok(pairs.some(([,p])=>coord(p)===coord(r.goal)),coord(r.goal));
    assert.notEqual(coord(r.goal),coord(SONGPA_IC));
    assert.ok(r.arrivalDirection.includes('IC'));
    providerParity(r);
  }
});

const rawPath=new URL('../../roads-osm.json',import.meta.url);
test('full public OSM traces both Songpa exit chains in the permitted direction',
  {skip:!fs.existsSync(rawPath)},()=>{
    const raw=JSON.parse(fs.readFileSync(rawPath,'utf8'));
    const ways=new Map(raw.elements.filter(e=>e.type==='way').map(w=>[w.id,w]));
    const nodes=new Map(raw.elements.filter(e=>e.type==='node').map(n=>[n.id,n]));
    for(const a of SONGPA_EXIT_ACCESS){
      const e=graph.mainEdgeByKey.get(a.edgeKey);
      const firstFork=ways.get(a.sourceWayIds[0]).nodes[0];
      let current=e.b;
      for(let n=0;n<8&&current!==firstFork;n++){
        const next=graph.mainEdges.filter(edge=>edge.a===current&&edge.road===a.road);
        assert.equal(next.length,1,'missing directed mainline predecessor of exit fork');
        current=next[0].b;
      }
      assert.equal(current,firstFork,'anchor not upstream of exit fork');
      let at=firstFork;assert.ok(nodes.has(at));
      for(const id of a.sourceWayIds){
        const w=ways.get(id);assert.ok(w,id);
        assert.equal(w.tags.highway,'motorway_link');
        assert.equal(w.tags.oneway,'yes');
        assert.equal(w.nodes[0],at,'wrong-way or missing ramp connection');
        at=w.nodes.at(-1);
      }
      assert.equal(at,a.terminalNodeId);
      const terminal=nodes.get(at);
      assert.ok(distance(a.destination,{lat:terminal.lat,lng:terminal.lon})<=35.1);
      assert.ok(distance(a.destination,{lat:terminal.lat,lng:terminal.lon})>=30);
      assert.notEqual(at,e.a);assert.notEqual(at,e.b);
    }
  });

