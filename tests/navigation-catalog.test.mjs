import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {navigationCatalog,destinationPoint,savedDestinationRoute,returnDestination,SINGAL_JC} from '../data/navigation-catalog.mjs';
import {buildGraph,nearestHighwayPoint,topologyPoint,routingPolicy,availableOriginOptions,navigationURL,distance} from '../data/highway-routing.mjs';
import {officeEndpoint,savedOfficeDeparture,GATE_PROFILES} from '../data/highway-endpoints.mjs';
import {kakaoNavigationURL} from '../data/kakao-navigation.mjs';
import {TOLL_GATES} from '../data/highway-tollgates.mjs';
const graph=buildGraph(JSON.parse(fs.readFileSync(new URL('../data/highway-roads.json',import.meta.url),'utf8')));

test('quick-navigation catalog has requested fixed order, Korean office sorting and separate branch manholes',()=>{
  const at={lat:37.3,lng:127.1};
  const data={offices:[{...at,name:'하남영업소'},{...at,name:'한국도로공사 동서울지사'},{...at,name:'경기광주지사'},
    {...at,name:'곤지암영업소'},{...at,name:'수원신갈영업소'},{...at,name:'수원신갈영업소'},{...at,name:'본부'}, {name:'좌표 없는 영업소'}],
    manholes:[{...at,name:'10M',branch_code:'DONGSEOUL'},{...at,name:'2M',branch_code:'DONGSEOUL'},
      {...at,name:'2M',branch_code:'GWANGJU'},{...at,name:'1M',branch_code:'GWANGJU',coordinate_status:'ESTIMATED'},
      {...at,name:'2M',branch_code:'GWANGJU'},{name:'없는 좌표',branch_code:'GWANGJU'}]};
  const g=navigationCatalog(data);
  assert.deepEqual(g.map(x=>x.key),['junctions','branches','offices','dongseoul','gwangju']);
  assert.deepEqual(g[0].items.map(x=>x.label),['송파IC','신갈JC']);
  assert.deepEqual(g[1].items.map(x=>x.label),['경기광주지사','동서울지사']);
  assert.deepEqual(g[2].items.map(x=>x.label),['곤지암영업소','수원신갈영업소','하남영업소']);
  assert.deepEqual(g[3].items.map(x=>x.label),['2M','10M']);assert.deepEqual(g[4].items.map(x=>x.label),['1M','2M']);
  assert.equal(g[4].items[0].approximate,true);assert.notEqual(g[3].items[0].id,g[4].items[1].id);
  assert.equal(returnDestination(g).label,'수원신갈영업소');
  assert.equal(returnDestination(navigationCatalog()),undefined);
});

test('saved direction is offered only for the registered Suwon to Songpa trip',()=>{
  const g=navigationCatalog(),songpa=g[0].items[0],singal=g[0].items[1];
  const from={gateName:'수원신갈톨게이트'};
  assert.equal(savedDestinationRoute(from,songpa).waypoints.length,3);
  assert.throws(()=>savedDestinationRoute({gateName:'동서울톨게이트'},songpa),/등록되지/);
  assert.throws(()=>savedDestinationRoute(from,singal),/등록되지/);
  const p=destinationPoint(singal);assert.equal(p.roadHint,'경부고속도로');assert.equal(p.snapToHighway,true);
  assert.ok(distance(graph.nodes.get(436210017),SINGAL_JC)<.01);
});

test('Second Jungbu section names on an actual Jungbu carriageway do not route to a distant motorway',()=>{
  const gate=TOLL_GATES.find(g=>g.id===436295787);
  const actual=nearestHighwayPoint(graph,{...gate,roadHint:'중부고속도로'});
  const goal={lat:actual.lat,lng:actual.lng,name:'공용 구간',roadHint:'제2중부고속도로'};
  assert.ok(nearestHighwayPoint(graph,goal).gap>500);
  assert.equal(topologyPoint(graph,goal).roadHint,'중부고속도로');assert.equal(goal.roadHint,'제2중부고속도로');
  const origin={name:'수원신갈영업소',...TOLL_GATES.find(g=>g.id===1814821448)};origin.name='수원신갈영업소';
  const start=savedOfficeDeparture(origin,[],TOLL_GATES),policy=routingPolicy(graph,start,goal);
  assert.equal(policy.allowSecond,false);assert.equal(policy.target.roadHint,'중부고속도로');
  const out=availableOriginOptions(graph,start,goal);assert.equal(out.choices.length,2);
  for(const c of out.choices)assert.ok(!c.result.roads.includes('제2중부고속도로'));
  const e=graph.mainEdges.find(e=>e.road==='제2중부고속도로');
  const onSecond={...graph.nodes.get(e.a),roadHint:'제2중부고속도로'};
  assert.equal(topologyPoint(graph,onSecond),onSecond);
});

test('all viable public office-pair highway directions deliver identical endpoints and every guide to Naver and Kakao',()=>{
  const offices=GATE_PROFILES.map(p=>{const gate=TOLL_GATES.find(g=>p.aliases.some(a=>(g.name||'').startsWith(a)))||TOLL_GATES.find(g=>g.id===({'경기광주톨게이트':685222361,'곤지암톨게이트':436295655}[p.gate]));
    assert.ok(gate,p.gate);return {name:`${p.aliases[0]}영업소`,lat:gate.lat+.0007,lng:gate.lng-.0015};});
  offices.push({name:'경기광주지사',lat:37.35,lng:127.32},{name:'동서울지사',lat:37.52,lng:127.15});
  let checked=0;
  for(const from of offices)for(const to of offices){
    if(from===to)continue;
    const start=savedOfficeDeparture(from,[],TOLL_GATES),goal=officeEndpoint(to,[],TOLL_GATES);
    if(distance(start,goal)<30)continue;
    const out=availableOriginOptions(graph,start,goal);assert.ok(out.choices.length,`${from.name} → ${to.name}`);
    for(const {result:r} of out.choices){
      const n=new URL(navigationURL(r,'https://example.com/')).searchParams,k=new URL(kakaoNavigationURL(r)).searchParams;
      assert.equal(k.get('sp'),`${n.get('slat')},${n.get('slng')}`);assert.equal(k.get('ep'),`${n.get('dlat')},${n.get('dlng')}`);
      r.waypoints.forEach((p,i)=>assert.equal(k.get(i===0?'vp':`vp${i+1}`),`${n.get(`v${i+1}lat`)},${n.get(`v${i+1}lng`)}`));
      assert.ok(r.waypoints.length<=5);assert.ok(!r.roads.includes('제2중부고속도로'));checked++;
    }
  }
  for(const from of offices)for(const item of navigationCatalog()[0].items){
    const start=savedOfficeDeparture(from,[],TOLL_GATES),goal=destinationPoint(item);
    const out=availableOriginOptions(graph,start,goal);assert.ok(out.choices.length,`${from.name} → ${item.label}`);
    for(const {result:r} of out.choices){
      assert.ok(r.waypoints.length<=5);assert.ok(!r.roads.includes('제2중부고속도로'));
      const n=new URL(navigationURL(r,'https://example.com/')).searchParams,k=new URL(kakaoNavigationURL(r)).searchParams;
      assert.equal(k.get('ep'),`${n.get('dlat')},${n.get('dlng')}`);checked++;
    }
  }
  assert.ok(checked>100);console.log(`Public office parity checks: ${checked} viable directions`);
});
