// Directed motorway plus immutable user-saved Songpa->Suwon return.
import {availableOriginOptions,distance} from './highway-routing.mjs?v=20261019-s3-dscoord-ga4';
import {destinationPoint} from './navigation-catalog.mjs?v=20261019-saved-return-3';
import {SONGPA_EXIT_ACCESS} from './songpa-exit-access.mjs?v=20261019-s3-dscoord-ga4';
import {savedRoute,RETURN_SURFACE_SNAPSHOT} from './saved-navigation.mjs?v=20261019-saved-return-3';

export const HYBRID_RETURN_HUBS=['구리남양주영업소','토평영업소','하남영업소','동서울지사','서울경기본부','광암터널관리동'];
const cleanName=s=>(s||'').replace(/한국도로공사|\s|\([^)]*\)/g,'');
const DIRECT_RETURN_HUBS=['성남영업소','서울영업소','청계영업소','동서울영업소','경기광주영업소','곤지암영업소','서이천영업소'];
const returnRequest=(start,item)=>item?.kind==='office'&&/수원.*신갈|수원영업소/.test(item.source?.name||'')&&
  ['manual-office','nearest-office'].includes(start?.departureMode);
export function isDirectSavedReturn(start,item){
  return returnRequest(start,item)&&DIRECT_RETURN_HUBS.includes(cleanName(start.officeName));
}
// Exact eleven-character Plus Code cell centre; no coordinate guessing or snapping.
export const CHEONGGYE_FIRST={code:'8Q9994H2+GVJ',lat:37.3788375,lng:127.102140625};
// Exact full Plus Code cell centers, saved-return departures ONLY; never arrivals, GIS or outbound.
export const USER_SAVED_RETURN_DEPARTURES={
  '동서울영업소':{plusCode:'8Q99G68C+4FH',lat:37.5153125,lng:127.221234375},
  '경기광주영업소':{plusCode:'8Q99C7W8+HQ3',lat:37.4463875,lng:127.266921875},
  '곤지암영업소':{plusCode:'8Q99983C+XG6',lat:37.3549125,lng:127.321265625}
};
export const GWANGJU_FIRST={code:'8Q9996WJ+69C',lat:37.3955625,lng:127.230890625};
export const SEOICHEON_ONLY={code:'8Q9974C4+5WH',lat:37.2704375,lng:127.107359375};
export function directSavedReturn(start,item,data={}){
  if(!isDirectSavedReturn(start,item))throw new Error('이 거점의 저장 복귀 경로는 등록되지 않았습니다.');
  const saved=savedRoute('songpa','suwon',data.offices||[],data.interchanges||[]);
  const office=cleanName(start.officeName);
  // Index ORIGINAL saved sequence, never a shortened result.
  const original=RETURN_SURFACE_SNAPSHOT;
  const controls=office==='성남영업소'?original:
    office==='서울영업소'?[original.at(-1)]:
    office==='청계영업소'?[CHEONGGYE_FIRST,original.at(-1)]:
    office==='동서울영업소'?[original[0],original.at(-1)]: // existing Songpa saved return
    office==='경기광주영업소'||office==='곤지암영업소'?
      [GWANGJU_FIRST,CHEONGGYE_FIRST,original.at(-1)]:
    [SEOICHEON_ONLY]; // 서이천 only, no other guides
  const routeStart=USER_SAVED_RETURN_DEPARTURES[office]?
    {...start,...USER_SAVED_RETURN_DEPARTURES[office]}:{...start};
  const waypoints=controls.map((p,i)=>({...p,name:(i+1)+'. 저장 경유지'}));
  return {choices:[{key:'direct-saved:'+office,label:office+' → 수원영 · 지정 저장경로',
    result:{kind:'saved',start:routeStart,goal:saved.goal,waypoints,
      points:[routeStart,...waypoints,saved.goal],roads:[...saved.roads],
      arrivalDirection:'사용자 지정 저장 경유지 복귀',sourceOffice:start.officeName,
      routeVerification:'user-specified-waypoints-provider-not-verified'}}],rejected:[]};
}

export function isHybridSavedReturn(start,item){
  return returnRequest(start,item)&&HYBRID_RETURN_HUBS.includes(cleanName(start.officeName));
}
export function hybridSavedReturn(graph,start,item,data={}){
  if(!isHybridSavedReturn(start,item))throw new Error('이 거점은 송파IC 경유 저장 복귀가 등록되지 않았습니다.');
  const songpa=destinationPoint({id:'junction:songpa',kind:'junction'},data);
  const found=availableOriginOptions(graph,start,songpa);
  const saved=savedRoute('songpa','suwon',data.offices||[],data.interchanges||[]);
  const choices=[],rejected=[...found.rejected];
  for(const option of found.choices){
    const highway=option.result;
    const exit=SONGPA_EXIT_ACCESS.find(a=>distance(a.destination,highway.goal)<2);
    // More than two distinct motorway runs would erase required transitions.
    // An entire motorway loop is not an acceptable replacement for an exit.
    if(!exit||highway.roads.at(-1)!=='수도권제1순환고속도로'||
      highway.roads.length>2||highway.length>Math.max(35000,3*distance(start,highway.goal))||
      !highway.waypoints.length||highway.waypoints.length!==highway.roads.length||
      !highway.waypoints[0].name.includes(highway.roads[0])){
      rejected.push({key:option.key,error:'필수 고속도로 분기/송파IC 진출을 경유지 2개 안에 보존할 수 없는 우회 방향입니다.'});
      continue;
    }
    // Remove ORIGINAL #2 (Songpa EXIT); retain #1 and all ORIGINAL #3/#4/#5.
    // Directed EXIT remains checked and recorded in route metadata.
    const vias=[
      {...highway.waypoints[0],name:'1. '+highway.roads[0]+' · 연결 방향'},
      ...RETURN_SURFACE_SNAPSHOT.map((p,i)=>({...p,name:(i+2)+'. 저장 경유지'}))
    ];
    if(vias.length!==4)throw new Error('송파IC 복귀의 경유지는 정확히 4개여야 합니다.');
    choices.push({key:'hybrid:'+option.key+':'+exit.approach,
      label:option.label+' → 송파IC '+(exit.approach==='southbound'?'남행':'북행')+' 진출 → 저장경로',
      result:{kind:'hybrid-saved-return',start:highway.start,goal:saved.goal,
        waypoints:vias,points:[...highway.points,...RETURN_SURFACE_SNAPSHOT,saved.goal],
        roads:[...highway.roads,'송파IC 진출로',...saved.roads],
        arrivalDirection:'송파IC '+(exit.approach==='southbound'?'남행':'북행')+' 진출 → 저장경로 복귀',
        songpaExitApproach:exit.approach,sourceOffice:start.officeName,
        routeVerification:'directed-public-osm-plus-user-saved-guides'}});
  }
  if(!choices.length)throw new Error('해당 거점에서 송파IC 진출 후 저장경로에 합류할 수 있는 검증된 방향이 없습니다.');
  return {choices,rejected};
}
