import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph,availableOriginOptions,distance} from '../data/highway-routing.mjs';
import {officeEndpoint,savedOfficeDeparture} from '../data/highway-endpoints.mjs';
import {TOLL_GATES} from '../data/highway-tollgates.mjs';
const graph=buildGraph(JSON.parse(fs.readFileSync(new URL('../data/highway-roads.json',import.meta.url),'utf8')));
const gate=id=>{const g=TOLL_GATES.find(x=>x.id===id);assert.ok(g,id);return g};
const office=(name,id)=>({name,lat:gate(id).lat+.0005,lng:gate(id).lng+.0004});
const starts=[
  office('수원신갈영업소',1814821448),
  office('구리남양주영업소',5338499735),
  office('경기광주영업소',685222361),
  office('하남영업소',10705706620),
  office('곤지암영업소',436295298)
];
const tollDestinations=[
  office('성남영업소',734816282),
  office('서이천영업소',436294773)
];
test('Seongnam and SeoIcheon toll destinations use both directed arrivals and stop upstream of the right-hand toll edge',()=>{
  for(const dest of tollDestinations){
    const goal=officeEndpoint(dest,[],TOLL_GATES);
    assert.equal(goal.stopBeforeToll,true,dest.name);
    assert.equal(goal.officeDestination,null);
    assert.ok(goal.arrivalAnchors.length>=2);
    const reached=new Set();let checked=0;
    for(const from of starts){
      const start=savedOfficeDeparture(from,[],TOLL_GATES);
      if(distance(start,goal)<30)continue;
      const routes=availableOriginOptions(graph,start,goal).choices;
      for(const {result:r} of routes){
        assert.equal(r.arrivalAtToll,true,dest.name);
        assert.equal(r.arrivalAtOffice,false);
        assert.ok(r.arrivalDirection);
        const booth=gate(r.arrivalGateId),gap=distance(r.goal,booth);
        assert.ok(gap>=8&&gap<90,`${dest.name} gap ${gap}`);
        assert.equal(r.waypoints.length<=5,true);
        reached.add(Math.cos(r.arrivalBearing*Math.PI/180)>=0?'north':'south');
        checked++;
      }
    }
    assert.ok(checked>=2,dest.name);
    assert.deepEqual([...reached].sort(),['north','south'],dest.name);
  }
});
test('Hanam stays on entry-side office location and allows legal external U-turn/re-entry',()=>{
  const site={name:'하남영업소',lat:37.5290415,lng:127.2192231};
  const goal=officeEndpoint(site,[],TOLL_GATES);
  assert.equal(goal.stopBeforeToll,false);
  assert.deepEqual(goal.officeDestination,{lat:site.lat,lng:site.lng});
  for(const from of starts.slice(0,2)){
    const result=availableOriginOptions(graph,savedOfficeDeparture(from,[],TOLL_GATES),goal);
    assert.ok(result.choices.length);
    for(const {result:r} of result.choices){
      assert.equal(r.goal.lat,site.lat);assert.equal(r.goal.lng,site.lng);
      assert.equal(r.arrivalAtOffice,true);assert.equal(r.arrivalAtOfficeFrontToll,false);
    }
  }
});
test('Dongseoul branch finishes at actual office coordinates via either directed Seo-Hanam exit',()=>{
  const site={name:'한국도로공사 동서울지사',lat:37.51413,lng:127.15375};
  const goal=officeEndpoint(site,[],TOLL_GATES);
  assert.equal(goal.officeDestination.lat,site.lat);
  assert.equal(goal.officeDestination.lng,site.lng);
  const bearings=new Set();
  for(const from of starts.slice(0,2)){
    const options=availableOriginOptions(graph,savedOfficeDeparture(from,[],TOLL_GATES),goal);
    assert.ok(options.choices.length);
    for(const {result:r} of options.choices){
      assert.equal(r.goal.lat,site.lat);assert.equal(r.goal.lng,site.lng);
      assert.equal(r.arrivalAtOffice,true);
      assert.equal(r.arrivalAtToll,false);
      assert.ok(r.roads.includes('수도권제1순환고속도로'));
      assert.ok(r.waypoints.some(p=>p.name.includes('서하남IC 진출 방향')));
      bearings.add(r.arrivalBearing);
    }
  }
  assert.ok(bearings.has(53));assert.ok(bearings.has(259));
});

