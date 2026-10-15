import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ROADS,buildGraph,route} from '../data/highway-routing.mjs';
const snapshot=JSON.parse(fs.readFileSync(new URL('../data/highway-roads.json',import.meta.url),'utf8'));
const graph=buildGraph(snapshot);
test('bundled OSM snapshot contains real geometry for all five roads',()=>{
  assert.ok(graph.nodes.size>10000);assert.ok(graph.edges.length>20000);
  assert.equal(snapshot.license,'ODbL-1.0');
  for(const road of ROADS)assert.ok(graph.mainEdges.filter(e=>e.road===road).length>100);
  for(const e of graph.edges)assert.ok(!e.road||ROADS.includes(e.road));
});
test('real directed junction network connects all five permitted roads',()=>{
  // SCCs require reachability in both directions; geographical crossings alone
  // cannot satisfy this test. Iterative DFS avoids large-stack failures.
  const rev=new Map();
  for(const e of graph.edges){if(!rev.has(e.b))rev.set(e.b,[]);rev.get(e.b).push(e.a);}
  const seen=new Set(),order=[];
  for(const id of graph.nodes.keys()){
    if(seen.has(id))continue;const stack=[[id,false]];
    while(stack.length){const [n,done]=stack.pop();if(done){order.push(n);continue;}if(seen.has(n))continue;seen.add(n);stack.push([n,true]);for(const e of graph.adj.get(n)||[])if(!seen.has(e.b))stack.push([e.b,false]);}
  }
  seen.clear();let core=[];
  for(const id of order.reverse()){
    if(seen.has(id))continue;const component=[],stack=[id];seen.add(id);
    while(stack.length){const n=stack.pop();component.push(n);for(const a of rev.get(n)||[])if(!seen.has(a)){seen.add(a);stack.push(a);}}
    if(component.length>core.length)core=component;
  }
  const ids=new Set(core),edges=graph.mainEdges.filter(e=>ids.has(e.a)&&ids.has(e.b));
  assert.deepEqual(new Set(edges.map(e=>e.road)),new Set(ROADS));
  // Select actual interior carriageway points in the connected network.
  const samples=ROADS.map(road=>edges.find(e=>e.road===road));
  const midpoint=e=>{const a=graph.nodes.get(e.a),b=graph.nodes.get(e.b);return {lat:(a.lat+b.lat)/2,lng:(a.lng+b.lng)/2};};
  let checked=0,tooLong=0;
  for(let i=0;i<samples.length;i++)for(let j=0;j<samples.length;j++){
    if(i===j)continue;
    const e=samples[i];
    try{
      const r=route(graph,midpoint(e),midpoint(samples[j]),null,`${e.a}:${e.b}`);
      assert.ok(r.waypoints.length<=5);assert.ok(r.length>0);checked++;
    }catch(error){if(/5개 넘게/.test(error.message))tooLong++;else throw error;}
  }
  console.log(`Real-network checks: ${checked} routes / ${tooLong} correctly blocked at waypoint limit; core ${core.length} nodes`);
  assert.equal(checked+tooLong,20);assert.ok(checked>=10);
});
