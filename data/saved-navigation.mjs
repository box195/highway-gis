// Direction-specific public-road control points supplied for this saved route.
// Keep these coordinates exact: motorway snapping changes the intended path.
import {validPoint} from './highway-routing.mjs?v=20261019-poi-pangyo';

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
// Return follows the existing saved local-road corridor, not Ring 1/Gyeongbu.
// First return guide uses exact user-specified Daewang bridge OLC cell center.
// Guides 2-3 use previously validated public-road geometry, without new offsets.
// Tancheon has 4 mapped lanes, Daewangpangyo has 8.
// Shinsu-ro has independently mapped ONE-WAY southbound carriageways.
const south=[
  {code:'8Q99F48C+QWM',lat:37.4669625,lng:127.122296875}, // user-provided Daewang bridge; exact full OLC center
  {code:'OSM:186410728:south',lat:37.456263302,lng:127.1193993}, // 탄천로
  {code:'OSM:473590580:south',lat:37.377869162,lng:127.1018525}, // 대왕판교로
  {code:'OSM:277611773:south',lat:37.34,lng:127.102675866},   // 신수로 oneway=yes
  {code:'OSM:624073974:south',lat:37.3,lng:127.101818703}     // 신수로 oneway=yes
];
// Return departure remains directed Songpa IC EXIT motorway_link 908687235.
// Parcel '서울 송파구 장지동 354-3' not verifiable in one lookup; exact motorway departure remains unresolved.
// Never modify separate saved ENTRY destination.
export const SONGPA_RETURN_START={name:'송파IC · 진출 연결로',lat:37.47311468100521,lng:127.12669970838598};
// Navigation-only: Kakao WCONGNAMUL 528633,1104150 (EPSG:5181 at 1/2.5 scale).
export const SONGPA_IC={name:'송파IC',lat:37.4743032763,lng:127.1294794184};
function endpoint(id,offices,interchanges){
  if(id==='suwon'){
    const office=offices.find(o=>/수원.*신갈|수원영업소/.test(o.name||'')&&validPoint({lat:Number(o.lat),lng:Number(o.lng)}));
    // Runtime office coordinates stay in the user's dataset. Public Suwon
    // toll booth is the fallback; passage there is explicitly permitted.
    return office?{name:office.name,lat:Number(office.lat),lng:Number(office.lng)}:{name:'수원신갈영업소',lat:37.2656246,lng:127.1027408};
  }
  if(id==='songpa'){
    return {...SONGPA_IC};
  }
  throw new Error('저장 경로의 출발지와 목적지를 선택해주세요.');
}
export function savedRoute(startId,goalId,offices=[],interchanges=[]){
  if(startId===goalId)throw new Error('출발지와 목적지를 다르게 선택해주세요.');
  const controls=startId==='suwon'&&goalId==='songpa'?north:startId==='songpa'&&goalId==='suwon'?south:null;
  if(!controls)throw new Error('아직 저장되지 않은 구간입니다.');
  const start=startId==='songpa'?{...SONGPA_RETURN_START}:endpoint(startId,offices,interchanges),goal=endpoint(goalId,offices,interchanges);
  const waypoints=controls.map((p,i)=>({...p,name:`${i+1}. 저장 경유지`}));
  return {kind:'saved',start,goal,waypoints,points:[start,...waypoints,goal],
    roads:startId==='songpa'?['송파대로','헌릉로','헌릉로758길','탄천로','여수대로','대왕판교로','신수로']:[]};
}
