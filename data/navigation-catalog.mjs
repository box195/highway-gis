import {validPoint} from './highway-routing.mjs?v=20261019-poi-pangyo';
import {officeEndpoint,roadFrom} from './highway-endpoints.mjs?v=20261019-poi-pangyo';
import {TOLL_GATES} from './highway-tollgates.mjs';
import {savedRoute,SONGPA_IC} from './saved-navigation.mjs?v=20261019-songpa-return';
import {SONGPA_EXIT_ACCESS} from './songpa-exit-access.mjs?v=20261019-songpa-return';

const order=new Intl.Collator('ko',{numeric:true,sensitivity:'base'});
const keyOf=s=>(s||'').replace(/한국도로공사|\s|\([^)]*\)/g,'');
const located=p=>validPoint({lat:Number(p.lat),lng:Number(p.lng)});
// Public OSM motorway_junction 436210017, Shin-gal JC northbound merge.
// Public snapshot: Geofabrik South Korea 2026-10-14, ODbL-1.0.
export const SINGAL_JC={name:'신갈JC',lat:37.295386,lng:127.103562,roadHint:'경부고속도로'};

export function navigationCatalog(data={}){
  const unique=new Map();
  for(const p of data.offices||[])if(located(p)&&!unique.has(keyOf(p.name)))unique.set(keyOf(p.name),p);
  const offices=[...unique.values()];
  const office=p=>({id:`office:${keyOf(p.name)}`,label:keyOf(p.name),kind:'office',source:p});
  const branches=['경기광주지사','동서울지사'].flatMap(name=>{const p=offices.find(p=>keyOf(p.name)===name);return p?[office(p)]:[];});
  const songpa=(data.interchanges||[]).find(p=>/송파IC/i.test(p.name||'')&&located(p));
  const songpaPoint={...(songpa||{}),...SONGPA_IC};
  const junctions=[{id:'junction:songpa',label:'송파IC',kind:'junction',source:{...songpaPoint,roadHint:'수도권제1순환고속도로'}},
    {id:'junction:singal',label:'신갈JC',kind:'junction',source:SINGAL_JC}];
  const group=(key,label,items)=>({key,label,items});
  // Only the destination list is changed: original GIS/manhole records remain untouched.
  const seen=new Set(junctions.map(i=>i.label.replace(/\s/g,'').toUpperCase()));
  const remaining=(data.interchanges||[]).filter(p=>located(p)&&/(?:IC|JC|JCT)\s*$/i.test(p.name||''))
    .map(p=>({id:`junction:gis:${keyOf(p.name)}`,label:keyOf(p.name),kind:'junction',source:p}))
    .filter(i=>{const key=i.label.replace(/\s/g,'').toUpperCase().replace(/JCT$/,'JC');
      if(seen.has(key))return false;seen.add(key);return true;})
    .sort((a,b)=>order.compare(a.label,b.label));
  return [group('junctions','IC · JC',junctions),group('branches','지사',branches),
    group('offices','영업소',offices.filter(p=>/영업소|광암터널.*관리|광암관리/.test(p.name||'')&&!/수원신갈/.test(p.name||''))
      .map(office).sort((a,b)=>order.compare(a.label,b.label))),
    group('other-junctions','그 밖의 IC · JC',remaining)];
}

export function destinationPoint(item,data={}){
  if(item.kind==='office')return officeEndpoint(item.source,data.interchanges||[],TOLL_GATES,item.label);
  if(item.id==='junction:songpa')return {name:SONGPA_IC.name,lat:SONGPA_EXIT_ACCESS[0].lat,lng:SONGPA_EXIT_ACCESS[0].lng,
    roadHint:SONGPA_EXIT_ACCESS[0].road,snapToHighway:true,hasGateTopology:true,arrivalAnchors:SONGPA_EXIT_ACCESS};
  const p=item.source;
  return {lat:Number(p.lat),lng:Number(p.lng),name:item.label,
    roadHint:p.roadHint||roadFrom(`${p.section||''} ${p.route_name||''} ${p.route||''}`),snapToHighway:item.kind==='junction'&&item.id!=='junction:songpa'};
}

export function savedDestinationRoute(start,item,data={}){
  if(start.originId==='junction:songpa'&&item.kind==='office'&&/수원신갈|수원영업소/.test(item.source?.name||''))
    return savedRoute('songpa','suwon',data.offices||[],data.interchanges||[]);
  if(start.gateName==='수원신갈톨게이트'&&item.id==='junction:songpa')
    return savedRoute('suwon','songpa',data.offices||[],data.interchanges||[]);
  throw new Error('이 출발지에서 수원영업소까지 저장된 복귀 경로가 아직 없습니다. 송파IC를 출발지로 선택해주세요.');
}

export function returnDestination(groups,data={}){
  const selected=(data.offices||[]).find(p=>located(p)&&/수원.*신갈|수원영업소/.test(p.name||''));
  return selected?{id:`office:${keyOf(selected.name)}`,label:keyOf(selected.name),kind:'office',source:selected}:undefined;
}
