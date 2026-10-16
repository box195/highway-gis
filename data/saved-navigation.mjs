// Direction-specific public-road control points supplied for this saved route.
// Keep these coordinates exact: motorway snapping changes the intended path.
import {validPoint} from './highway-routing.mjs?v=20261016-songpa-saved';

export const SAVED_HUBS=[
  {id:'suwon',name:'수원신갈영업소'},
  {id:'songpa',name:'송파IC'}
];
const north=[
  {code:'8Q9994H2+4QX',lat:37.3778625,lng:127.101984375},
  {code:'8Q99F449+GQ5',lat:37.4562625,lng:127.119484375},
  {code:'8Q99F48C+VM8',lat:37.4671625,lng:127.121703125}
];
const south=[
  {code:'8Q99F48C+VM7',lat:37.4671625,lng:127.121671875},
  {code:'8Q99F449+GQM',lat:37.4563375,lng:127.119421875},
  {code:'8Q9994H2+5Q2',lat:37.3778875,lng:127.101890625}
];
function endpoint(id,side,offices){
  if(id==='suwon'){
    const office=offices.find(o=>/수원.*신갈|수원영업소/.test(o.name||'')&&validPoint({lat:Number(o.lat),lng:Number(o.lng)}));
    // Runtime office coordinates stay in the user's dataset. Public Suwon
    // toll booth is the fallback; passage there is explicitly permitted.
    return office?{name:office.name,lat:Number(office.lat),lng:Number(office.lng)}:{name:'수원신갈영업소',lat:37.2656246,lng:127.1027408};
  }
  if(id==='songpa'){
    // OSM Songpa motorway junctions 734968944 (SW) / 734968654 (NE).
    // Use the matching carriageway for departure and arrival, not one pin
    // reused on the opposite side. These are IC connections, not buildings.
    return side==='start'?{name:'송파IC',lat:37.477775,lng:127.132918}:{name:'송파IC',lat:37.4734934,lng:127.1270895};
  }
  throw new Error('저장 경로의 출발지와 목적지를 선택해주세요.');
}
export function savedRoute(startId,goalId,offices=[]){
  if(startId===goalId)throw new Error('출발지와 목적지를 다르게 선택해주세요.');
  const controls=startId==='suwon'&&goalId==='songpa'?north:startId==='songpa'&&goalId==='suwon'?south:null;
  if(!controls)throw new Error('아직 저장되지 않은 구간입니다.');
  const start=endpoint(startId,'start',offices),goal=endpoint(goalId,'goal',offices);
  const waypoints=controls.map((p,i)=>({...p,name:`${i+1}. 저장 경유지`}));
  return {kind:'saved',start,goal,waypoints,points:[start,...waypoints,goal]};
}
