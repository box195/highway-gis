import {validPoint} from './highway-routing.mjs?v=20261018-toll-office';
import {officeEndpoint,roadFrom} from './highway-endpoints.mjs?v=20261018-toll-office';
import {TOLL_GATES} from './highway-tollgates.mjs';
import {savedRoute} from './saved-navigation.mjs?v=20261018-toll-office';

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
  const songpaPoint=songpa?{...songpa,lat:Number(songpa.lat),lng:Number(songpa.lng)}:savedRoute('suwon','songpa').goal;
  const junctions=[{id:'junction:songpa',label:'송파IC',kind:'junction',source:{...songpaPoint,roadHint:'수도권제1순환고속도로'}},
    {id:'junction:singal',label:'신갈JC',kind:'junction',source:SINGAL_JC}];
  const group=(key,label,items)=>({key,label,items});
  const manholes={DONGSEOUL:[],GWANGJU:[]},seen=new Set();
  for(const p of data.manholes||[]){
    const branch=p.branch_code||(/동서울/.test(p.branch_name||'')?'DONGSEOUL':/광주/.test(p.branch_name||'')?'GWANGJU':/제\s*2\s*중부|중부/.test(p.section||'')?'GWANGJU':'DONGSEOUL');
    if(!manholes[branch]||!located(p))continue;
    const id=`manhole:${branch}:${p.id||p.name}:${p.lat}:${p.lng}`;
    if(seen.has(id))continue;seen.add(id);
    manholes[branch].push({id,label:p.name||p.id,kind:'manhole',source:p,branch,approximate:['ESTIMATED','SOURCE_ERROR'].includes(p.coordinate_status)});
  }
  for(const items of Object.values(manholes))items.sort((a,b)=>order.compare(a.label,b.label));
  return [group('junctions','IC · JC',junctions),group('branches','지사',branches),
    group('offices','영업소',offices.filter(p=>/영업소/.test(p.name||'')).map(office).sort((a,b)=>order.compare(a.label,b.label))),
    group('dongseoul','동서울지사 맨홀',manholes.DONGSEOUL),group('gwangju','경기광주지사 관내 맨홀',manholes.GWANGJU)];
}

export function destinationPoint(item,data={}){
  if(item.kind==='office')return officeEndpoint(item.source,data.interchanges||[],TOLL_GATES,item.label);
  const p=item.source;
  return {lat:Number(p.lat),lng:Number(p.lng),name:item.label,
    roadHint:p.roadHint||roadFrom(`${p.section||''} ${p.route_name||''} ${p.route||''}`),snapToHighway:item.kind==='junction'};
}

export function savedDestinationRoute(start,item,data={}){
  if(start.gateName!=='수원신갈톨게이트'||item.id!=='junction:songpa')throw new Error('이 구간의 저장경로가 아직 등록되지 않았습니다.');
  return savedRoute('suwon','songpa',data.offices||[]);
}

export function returnDestination(groups){
  return groups.flatMap(g=>g.items).find(i=>i.kind==='office'&&/수원.*신갈|수원영업소/.test(i.label));
}
