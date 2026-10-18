// Persistent, bounded quick-navigation choices. No GPS samples or GIS records.
import {ROUTE_DATA_REVISION} from './route-cache-revision.mjs?v=20261019-poi-pangyo';
export const CACHE_KEY='highway-quick-choices-v1';
export const CACHE_TTL_MS=7*86400000;
export const CACHE_MAX=32;
const LIMIT=180000;
const point=p=>p&&typeof p==='object'&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&p.lat>=31.43&&p.lat<=44.35&&p.lng>=122.37&&p.lng<=132;
const hash=value=>{
  let h=0xcbf29ce484222325n;
  for(const b of new TextEncoder().encode(JSON.stringify(value))){h^=BigInt(b);h=(h*0x100000001b3n)&0xffffffffffffffffn;}
  return h.toString(16).padStart(16,'0');
};
export function routeCacheKey(start,item,mode,destination){
  if(!['highway','saved'].includes(mode)||!start?.officeName||!item?.id||!destination)return null;
  // Hash all source/destination topology selectors. Never persist raw GIS or GPS.
  return hash([ROUTE_DATA_REVISION,mode,item.id,start.originId||null,start.departureMode||null,start.officeName,start.gateName,
    start.lat,start.lng,start.roadHint,item.source?.lat,item.source?.lng,
    destination.lat,destination.lng,destination.original?.lat,destination.original?.lng,
    destination.officeDestination?.lat,destination.officeDestination?.lng,
    destination.gateName,destination.roadHint,destination.stopBeforeToll,destination.providerPlace?.name,destination.providerPlace?.placeId,destination.providerPlace?.verification,destination.gwangamPangyoOnly,
    destination.userArrivalOverride?.lat,destination.userArrivalOverride?.lng,
    destination.arrivalAnchors?.map(a=>[a.edgeKey,a.kind,a.bearing,a.lat,a.lng,a.destination?.lat,a.destination?.lng])]);
}
const cleanPoint=p=>point(p)?{lat:p.lat,lng:p.lng,name:typeof p.name==='string'?p.name.slice(0,90):'',
  ...(p.providerPlace?.provider==='kakao'&&p.providerPlace.name==='동서울영업소'?{providerPlace:{provider:'kakao',name:'동서울영업소',
    placeId:/^\d+$/.test(p.providerPlace.placeId||'')?p.providerPlace.placeId:null,
    verification:p.providerPlace.verification==='verified'?'verified':'search-selection-required'}}:{})}:null;
const cleanResult=r=>{
  if(!r||!Array.isArray(r.waypoints)||r.waypoints.length>5||!Array.isArray(r.roads)||r.roads.length>8)return null;
  const start=cleanPoint(r.start),goal=cleanPoint(r.goal),waypoints=r.waypoints.map(cleanPoint);
  if(!start||!goal||waypoints.some(p=>!p)||r.roads.some(v=>typeof v!=='string'||v.length>80))return null;
  return {start,goal,waypoints,roads:r.roads,arrivalDirection:typeof r.arrivalDirection==='string'?r.arrivalDirection.slice(0,150):null,
    arrivalBearing:Number.isFinite(r.arrivalBearing)?r.arrivalBearing:null};
};
const cleanChoices=choices=>{
  if(!Array.isArray(choices)||!choices.length||choices.length>10)return null;
  const result=choices.map(c=>{
    if(typeof c.label!=='string'||c.label.length>180||typeof c.key!=='string'||c.key.length>120)return null;
    const route=cleanResult(c.result);
    return route?{key:c.key,label:c.label,result:route}:null;
  });
  return result.some(x=>!x)?null:result;
};
export function routeCache(storage,now=Date.now()){
  if(storage===undefined)try{storage=globalThis.localStorage;}catch{storage=null;}
  const load=()=>{
    try{
      const raw=storage?.getItem(CACHE_KEY);
      if(!raw)return [];
      if(raw.length>LIMIT)throw Error('oversized');
      const doc=JSON.parse(raw);
      if(doc?.revision!==ROUTE_DATA_REVISION||doc.version!==1||!Array.isArray(doc.entries)||doc.entries.length>CACHE_MAX)throw Error('revision');
      return doc.entries.filter(e=>typeof e.key==='string'&&/^[a-f0-9]{16}$/.test(e.key)&&
        Number.isFinite(e.at)&&e.at<=now&&now-e.at<CACHE_TTL_MS&&cleanChoices(e.choices));
    }catch{try{storage?.removeItem(CACHE_KEY);}catch{}return [];}
  };
  const save=entries=>{try{
    const raw=JSON.stringify({version:1,revision:ROUTE_DATA_REVISION,entries:entries.slice(0,CACHE_MAX)});
    if(raw.length<=LIMIT)storage?.setItem(CACHE_KEY,raw);
  }catch{/* Private browsing, quota or disabled storage: compute normally. */}};
  return {
    get(key){if(!key)return null;const match=load().find(e=>e.key===key);return match?cleanChoices(match.choices):null;},
    set(key,choices){if(!key)return;const safe=cleanChoices(choices);if(!safe)return;
      save([{key,at:now,choices:safe},...load().filter(e=>e.key!==key)].slice(0,CACHE_MAX));}
  };
}
export async function resolveQuickChoices({start,item,mode,destination,cache=routeCache(),loadGraph,availableOriginOptions,savedDestinationRoute,data}){
  const key=routeCacheKey(start,item,mode,destination),hit=cache.get(key);
  if(hit)return {choices:hit,fromCache:true};
  let choices;
  if(mode==='saved')choices=[{key:'saved',label:`${start.officeName} → ${item.label} · 저장 경로`,
    result:savedDestinationRoute(start,item,data)}];
  else{
    const graph=await loadGraph();
    const found=availableOriginOptions(graph,start,destination);
    choices=found.choices;
    if(!choices.length)throw new Error(found.rejected[0]?.error||'해당 구간에서 사용할 수 있는 고속도로 경로가 없습니다.');
  }
  cache.set(key,choices);
  return {choices,fromCache:false};
}
