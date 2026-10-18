import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildGraph,route,navigationURL,nearestHighwayPoint,originOptions,availableOriginOptions,ROADS,distance} from '../data/highway-routing.mjs';
import {officeEndpoint,departureEndpoint,nearestOfficeDeparture,savedOfficeDeparture,roadFrom,GATE_PROFILES,supportsHighwayOffice} from '../data/highway-endpoints.mjs';
import {TOLL_GATES} from '../data/highway-tollgates.mjs';
import {kakaoNavigationURL} from '../data/kakao-navigation.mjs';
import {TOLL_ACCESS} from '../data/highway-toll-access.mjs';
const graph=buildGraph(JSON.parse(fs.readFileSync(new URL('../data/highway-roads.json',import.meta.url),'utf8')));
const booth=id=>TOLL_GATES.find(g=>g.id===id);
// Synthetic office positions offset from public OSM toll nodes. No private
// infrastructure pack or user GPS position is committed in these tests.
const office=(name,id)=>({name,lat:booth(id).lat+.0007,lng:booth(id).lng-.0015});
const suwon=office('수원신갈영업소',1814821448),gonjiam=office('곤지암영업소',436295655),icheon=office('서이천영업소',436294773);

test('nearest-office departure works away from the office and ignores the GPS travel heading',()=>{
  const gps={lat:suwon.lat-.01,lng:suwon.lng,speed:20,heading:180,accuracy:10};
  const start=nearestOfficeDeparture(gps,[gonjiam,{name:'좌표 없음'},suwon],[],TOLL_GATES);
  assert.equal(start.officeName,suwon.name);assert.equal(start.gateName,'수원신갈톨게이트');
  assert.ok(start.officeDistance>1000);assert.equal(start.heading,null);assert.equal(start.speed,0);
  const goal=officeEndpoint(office('동서울영업소',436295787),[],TOLL_GATES);
  const choices=originOptions(graph,start,goal);
  assert.equal(choices.length,2);
  for(const c of choices){
    const r=route(graph,start,goal,null,c.key);
    assert.ok(r.waypoints.length<=5);assert.ok(nearestHighwayPoint(graph,r.start).gap<1);
    assert.ok(distance(r.start,gps)>500);
    const q=new URL(navigationURL(r,'https://example.com/')).searchParams;
    assert.equal(Number(q.get('slat')),r.start.lat);assert.notEqual(Number(q.get('slat')),gps.lat);
  }
});

