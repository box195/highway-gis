// Direction-specific public-road control points supplied for this saved route.
// Keep these coordinates exact: motorway snapping changes the intended path.
import {validPoint} from './highway-routing.mjs?v=20261018-gis-destinations';

export const SAVED_HUBS=[
  {id:'suwon',name:'수원신갈영업소'},
  {id:'songpa',name:'송파IC'}
];
const north=[
  {code:'8Q9994H2+4QX',lat:37.3778625,lng:127.101984375},
  {code:'8Q99F449+GQ5',lat:37.4562625,lng:127.119484375},
  // East of the Heolleung-ro 758-gil centreline, for the northbound lane.
  // Moved ~5.8m east from the original 8Q99F48C+VM9 at the user's request.
  {code:'8Q99F48C+VP7',lat:37.4671625,lng:127.1218}
];
export const SONGPA_IC={name:'송파IC',lat:37.47451,lng:127.12788};
function endpoint(id,offices,interchanges){
  if(id==='suwon'){
    const office=offices.find(o=>/수원.*신갈|수원영업소/.test(o.name||'')&&validPoint({lat:Number(o.lat),lng:Number(o.lng)}));
    // Runtime office coordinates stay in the user's dataset. Public Suwon
    // toll booth is the fallback; passage there is explicitly permitted.
    return office?{name:office.name,lat:Number(office.lat),lng:Number(office.lng)}:{name:'수원신갈영업소',lat:37.2656246,lng:127.1027408};
  }
  if(id==='songpa'){
    const ic=interchanges.find(p=>/송파\s*IC/i.test(p.name||'')&&validPoint({lat:Number(p.lat),lng:Number(p.lng)}));
    return ic?{name:'송파IC',lat:Number(ic.lat),lng:Number(ic.lng)}:{...SONGPA_IC};
  }
  throw new Error('저장 경로의 출발지와 목적지를 선택해주세요.');
}
export function savedRoute(startId,goalId,offices=[],interchanges=[]){
  if(startId===goalId)throw new Error('출발지와 목적지를 다르게 선택해주세요.');
  const controls=startId==='suwon'&&goalId==='songpa'?north:null;
  if(!controls)throw new Error('아직 저장되지 않은 구간입니다.');
  const start=endpoint(startId,offices,interchanges),goal=endpoint(goalId,offices,interchanges);
  const waypoints=controls.map((p,i)=>({...p,name:`${i+1}. 저장 경유지`}));
  return {kind:'saved',start,goal,waypoints,points:[start,...waypoints,goal]};
}
