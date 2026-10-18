import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {USER_ARRIVAL_OVERRIDES,officeEndpoint,savedOfficeDeparture} from '../data/highway-endpoints.mjs';
import {TOLL_GATES} from '../data/highway-tollgates.mjs';
import {buildGraph,availableOriginOptions,distance} from '../data/highway-routing.mjs';
import {kakaoNavigationURL} from '../data/kakao-navigation.mjs';
const graph=buildGraph(JSON.parse(fs.readFileSync(new URL('../data/highway-roads.json',import.meta.url),'utf8')));
const alphabet='23456789CFGHJMPQRVWX';
function decodeFullOLCCenter(code){
  assert.match(code,/^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{3}$/);
  const chars=code.replace('+','');
  let lat=-90,lng=-180,stepLat=20,stepLng=20;
  for(let i=0;i<10;i+=2){
    if(i){stepLat/=20;stepLng/=20;}
    lat+=alphabet.indexOf(chars[i])*stepLat;
    lng+=alphabet.indexOf(chars[i+1])*stepLng;
  }
  for(let i=10;i<chars.length;i++){
    stepLat/=5;stepLng/=4;
    const n=alphabet.indexOf(chars[i]);
    lat+=Math.floor(n/4)*stepLat;
    lng+=(n%4)*stepLng;
  }
  return {lat:Number((lat+stepLat/2).toFixed(12)),lng:Number((lng+stepLng/2).toFixed(12))};
}
const cases=[
  {name:'성남영업소',code:'8Q99C4PF+6FG',lat:37.4355625,lng:127.123703125,expectedDirections:[173,351]}
];
test('Seongnam full 11-character OLC cell centre decode precisely (no snap/offset)',()=>{
  for(const item of cases){
    assert.deepEqual(decodeFullOLCCenter(item.code),{lat:item.lat,lng:item.lng});
    const profile=USER_ARRIVAL_OVERRIDES.find(x=>x.match.test(item.name));
    assert.ok(profile);
    assert.equal(profile.plusCode,item.code);
    assert.deepEqual({lat:profile.lat,lng:profile.lng},{lat:item.lat,lng:item.lng});
  }
});
test('both directed Seongnam arrivals pin the exact user-selected centre while retaining highway guide options',()=>{
  for(const item of cases){
    const publicGate=TOLL_GATES.find(x=>x.name.includes(item.name.replace('영업소','')));
    assert.ok(publicGate,item.name);
    const office={name:item.name,lat:publicGate.lat+.0004,lng:publicGate.lng+.0004};
    const goal=officeEndpoint(office,[],TOLL_GATES);
    assert.deepEqual(goal.userArrivalOverride,{lat:item.lat,lng:item.lng});
    assert.ok(goal.arrivalAnchors.length>=2);
    const origins=['수원신갈영업소','구리남양주영업소','경기광주영업소','하남영업소']
      .map(name=>{const gate=TOLL_GATES.find(g=>g.name.startsWith(name.replace('영업소','')));return gate?{name,lat:gate.lat+.0005,lng:gate.lng+.0004}:null}).filter(Boolean);
    const bearings=new Set();
    for(const origin of origins){
      const res=availableOriginOptions(graph,savedOfficeDeparture(origin,[],TOLL_GATES),goal);
      for(const {result:r} of res.choices){
        assert.deepEqual({lat:r.goal.lat,lng:r.goal.lng},{lat:item.lat,lng:item.lng});
        assert.ok(r.waypoints.length<=5);
        assert.equal(new URL(kakaoNavigationURL(r)).searchParams.get('ep'),`${item.lat},${item.lng}`);
        bearings.add(r.arrivalBearing);
      }
    }
    assert.deepEqual([...bearings].sort((a,b)=>a-b),item.expectedDirections);
  }
});
test('user overrides do not change untouched SeoIcheon, Hanam and Gonjiam endpoints',()=>{
  const samples=[
    {name:'서이천영업소',gate:436294773},
    {name:'하남영업소',gate:10705706620},
    {name:'곤지암영업소',gate:436295298}
  ];
  for(const sample of samples){
    const gate=TOLL_GATES.find(g=>g.id===sample.gate);
    const goal=officeEndpoint({...gate,name:sample.name,lat:gate.lat+.0006},[],TOLL_GATES);
    assert.equal(goal.userArrivalOverride,undefined,sample.name);
  }
});

test('Dongseoul overrides removed: directed guides lead to actual GIS office building',()=>{
  assert.equal(USER_ARRIVAL_OVERRIDES.some(x=>x.match.test('동서울영업소')),false);
  const g=TOLL_GATES.find(x=>x.name.includes('동서울'));
  const site={name:'동서울영업소',lat:g.lat+.0004,lng:g.lng+.0004};
  const goal=officeEndpoint(site,[],TOLL_GATES);
  assert.equal(goal.userArrivalOverride,undefined);
  assert.equal(goal.stopBeforeToll,false);
  assert.deepEqual(goal.officeDestination,{lat:site.lat,lng:site.lng});
  assert.ok(goal.arrivalAnchors.length>=2);
  const origin={name:'수원신갈영업소',lat:37.26694,lng:127.10244};
  const result=availableOriginOptions(graph,savedOfficeDeparture(origin,[],TOLL_GATES),goal);
  const directions=new Set();
  for(const {result:r} of result.choices){
    assert.deepEqual({lat:r.goal.lat,lng:r.goal.lng},goal.officeDestination);
    assert.equal(r.arrivalAtOffice,true);
    assert.equal(r.arrivalAtToll,false);
    assert.ok(r.waypoints.length<=5);
    directions.add(r.arrivalBearing);
  }
  assert.deepEqual([...directions].sort((a,b)=>a-b),[156,336]);
});
