// Quick-navigation source choices are distinct from arrival-only anchors.
import {navigationCatalog,uncertainCoordinate} from './navigation-catalog.mjs?v=20261110-strict2';
import {SONGPA_RETURN_START} from './saved-navigation.mjs?v=20261019-saved-return-4';
import {savedOfficeDeparture,roadFrom,supportsHighwayOffice} from './highway-endpoints.mjs?v=20261019-saved-return-4';
import {validPoint} from './highway-routing.mjs?v=20261019-s3-dscoord-ga4';
import {TOLL_GATES} from './highway-tollgates.mjs';

export const ORIGIN_PREFERENCE_KEY='highway-navigation-origin-v1';
const keyOf=s=>(s||'').replace(/한국도로공사|\s|\([^)]*\)/g,'');
const hasPoint=p=>validPoint({lat:Number(p?.lat),lng:Number(p?.lng)});
export function quickOriginChoices(data={}){
  const seen=new Set(),choices=[];
  for(const p of data.offices||[]){
    if(!hasPoint(p)||uncertainCoordinate(p)||!supportsHighwayOffice(p))continue;
    const id=`office:${keyOf(p.name)}`;
    if(!keyOf(p.name)||seen.has(id))continue;
    seen.add(id);
    choices.push({id,label:keyOf(p.name),kind:'office',group:'saved-hubs',source:p});
  }
  const groups=navigationCatalog(data);
  for(const item of groups.filter(g=>g.key==='junctions'||g.key==='other-junctions').flatMap(g=>g.items)){
    if(!hasPoint(item.source)||uncertainCoordinate(item.source)||seen.has(item.id))continue;
    seen.add(item.id);choices.push({...item,source:item.id==='junction:songpa'?{...item.source,...SONGPA_RETURN_START,roadHint:'수도권제1순환고속도로'}:item.source,group:'junctions'});
  }
  return choices;
}
export function getOriginPreference(choices,storage){
  let id='';
  try{id=storage?.getItem(ORIGIN_PREFERENCE_KEY)||'';}catch{return '';}
  if(!id)return '';
  if(choices.some(i=>i.id===id))return id;
  // Data packs may arrive after page construction: do not erase preference yet.
  if(choices.length)try{storage?.removeItem(ORIGIN_PREFERENCE_KEY);}catch{}
  return '';
}
export function setOriginPreference(id,storage){
  try{if(id)storage?.setItem(ORIGIN_PREFERENCE_KEY,id);else storage?.removeItem(ORIGIN_PREFERENCE_KEY);}catch{}
}
export function manualOriginDeparture(item,data={},gates=TOLL_GATES){
  if(!item||!['office','junction'].includes(item.kind)||!hasPoint(item.source)||uncertainCoordinate(item.source))throw new Error('저장된 출발 거점의 좌표가 미확인·추정 또는 오류로 표시되어 안내를 보류합니다.');
  if(item.kind==='office')return {...savedOfficeDeparture(item.source,data.interchanges||[],gates),
    originId:item.id,departureMode:'manual-office'};
  const p=item.source;
  // Never use destinationPoint/arrivalAnchors for departure. The routing graph
  // determines available OUTGOING mainline directions from this saved junction.
  return {lat:Number(p.lat),lng:Number(p.lng),name:item.label,officeName:item.label,
    roadHint:p.roadHint||roadFrom(`${p.section||''} ${p.route_name||''} ${p.route||''}`),
    snapToHighway:item.id!=='junction:songpa',heading:null,speed:0,accuracy:null,
    originId:item.id,departureMode:'manual-junction'};
}
export function gpsCurrentDeparture(sample){
  if(!hasPoint(sample)||!Number.isFinite(sample?.accuracy)||sample.accuracy<0||sample.accuracy>150)
    throw new Error('현재 GPS 좌표가 없거나 정확도가 150m를 초과합니다. 위치 권한과 휴대폰의 정확한 위치 설정을 확인해 주세요.');
  // Keep the device's exact coordinates. Graph snapping is internal only.
  return {lat:Number(sample.lat),lng:Number(sample.lng),name:'현재 위치',officeName:'현재 위치',
    departureMode:'gps-current',snapToHighway:false,accuracy:sample.accuracy,
    speed:Number.isFinite(sample.speed)?sample.speed:null,
    heading:Number.isFinite(sample.heading)&&sample.speed>2?sample.heading:null};
}

export async function resolveQuickOrigin(id,choices,data,gpsDeparture){
  const item=id&&choices.find(i=>i.id===id);
  return item?manualOriginDeparture(item,data):gpsDeparture();
}