test('nearest-office departure reports missing saved coordinates',()=>{
  assert.throws(()=>nearestOfficeDeparture({lat:37,lng:127},[{name:'좌표 없음'}]),/저장된 거점이 없습니다/);
});
test('office identity resolves to its gate and correct motorway, not the nearest parallel road',()=>{
  for(const item of [gonjiam,icheon]){
    const p=officeEndpoint(item,[],TOLL_GATES);
    assert.equal(p.roadHint,'중부고속도로');assert.equal(p.endpointKind,'office');assert.equal(p.snapToHighway,true);
    assert.ok(p.gateName.includes(item.name.replace('영업소','')));assert.notEqual(p.lat,item.lat);
  }
  assert.equal(officeEndpoint(suwon,[],TOLL_GATES).roadHint,'경부고속도로');
  assert.equal(GATE_PROFILES.length,10);
});
test('ordinary office routes preserve Jungbu approaches and finish at the selected office goal',()=>{
  const start=departureEndpoint(graph,{...suwon,speed:0,accuracy:10},[suwon],[],TOLL_GATES);
  assert.equal(start.endpointKind,'office');
  for(const item of [gonjiam,icheon]){
    const r=route(graph,start,officeEndpoint(item,[],TOLL_GATES));
    assert.equal(r.roads.at(-1),'중부고속도로');assert.ok(!r.roads.includes('제2중부고속도로'));
    assert.ok(nearestHighwayPoint(graph,r.start).gap<1);const expected=item.name==='곤지암영업소'?{lat:37.3550644,lng:127.3225997}:item;assert.equal(r.goal.lat,expected.lat);assert.equal(r.goal.lng,expected.lng);
    assert.ok(nearestHighwayPoint(graph,r.waypoints.at(-1)).gap<1);
    assert.ok(r.waypoints.at(-1).name.includes('요금소 진출 방향'));
    assert.ok(distance(r.points.at(-1),booth(r.arrivalGateId))<1);assert.equal(r.arrivalAtOffice,item.name!=='곤지암영업소');assert.equal(r.arrivalAtOfficeFrontToll,item.name==='곤지암영업소');
    const q=new URL(navigationURL(r,'https://example.com/')).searchParams;
    assert.equal(Number(q.get('slat')),r.start.lat);assert.equal(Number(q.get('dlat')),r.goal.lat);
    assert.equal(Number(q.get('dlat')),expected.lat);assert.equal(q.get('dname'),item.name);
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

test('through-toll arrivals preserve both directed approaches and the saved office destination',()=>{
  const incoming=new Map();for(const e of graph.mainEdges){if(!incoming.has(e.b))incoming.set(e.b,[]);incoming.get(e.b).push(e);}
  for(const [name,id] of [['청계영업소',4340329006],['성남영업소',734816282],['구리남양주영업소',5338499735],['동서울영업소',436295787]]){
    const goal=officeEndpoint(office(name,id),[],TOLL_GATES);
    // Deliberately retain an office near just one side of the toll plaza.
    // The arrival must still be reachable directly from either carriageway.
    const headings=new Set();
    for(const anchor of goal.arrivalAnchors){
      if(anchor.kind!=='through')continue;
      const group=Math.round(anchor.bearing/90)%4;if(headings.has(group))continue;headings.add(group);
      let edge=graph.mainEdgeByKey.get(anchor.edgeKey),travelled=0;
      const seen=new Set();
      while(travelled<1200&&!seen.has(edge.a)){
        seen.add(edge.a);const prev=(incoming.get(edge.a)||[]).find(e=>e.road===edge.road);if(!prev)break;
        travelled+=edge.length;edge=prev;
      }
      const a=graph.nodes.get(edge.a),b=graph.nodes.get(edge.b),start={lat:(a.lat+b.lat)/2,lng:(a.lng+b.lng)/2};
      const result=route(graph,start,goal,null,`${edge.a}:${edge.b}`);
      const delta=Math.abs(((result.arrivalBearing-anchor.bearing+540)%360)-180);
      assert.ok(delta<60,`${name}: wrong arrival direction ${delta}`);
      assert.ok(result.length<4000,`${name}: unnecessary return loop ${result.length}`);
      assert.ok(result.arrivalDirection.includes('요금소 통과 방향'));
      assert.equal(result.goal.lat,goal.original.lat);assert.equal(result.goal.lng,goal.original.lng);
      assert.equal(result.arrivalAtOffice,true);assert.equal(result.arrivalAtToll,false);
      const q=new URL(navigationURL(result,'https://example.com/')).searchParams;
      assert.equal(q.get('dname'),name);assert.equal(Number(q.get('dlat')),result.goal.lat);
    }
    assert.ok(headings.size>=2,`${name}: preserve both direct approaches`);
  }
});
test('arrival at an IC uses an exit booth, never the nearest entry-only booth',()=>{
  assert.equal(TOLL_ACCESS[436295655].length,0);assert.ok(TOLL_ACCESS[436295298].length>0);
  const goal=officeEndpoint(gonjiam,[],TOLL_GATES),r=route(graph,officeEndpoint(suwon,[],TOLL_GATES),goal);
  assert.equal(r.arrivalGateId,436295298);assert.ok(r.arrivalDirection.includes('요금소 진출 방향'));
  assert.ok(!r.roads.includes('제2중부고속도로'));
});

test('Gwangju-area offices preserve exit guides while using office-side destinations',()=>{
  const start=officeEndpoint(suwon,[],TOLL_GATES);
  for(const [name,id] of [['경기광주영업소',685222361],['곤지암영업소',436295655],['서이천영업소',436294773],['하남영업소',TOLL_GATES.find(g=>/^하남/.test(g.name)).id],['경기광주지사',685222361]]){
    const goal=officeEndpoint(office(name,id),[],TOLL_GATES);
    const {choices}=availableOriginOptions(graph,start,goal);assert.ok(choices.length);
    for(const {result:r} of choices){
      const chosen=goal.arrivalAnchors.find(a=>a.gateId===r.arrivalGateId&&a.bearing===r.arrivalBearing);
      assert.ok(chosen,`${name}: missing direction-specific exit guide`);
      assert.ok(nearestHighwayPoint(graph,r.waypoints.at(-1)).gap<1);
      assert.ok(distance(chosen,r.waypoints.at(-1))>200);
      const expected=goal.officeDestination||booth(r.arrivalGateId);
      assert.ok(distance(r.goal,expected)<1);
      assert.ok(distance(r.points.at(-1),booth(r.arrivalGateId))<1);assert.ok(r.waypoints.length<=5);
      assert.ok(r.waypoints.at(-1).name.includes('요금소 진출 방향'));
      assert.equal(chosen.kind,'exit');assert.ok(chosen.rampPoints.length>=2);
      // The line includes the real ramp to the booth, rather than a straight
      // segment from the main carriageway to a building/surface-road marker.
      assert.deepEqual(r.points.slice(-chosen.rampPoints.length),chosen.rampPoints);
    }
  }
});
test('unknown toll approach topology fails instead of guessing the opposite carriageway',()=>{
  const goal={...officeEndpoint(gonjiam,[],TOLL_GATES),arrivalAnchors:[]};
  assert.throws(()=>route(graph,officeEndpoint(suwon,[],TOLL_GATES),goal),/도착 방향을 확인할 수 없습니다/);
});

test('Suwon north via Pangyo and Hanam finishes southbound at Dongseoul without plaza-side ambiguity',()=>{
  const goal=officeEndpoint(office('동서울영업소',436295787),[],TOLL_GATES),start=officeEndpoint(suwon,[],TOLL_GATES);
  const key=originOptions(graph,start,goal).find(c=>c.key.endsWith('|hanam')).key;
  const r=route(graph,start,goal,null,key),gate=booth(436296492),guide=r.waypoints.at(-1);
  assert.deepEqual(r.roads,['경부고속도로','수도권제1순환고속도로','중부고속도로']);
  assert.ok(r.arrivalDirection.includes('광주·호법 방향(남하)'));assert.equal(r.arrivalOffset,0);
  assert.ok(guide.lat>gate.lat);assert.equal(r.arrivalGateId,gate.id);
  assert.ok(distance(guide,gate)>500);assert.deepEqual({lat:r.goal.lat,lng:r.goal.lng},goal.original);
  assert.ok(r.waypoints.length<=5);
});
test('five motorway runs on the southern Dongseoul detour fit five waypoints',()=>{
  const goal=officeEndpoint(office('동서울영업소',436295787),[],TOLL_GATES),start=officeEndpoint(gonjiam,[],TOLL_GATES);
  const key=originOptions(graph,start,goal).find(c=>c.label.includes('남쪽')).key;
  const r=route(graph,start,goal,null,key);
  assert.deepEqual(r.roads,['중부고속도로','영동고속도로','경부고속도로','수도권제1순환고속도로','중부고속도로']);
  assert.equal(r.waypoints.length,5);assert.ok(r.waypoints.every(p=>!p.name.includes('연결로')));
});
test('both Suwon corridors finish at the same Dongseoul office-side destination',()=>{
  const start=officeEndpoint(suwon,[],TOLL_GATES),goal=officeEndpoint(office('동서울영업소',436295787),[],TOLL_GATES);
  const choices=originOptions(graph,start,goal);assert.equal(choices.length,2);
  const hanam=route(graph,start,goal,null,choices.find(c=>c.key.endsWith('|hanam')).key);
  const hobeop=route(graph,start,goal,null,choices.find(c=>c.key.endsWith('|hobeop')).key);
  assert.deepEqual(hanam.roads,['경부고속도로','수도권제1순환고속도로','중부고속도로']);
  assert.deepEqual(hobeop.roads.slice(0,3),['경부고속도로','영동고속도로','중부고속도로']);
  assert.ok(hanam.arrivalDirection.includes('남하'));assert.ok(hobeop.arrivalDirection.includes('북상'));
  assert.ok(hanam.waypoints.length<=5);assert.ok(hobeop.waypoints.length<=5);
  assert.equal(hanam.arrivalGateId,436296492);assert.equal(hobeop.arrivalGateId,436295787);
  for(const r of [hanam,hobeop]){
    assert.deepEqual({lat:r.goal.lat,lng:r.goal.lng},goal.original);
    assert.equal(r.arrivalAtOffice,true);assert.ok(r.length<100000);
  }
});

test('Suwon to Topyeong selects junction corridors instead of north/south departure',()=>{
  const start=officeEndpoint(suwon,[],TOLL_GATES),goal=officeEndpoint(office('토평영업소',414691638),[],TOLL_GATES);
  const choices=originOptions(graph,start,goal);
  assert.deepEqual(choices.map(c=>c.label),['판교·하남 경유 → 영업소 위치 도착','신갈·호법 경유 → 영업소 위치 도착']);
  const hanam=route(graph,start,goal,null,choices[0].key),hobeop=route(graph,start,goal,null,choices[1].key);
  assert.deepEqual(hanam.roads,['경부고속도로','수도권제1순환고속도로']);
  assert.deepEqual(hobeop.roads,['경부고속도로','영동고속도로','중부고속도로','수도권제1순환고속도로']);
  for(const r of [hanam,hobeop]){
    assert.ok(r.points[1].lat>r.points[0].lat);assert.ok(r.waypoints.length<=5);
    assert.ok(!r.roads.includes('제2중부고속도로'));
    const q=new URL(navigationURL(r,'https://example.com/')).searchParams;
    assert.equal(Number(q.get('slat')),r.start.lat);assert.equal(Number(q.get('dlat')),r.goal.lat);
  }
});

test('Suwon corridors work for Gwangju offices and a branch-style destination without Dongseoul identity',()=>{
  const start=officeEndpoint(suwon,[],TOLL_GATES);
  // Public toll coordinates, not the user's private branch coordinates.
  const goals=[officeEndpoint(office('경기광주영업소',685222361),[],TOLL_GATES),
    {name:'경기광주지사 인근 본선 테스트',lat:booth(685222361).lat,lng:booth(685222361).lng}];
  for(const goal of goals){
    const choices=originOptions(graph,start,goal);assert.equal(choices.length,2);
    const hanam=route(graph,start,goal,null,choices[0].key),hobeop=route(graph,start,goal,null,choices[1].key);
    assert.deepEqual(hanam.roads,['경부고속도로','수도권제1순환고속도로','중부고속도로']);
    assert.deepEqual(hobeop.roads,['경부고속도로','영동고속도로','중부고속도로']);
    for(const r of [hanam,hobeop]){assert.ok(r.waypoints.length<=5);assert.ok(r.points[1].lat>r.points[0].lat);}
  }
});

test('junction corridor keys cannot be used from an unrelated departure',()=>{
  const start=officeEndpoint(gonjiam,[],TOLL_GATES),goal=officeEndpoint(office('토평영업소',414691638),[],TOLL_GATES);
  const choices=originOptions(graph,start,goal);
  assert.ok(choices.every(c=>!c.key.includes('|')));
  assert.throws(()=>route(graph,start,goal,null,choices[0].key+'|hobeop'),/선택한 경유 경로/);
  const nearbyGoal=officeEndpoint(office('성남영업소',734816282),[],TOLL_GATES);
  assert.ok(originOptions(graph,officeEndpoint(suwon,[],TOLL_GATES),nearbyGoal).every(c=>!c.key.includes('|')));
});

test('Gwangju branch uses Gonjiam rather than Gwangju toll regardless of building proximity',()=>{
  const building=office('경기광주지사',685222361),goal=officeEndpoint(building,[],TOLL_GATES);
  assert.equal(goal.gateName,'곤지암톨게이트');assert.equal(goal.roadHint,'중부고속도로');
  assert.ok(goal.arrivalAnchors.length>0);assert.ok(goal.arrivalAnchors.every(a=>a.gateId===436295298));
  const start=officeEndpoint(suwon,[],TOLL_GATES);
  for(const c of originOptions(graph,start,goal)){
    const r=route(graph,start,goal,null,c.key);assert.equal(r.arrivalGateId,436295298);assert.ok(r.waypoints.length<=5);
  }
});

test('Dongseoul branch and regional office use both directed Seo-hanam exits',()=>{
  for(const name of ['동서울지사','서울경기본부']){
    const goal=officeEndpoint({...suwon,name},[],TOLL_GATES);
    assert.equal(goal.gateName,'서하남IC');assert.equal(goal.arrivalAnchors.length,2);
    for(const anchor of goal.arrivalAnchors){
      const e=graph.mainEdgeByKey.get(anchor.edgeKey),a=graph.nodes.get(e.a),b=graph.nodes.get(e.b);
      const start={lat:a.lat+(b.lat-a.lat)*.1,lng:a.lng+(b.lng-a.lng)*.1,roadHint:e.road};
      const r=route(graph,start,goal,null,anchor.edgeKey);
      assert.ok(r.length<200);assert.ok(r.arrivalDirection.includes('진출 방향'));
      assert.ok(distance(r.goal,anchor)<1);
    }
    const start=officeEndpoint(suwon,[],TOLL_GATES);
    for(const c of originOptions(graph,start,goal))assert.ok(route(graph,start,goal,null,c.key).waypoints.length<=5);
  }
});

test('Gwangam management building preserves the specified Plus Code and traffic centres are excluded',()=>{
  const goal=officeEndpoint({...suwon,name:'광암터널관리동'},[],TOLL_GATES);
  assert.equal(goal.lat,37.5163875);assert.equal(goal.lng,127.174515625);
  const r=route(graph,officeEndpoint(suwon,[],TOLL_GATES),goal);
  assert.equal(r.goal,goal);assert.ok(r.waypoints.length<=5);
  assert.equal(supportsHighwayOffice({name:'수도권 교통 센터'}),false);
  assert.equal(supportsHighwayOffice({name:'경기광주지사'}),true);
  const gps={lat:suwon.lat,lng:suwon.lng};
  const chosen=nearestOfficeDeparture(gps,[{...suwon,name:'교통센터'},{...gonjiam}],[],TOLL_GATES);
  assert.equal(chosen.officeName,gonjiam.name);
  assert.throws(()=>nearestOfficeDeparture(gps,[{...suwon,name:'교통센터'}],[],TOLL_GATES),/저장된 거점이 없습니다/);
});

test('only precomputed viable directions are offered and their routes are reused',()=>{
  const start=officeEndpoint(suwon,[],TOLL_GATES);
  for(const [name,id] of [['청계영업소',4340329006],['성남영업소',734816282]]){
    const goal=officeEndpoint(office(name,id),[],TOLL_GATES),{choices,rejected}=availableOriginOptions(graph,start,goal);
    assert.equal(choices.length,1);assert.ok(choices[0].label.includes('북쪽'));
    assert.ok(rejected.some(c=>c.label.includes('남쪽')));
    assert.ok(choices[0].result.waypoints.length<=5);
    assert.deepEqual(choices[0].result,route(graph,start,goal,null,choices[0].key));
  }
  const goal=officeEndpoint(office('토평영업소',414691638),[],TOLL_GATES);
  const {choices}=availableOriginOptions(graph,start,goal);
  assert.equal(choices.length,2);assert.ok(choices.every(c=>c.key.includes('|')&&c.result.waypoints.length<=5));
});

test('manual office departure uses only the chosen hub and keeps short endpoint names',()=>{
  const start=savedOfficeDeparture({...suwon,heading:180,speed:20},[],TOLL_GATES);
  assert.equal(start.name,suwon.name);assert.equal(start.officeName,suwon.name);
  assert.equal(start.heading,null);assert.equal(start.departureMode,'saved-office');assert.equal(start.accuracy,null);
  const goal=officeEndpoint(office('동서울영업소',436295787),[],TOLL_GATES);
  for(const c of availableOriginOptions(graph,start,goal).choices){
    const q=new URL(navigationURL(c.result,'https://example.com/')).searchParams;
    assert.equal(q.get('sname'),suwon.name);assert.equal(q.get('dname'),'동서울영업소');
    assert.ok(nearestHighwayPoint(graph,c.result.start).gap<1);
  }
  for(const name of ['경기광주지사','동서울지사','서울경기본부','광암터널관리동']){
    const item={...suwon,name},departure=savedOfficeDeparture(item,[],TOLL_GATES);
    assert.equal(departure.name,name);assert.equal(officeEndpoint(item,[],TOLL_GATES).name,name);
  }
  for(const item of [undefined,{name:'좌표 없음'},{...suwon,name:'교통센터'}])assert.throws(()=>savedOfficeDeparture(item,[],TOLL_GATES),/출발 거점/);
});

test('verified Gonjiam and Hanam office-front toll goals keep exit controls and provider parity',()=>{
  const start=officeEndpoint(suwon,[],TOLL_GATES);
  const scenarios=[
    {name:'곤지암영업소',gate:436295655,point:{lat:37.3550644,lng:127.3225997}},
    {name:'하남영업소',gate:10705706620,point:{lat:37.5284503,lng:127.2179637}}
  ];
  for(const {name,gate,point} of scenarios){
    const original=office(name,gate),goal=officeEndpoint(original,[],TOLL_GATES);
    assert.deepEqual(goal.officeDestination,point);
    assert.deepEqual(goal.original,{lat:original.lat,lng:original.lng});
    assert.equal(goal.officeFrontExitToll,true);
    assert.ok(goal.endpointNote.includes('건물 입구는 아닙니다'));
    assert.ok(goal.arrivalAnchors.length>0);
    const choices=availableOriginOptions(graph,start,goal).choices;
    assert.ok(choices.length>0,name);
    for(const {result:r} of choices){
      assert.deepEqual({lat:r.goal.lat,lng:r.goal.lng},point);
      assert.equal(r.arrivalAtOffice,false);
      assert.equal(r.arrivalAtOfficeFrontToll,true);
      assert.ok(r.waypoints.length<=5);
      assert.ok(r.waypoints.at(-1).name.includes('요금소 진출 방향'));
      const chosen=goal.arrivalAnchors.find(a=>a.gateId===r.arrivalGateId&&a.bearing===r.arrivalBearing);
      assert.ok(chosen,name);
      assert.ok(distance(r.points.at(-1),booth(r.arrivalGateId))<1);
      const n=new URL(navigationURL(r,'https://example.com/')).searchParams;
      const k=new URL(kakaoNavigationURL(r)).searchParams;
      assert.equal(Number(n.get('dlat')),point.lat);
      assert.equal(Number(n.get('dlng')),point.lng);
      assert.equal(k.get('ep'),n.get('dlat')+','+n.get('dlng'));
      r.waypoints.forEach((p,i)=>assert.equal(k.get(i===0?'vp':'vp'+(i+1)),n.get('v'+(i+1)+'lat')+','+n.get('v'+(i+1)+'lng')));
    }
  }
  const gwangju=officeEndpoint(office('경기광주영업소',685222361),[],TOLL_GATES);
  assert.equal(gwangju.officeDestination,null);
  const through=office('동서울영업소',436295787),throughGoal=officeEndpoint(through,[],TOLL_GATES);
  assert.deepEqual(throughGoal.officeDestination,{lat:through.lat,lng:through.lng});
  assert.equal(throughGoal.officeFrontExitToll,undefined);
});
