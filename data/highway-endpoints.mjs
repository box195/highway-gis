import {distance,validPoint,nearestHighwayPoint} from './highway-routing.mjs?v=20261016-fewer-waypoints';
import {TOLL_ACCESS} from './highway-toll-access.mjs?v=20261016-fewer-waypoints';

// Gate identity and motorway are explicit: the nearest parallel motorway can
// belong to a different route (notably Jungbu vs Second Jungbu).
export const GATE_PROFILES=[
  {match:/수원신갈|수원영업소/,gate:'수원신갈톨게이트',road:'경부고속도로',aliases:['수원신갈','수원']},
  {match:/청계영업소/,gate:'청계톨게이트',road:'수도권제1순환고속도로',aliases:['청계','의왕청계']},
  {match:/성남영업소/,gate:'성남톨게이트',road:'수도권제1순환고속도로',aliases:['성남']},
  {match:/구리남양주영업소/,gate:'구리남양주톨게이트',road:'수도권제1순환고속도로',aliases:['구리남양주']},
  {match:/토평영업소/,gate:'토평톨게이트',road:'수도권제1순환고속도로',aliases:['토평']},
  {match:/동서울영업소/,gate:'동서울톨게이트',road:'중부고속도로',aliases:['동서울']},
  {match:/하남영업소/,gate:'하남톨게이트',road:'중부고속도로',aliases:['하남']},
  {match:/경기광주영업소|^광주영업소/,gate:'경기광주톨게이트',road:'중부고속도로',aliases:['경기광주','광주']},
  {match:/곤지암영업소/,gate:'곤지암톨게이트',road:'중부고속도로',aliases:['곤지암']},
  {match:/서이천영업소/,gate:'서이천톨게이트',road:'중부고속도로',aliases:['서이천']}
];
const clean=s=>(s||'').replace(/\s/g,'').replace(/(톨게이트|요금소|영업소|TG|IC|JCT|JC)$/i,'');
export function roadFrom(text){
  if(/제\s*2\s*중부/.test(text))return '제2중부고속도로';
  if(/중부/.test(text))return '중부고속도로';
  if(/제\s*1\s*순환|청계|성남TG|구리남양주|토평|광암터널/.test(text))return '수도권제1순환고속도로';
  if(/경부|서울TG|수원신갈/.test(text))return '경부고속도로';
  if(/영동/.test(text))return '영동고속도로';
}
export function officeEndpoint(item,interchanges=[],gates=[],label){
  const original={lat:Number(item.lat),lng:Number(item.lng)};
  const profile=GATE_PROFILES.find(p=>p.match.test(item.name||''));
  const roadHint=profile?.road||roadFrom(`${item.name||''} ${item.section||''}`);
  const matches=p=>profile && profile.aliases.includes(clean(p.name)) && validPoint(p) && distance(original,p)<15000;
  // A named public toll booth takes precedence over an approximate IC marker.
  const publicGates=gates.filter(p=>matches(p)||(profile&&p.unnamed&&distance(original,p)<250)).sort((a,b)=>distance(original,a)-distance(original,b));
  const savedGates=interchanges.map(p=>({...p,lat:Number(p.lat),lng:Number(p.lng)})).filter(matches).sort((a,b)=>Number(/TG|톨게이트|요금소/i.test(b.name))-Number(/TG|톨게이트|요금소/i.test(a.name))||distance(original,a)-distance(original,b));
  const anchor=publicGates[0]||savedGates[0]||original;
  const reference=profile?.gate||`${item.name||'거점'} 인근`;
  const arrivalAnchors=publicGates.flatMap(g=>(TOLL_ACCESS[g.id]||[]).filter(a=>!roadHint||a.road===roadHint).map(a=>({...a,gateId:g.id})));
  return {...original,lat:anchor.lat,lng:anchor.lng,name:`${label||item.name} → ${reference} 본선 접속점`,gateName:profile?.gate,roadHint,snapToHighway:true,original,endpointKind:'office',arrivalAnchors,hasGateTopology:publicGates.length>0};
}
export function departureEndpoint(graph,gps,offices=[],interchanges=[],gates=[]){
  // A point already on the carriageway (including roadside manholes) stays put.
  if(nearestHighwayPoint(graph,gps).gap<=45 || gps.speed>5)return gps;
  const nearby=offices.filter(o=>validPoint({lat:Number(o.lat),lng:Number(o.lng)})).map(o=>({o,gap:distance(gps,{lat:Number(o.lat),lng:Number(o.lng)})})).filter(v=>v.gap<=400).sort((a,b)=>a.gap-b.gap)[0];
  if(!nearby)return gps;
  return {...gps,...officeEndpoint(nearby.o,interchanges,gates),heading:null};
}
export function nearestOfficeDeparture(gps,offices=[],interchanges=[],gates=[]){
  if(!validPoint(gps))throw new Error('현재 위치를 확인할 수 없습니다.');
  const nearest=offices.map(o=>({o,p:{lat:Number(o.lat),lng:Number(o.lng)}}))
    .filter(v=>validPoint(v.p)).map(v=>({...v,gap:distance(gps,v.p)})).sort((a,b)=>a.gap-b.gap)[0];
  if(!nearest)throw new Error('좌표가 있는 저장된 거점이 없습니다.');
  return {...officeEndpoint(nearest.o,interchanges,gates),heading:null,speed:0,
    departureMode:'nearest-office',officeName:nearest.o.name,officeDistance:nearest.gap,accuracy:gps.accuracy};
}
