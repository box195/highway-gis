// Quick-navigation source choices are distinct from arrival-only anchors.
import {navigationCatalog} from './navigation-catalog.mjs?v=20261019-saved-return-4';
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
    if(!hasPoint(p)||!supportsHighwayOffice(p))continue;
    const id=`office:${keyOf(p.name)}`;
    if(!keyOf(p.name)||seen.has(id))continue;
    seen.add(id);
    choices.push({id,label:keyOf(p.name),kind:'office',group:'saved-hubs',source:p});
  }
  const groups=navigationCatalog(data);
  for(const item of groups.filter(g=>g.key==='junctions'||g.key==='other-junctions').flatMap(g=>g.items)){
    if(!hasPoint(item.source)||seen.has(item.id))continue;
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
  if(!item||!['office','junction'].includes(item.kind)||!hasPoint(item.source))throw new Error('저장된 출발 거점이 올바르지 않습니다.');
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
export async function resolveQuickOrigin(id,choices,data,gpsDeparture){
  const item=id&&choices.find(i=>i.id===id);
  return item?manualOriginDeparture(item,data):gpsDeparture();
}
