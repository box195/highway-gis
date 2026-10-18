import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {navigationCatalog,destinationPoint,savedDestinationRoute,returnDestination,SINGAL_JC} from '../data/navigation-catalog.mjs';
import {buildGraph,nearestHighwayPoint,topologyPoint,routingPolicy,availableOriginOptions,navigationURL,distance} from '../data/highway-routing.mjs';
import {officeEndpoint,savedOfficeDeparture,GATE_PROFILES} from '../data/highway-endpoints.mjs';
import {kakaoNavigationURL} from '../data/kakao-navigation.mjs';
import {TOLL_GATES} from '../data/highway-tollgates.mjs';
const graph=buildGraph(JSON.parse(fs.readFileSync(new URL('../data/highway-roads.json',import.meta.url),'utf8')));

test('destination buttons keep priority, branches, office order; replace manholes with sorted GIS IC/JC',()=>{
  const at={lat:37.3,lng:127.1};
  const data={offices:[{...at,name:'하남영업소'},{...at,name:'한국도로공사 동서울지사'},{...at,name:'경기광주지사'},
    {...at,name:'곤지암영업소'},{...at,name:'수원신갈영업소'},{...at,name:'수원신갈영업소'},{...at,name:'광암터널관리동'},{...at,name:'본부'}],
    manholes:[{...at,name:'신원IC',branch_code:'DONGSEOUL'},{...at,name:'2M',branch_code:'GWANGJU'}],
    interchanges:[{...at,name:'판교JC'},{...at,name:'송파IC'},{...at,name:'광주IC'},{...at,name:'안성JC'},
      {...at,name:'광주IC'},{...at,name:'신갈JC'},{...at,name:'자연공원'},{name:'무좌표IC'}]};
  const groups=navigationCatalog(data);
  assert.deepEqual(groups.map(g=>g.key),['junctions','branches','offices','other-junctions']);
  assert.deepEqual(groups[0].items.map(x=>x.label),['송파IC','신갈JC']);
  assert.deepEqual(groups[1].items.map(x=>x.label),['경기광주지사','동서울지사']);
  assert.deepEqual(groups[2].items.map(x=>x.label),['곤지암영업소','광암터널관리동','하남영업소']);
  const gwangam=groups[2].items.find(x=>x.label==='광암터널관리동');
  const chosen=destinationPoint(gwangam,data);assert.equal(chosen.lat,37.5163803548384);assert.equal(chosen.lng,127.17451770787038);
  assert.equal(chosen.snapToHighway,true);assert.equal(chosen.arrivalAnchors[0].bearing,257);assert.deepEqual(gwangam.source,{...at,name:'광암터널관리동'});
  assert.deepEqual(groups[3].items.map(x=>x.label),['광주IC','안성JC','판교JC'].sort(new Intl.Collator('ko',{numeric:true,sensitivity:'base'}).compare));
  assert.ok(groups.flatMap(g=>g.items).every(x=>x.kind!=='manhole'));
  assert.deepEqual(returnDestination(groups,data).label,'수원신갈영업소');
  assert.equal(groups.flatMap(g=>g.items).some(x=>x.label==='수원신갈영업소'),false);
  assert.equal(returnDestination(groups),undefined);
});

test('only registered Suwon–Songpa and Songpa–Suwon saved trips are offered',()=>{
  const g=navigationCatalog(),songpa=g[0].items[0],singal=g[0].items[1];
  const from={gateName:'수원신갈톨게이트'};
  assert.equal(savedDestinationRoute(from,songpa).waypoints.length,3);
  assert.throws(()=>savedDestinationRoute({gateName:'동서울톨게이트'},songpa),/저장된/);
  assert.throws(()=>savedDestinationRoute(from,singal),/저장된/);
  const site={name:'수원신갈영업소',lat:37.26694,lng:127.10244};
  const target=returnDestination(navigationCatalog({offices:[site]}),{offices:[site]});
  const returning=savedDestinationRoute({originId:'junction:songpa',officeName:'송파IC'},target,{offices:[site]});
  assert.equal(returning.waypoints.length,5);assert.deepEqual(returning.goal,site);
  assert.throws(()=>savedDestinationRoute({originId:'office:동서울영업소'},target,{offices:[site]}),/송파IC/);
  const p=destinationPoint(singal);assert.equal(p.roadHint,'경부고속도로');assert.equal(p.snapToHighway,true);
  assert.ok(distance(graph.nodes.get(436210017),SINGAL_JC)<.01);
});

test('Songpa saved entry goal is unchanged while highway uses directed exit destinations',()=>{
  const gis={name:'송파IC',lat:'37.474512',lng:'127.127882'};
  const office={...TOLL_GATES.find(g=>g.id===1814821448),name:'수원신갈영업소'};
  const data={offices:[office],interchanges:[gis]},item=navigationCatalog(data)[0].items[0];
  const start=savedOfficeDeparture(office,[],TOLL_GATES),goal=destinationPoint(item,data);
  assert.equal(goal.snapToHighway,true);assert.equal(goal.hasGateTopology,true);assert.equal(goal.arrivalAnchors.length,2);
  assert.equal(item.source.lat,37.4743032763);assert.equal(item.source.lng,127.1294794184);
  const exact={lat:37.4743032763,lng:127.1294794184};assert.notDeepEqual(exact,{lat:Number(gis.lat),lng:Number(gis.lng)});
  const saved=savedDestinationRoute(start,item,data);
  assert.equal(saved.goal.lat,exact.lat);assert.equal(saved.goal.lng,exact.lng);
  assert.equal(saved.waypoints.length,3);assert.equal(saved.waypoints[2].lng,127.1218);
  const {choices}=availableOriginOptions(graph,start,goal);assert.ok(choices.length);
  for(const {result:r} of choices){
    assert.ok(goal.arrivalAnchors.some(a=>a.destination.lat===r.goal.lat&&a.destination.lng===r.goal.lng));
    assert.equal(new URL(navigationURL(r,'https://example.com/')).searchParams.get('dlat'),String(r.goal.lat));
    assert.equal(new URL(kakaoNavigationURL(r)).searchParams.get('ep'),`${r.goal.lat},${r.goal.lng}`);
  }
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
      if(r.goal.providerPlace){
        assert.equal(r.goal.providerPlace.name,'동서울영업소');
        assert.ok(navigationURL(r,'https://example.com/').includes('search/'));
        assert.ok(kakaoNavigationURL(r).includes('link/search/'));
        assert.ok(r.waypoints.length<=5);checked++;continue;
      }
      const n=new URL(navigationURL(r,'https://example.com/')).searchParams,k=new URL(kakaoNavigationURL(r)).searchParams;
      assert.equal(k.get('sp'),`${n.get('slat')},${n.get('slng')}`);assert.equal(k.get('ep'),`${n.get('dlat')},${n.get('dlng')}`);
      if(r.arrivalAtToll){
        if(goal.userArrivalOverride)assert.deepEqual({lat:r.goal.lat,lng:r.goal.lng},goal.userArrivalOverride);
        else assert.ok(distance(r.goal,TOLL_GATES.find(g=>g.id===r.arrivalGateId))<80);
      }
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
