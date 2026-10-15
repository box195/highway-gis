// Public road topology only. Facility coordinates never go to Overpass.
export const ROADS = ['수도권제1순환고속도로', '경부고속도로', '중부고속도로', '제2중부고속도로', '영동고속도로'];
export const ROAD_QUERY = `[out:json][timeout:120][bbox:34,126,38.8,130];way[highway=motorway][name~"^(${ROADS.join('|')})$"]->.main;way(around.main:2500)[highway=motorway_link]->.links;(.main;.links;);out body;>;out skel qt;`;
export function validPoint(p) {
  return p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= 31.43 && p.lat <= 44.35 && p.lng >= 122.37 && p.lng <= 132;
}
export function distance(a, b) {
  const r = Math.PI / 180, x = (b.lng-a.lng)*r*Math.cos((a.lat+b.lat)*r/2), y=(b.lat-a.lat)*r;
  return Math.hypot(x,y)*6371000;
}
const permitted = t => !['no','private'].includes(t.access) && !['no','private'].includes(t.motor_vehicle) && !['no','private'].includes(t.vehicle);
export function buildGraph(osm) {
  if (!osm || !Array.isArray(osm.elements)) throw new Error('올바른 Overpass JSON 도로 데이터가 아닙니다.');
  const nodes = new Map(osm.elements.filter(e=>e.type==='node' && validPoint({lat:e.lat,lng:e.lon})).map(n=>[n.id,{lat:n.lat,lng:n.lon}]));
  const mains = osm.elements.filter(w=>w.type==='way' && w.tags?.highway==='motorway' && ROADS.includes(w.tags.name) && permitted(w.tags));
  const mainRoads = new Map();
  for (const w of mains) for (const id of w.nodes) {
    if (!mainRoads.has(id)) mainRoads.set(id,new Set());
    mainRoads.get(id).add(w.tags.name);
  }
  // Only connected ramp components joining two different allowed motorways.
  // IC exits, surface streets, rest areas and exits to unlisted roads are excluded.
  const links = osm.elements.filter(w=>w.type==='way' && w.tags?.highway==='motorway_link' && permitted(w.tags));
  const nodeLinks = new Map();
  links.forEach((w,i)=>w.nodes.forEach(id=>{if(!nodeLinks.has(id))nodeLinks.set(id,[]);nodeLinks.get(id).push(i);}));
  const seen=new Set(), kept=[];
  links.forEach((w,i)=>{
    if(seen.has(i))return;
    const stack=[i], component=[], roads=new Set();seen.add(i);
    while(stack.length){const j=stack.pop(), v=links[j];component.push(v);
      for(const id of v.nodes){for(const name of mainRoads.get(id)||[])roads.add(name);
        // Do not merge distinct ramps by walking along the main carriageway.
        for(const k of nodeLinks.get(id)||[])if(!seen.has(k)){seen.add(k);stack.push(k);}
      }
    }
    if(roads.size>=2)kept.push(...component);
  });
  const adj=new Map(), edges=[];
  const add=(a,b,w)=>{
    if(!nodes.has(a)||!nodes.has(b))throw new Error('도로 데이터의 좌표가 누락되었습니다. 다시 불러오세요.');
    const e={a,b,road:w.tags.highway==='motorway'?w.tags.name:null,way:w.id,length:distance(nodes.get(a),nodes.get(b))};
    if(!adj.has(a))adj.set(a,[]);adj.get(a).push(e);edges.push(e);
  };
  for(const w of [...mains,...kept]){
    const direction=w.tags.oneway;
    // Unknown-direction ramps fail closed. Motorways imply oneway=yes in OSM.
    if(w.tags.highway==='motorway_link' && !['yes','1','true','-1','no','0','false'].includes(direction))continue;
    for(let i=1;i<w.nodes.length;i++){
      if(direction==='-1')add(w.nodes[i],w.nodes[i-1],w);
      else {add(w.nodes[i-1],w.nodes[i],w);if(['no','0','false'].includes(direction))add(w.nodes[i],w.nodes[i-1],w);}
    }
  }
  const available=[...new Set(mains.map(w=>w.tags.name))];
  if(available.length!==ROADS.length)throw new Error('다섯 노선의 도로 데이터가 모두 필요합니다. 누락: '+ROADS.filter(n=>!available.includes(n)).join(', '));
  return {nodes,adj,edges,mainEdges:edges.filter(e=>e.road),available};
}
function project(p,a,b){
  const c=Math.cos(p.lat*Math.PI/180), dx=(b.lng-a.lng)*c, dy=b.lat-a.lat;
  const t=Math.max(0,Math.min(1,((p.lng-a.lng)*c*dx+(p.lat-a.lat)*dy)/(dx*dx+dy*dy||1)));
  const point={lat:a.lat+t*(b.lat-a.lat),lng:a.lng+t*(b.lng-a.lng)};
  return {point,t,gap:distance(p,point)};
}
function bearing(a,b){return (Math.atan2((b.lng-a.lng)*Math.cos(a.lat*Math.PI/180),b.lat-a.lat)*180/Math.PI+360)%360;}
export function nearestHighwayPoint(graph,p){
  if(!validPoint(p))throw new Error('고속도로 접속점의 좌표가 올바르지 않습니다.');
  let best;
  for(const edge of graph.mainEdges){if(p.roadHint&&edge.road!==p.roadHint||p.avoidSecond&&edge.road==='제2중부고속도로')continue;
    const q={...project(p,graph.nodes.get(edge.a),graph.nodes.get(edge.b)),edge};if(!best||q.gap<best.gap)best=q;
  }
  if(!best)throw new Error('해당 노선의 고속도로 접속점을 찾지 못했습니다.');
  return {...best.point,gap:best.gap,road:best.edge.road};
}
function candidates(graph,p,heading){
  const all=graph.mainEdges.filter(edge=>(!p.roadHint||edge.road===p.roadHint)&&(!p.avoidSecond||edge.road!=='제2중부고속도로')).map(edge=>({...project(p,graph.nodes.get(edge.a),graph.nodes.get(edge.b)),edge})).sort((a,b)=>a.gap-b.gap);
  if(!all.length || all[0].gap>3000)throw new Error('현재 위치 또는 목적지가 허용 고속도로에서 3km 이상 떨어져 있습니다. 지정 루트가 필요한 구간입니다.');
  const best=all[0].gap, groups=new Set(), result=[];
  for(const s of all){
    if(s.gap>best+80)break;
    const angle=bearing(graph.nodes.get(s.edge.a),graph.nodes.get(s.edge.b));
    if(Number.isFinite(heading) && Math.abs(((angle-heading+540)%360)-180)>75)continue;
    const key=s.edge.road+':'+(Math.round(angle/30)%12);
    if(groups.has(key))continue;groups.add(key);result.push(s);if(result.length===8)break;
  }
  if(!result.length)throw new Error('현재 진행 방향에 맞는 고속도로를 찾지 못했습니다. 안전한 장소에서 위치를 다시 확인하세요.');
  return result;
}
class Heap {
  a=[];
  push(v){let i=this.a.length;this.a.push(v);while(i){const p=(i-1)>>1;if(this.a[p].cost<=v.cost)break;this.a[i]=this.a[p];i=p;}this.a[i]=v;}
  pop(){const first=this.a[0],v=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let j=i*2+1;if(j+1<this.a.length&&this.a[j+1].cost<this.a[j].cost)j++;if(v.cost<=this.a[j].cost)break;this.a[i]=this.a[j];i=j;}this.a[i]=v;}return first;}
}
export function routingPolicy(graph,start,goal){
  const second='제2중부고속도로';
  const destination=goal&&nearestHighwayPoint(graph,goal);
  const allowSecond=!!goal && goal.endpointKind!=='office' && (goal.roadHint===second||(!goal.roadHint&&destination.road===second&&destination.gap<=45));
  const origin=nearestHighwayPoint(graph,start);
  const onSecond=origin.road===second&&origin.gap<=45;
  return {allowSecond,source:{...start,roadHint:start.roadHint||(onSecond?second:undefined),avoidSecond:!allowSecond&&!onSecond},target:{...goal,avoidSecond:!allowSecond}};
}
export function originOptions(graph,start,goal){
  const directions=['북','북동','동','남동','남','남서','서','북서'];
  return candidates(graph,routingPolicy(graph,start,goal).source,null).map(s=>{const angle=bearing(graph.nodes.get(s.edge.a),graph.nodes.get(s.edge.b));return {key:`${s.edge.a}:${s.edge.b}`,label:`${s.edge.road} · ${directions[Math.round(angle/45)%8]}쪽 진행 (${Math.round(angle)}°)`};});
}
export function route(graph,start,goal,heading=null,sourceKey=null){
  if(!validPoint(start)||!validPoint(goal))throw new Error('목적지의 위도·경도가 올바르지 않습니다.');
  if(distance(start,goal)<30)throw new Error('목적지에 도착했거나 현재 위치와 너무 가깝습니다.');
  const policy=routingPolicy(graph,start,goal), second='제2중부고속도로';
  let sources=candidates(graph,policy.source,heading);const targets=candidates(graph,policy.target,null);
  if(sourceKey)sources=sources.filter(s=>`${s.edge.a}:${s.edge.b}`===sourceKey);
  if(!sources.length)throw new Error('출발 위치가 바뀌었습니다. 진행 방향을 다시 선택하세요.');
  const heap=new Heap(), costs=new Map(), previous=new Map(), origins=new Map();
  let best=null;
  const accept=(cost,s,t,path,direct=false)=>{if(!best||cost<best.cost)best={cost,s,t,path,direct};};
  // Same directed segment needs no trip around the network.
  for(const s of sources)for(const t of targets)if(s.edge===t.edge && t.t>=s.t)accept((t.t-s.t)*s.edge.length+20*(s.gap+t.gap),s,t,[],true);
  for(const s of sources){const cost=(1-s.t)*s.edge.length+20*s.gap,id=s.edge.b,closed=!policy.allowSecond&&s.edge.road!==second,key=`${id}:${Number(closed)}`;
    if(cost<(costs.get(key)??Infinity)){costs.set(key,cost);origins.set(key,s);previous.delete(key);heap.push({id,cost,key,closed});}
  }
  const targetMap=new Map();for(const t of targets){if(!targetMap.has(t.edge.a))targetMap.set(t.edge.a,[]);targetMap.get(t.edge.a).push(t);}
  while(heap.a.length){
    const {id,cost,key,closed}=heap.pop();if(cost!==costs.get(key))continue;if(best&&cost>best.cost)break;
    for(const t of targetMap.get(id)||[]){const total=cost+t.t*t.edge.length+20*t.gap;
      if(!best||total<best.cost){const path=[];let cursor=key;while(previous.has(cursor)){const v=previous.get(cursor);path.push(v.edge);cursor=v.previousKey;}path.reverse();accept(total,origins.get(key),t,path);}
    }
    for(const e of graph.adj.get(id)||[]){
      if(!policy.allowSecond&&closed&&e.road===second)continue;
      const next=cost+e.length,nextClosed=closed||(!policy.allowSecond&&!!e.road&&e.road!==second),nextKey=`${e.b}:${Number(nextClosed)}`;
      if(next<(costs.get(nextKey)??Infinity)){costs.set(nextKey,next);previous.set(nextKey,{edge:e,previousKey:key});origins.set(nextKey,origins.get(key));heap.push({id:e.b,cost:next,key:nextKey,closed:nextClosed});}
    }
  }
  if(!best)throw new Error('허용된 다섯 노선의 연결로만 갈 수 있는 경로가 없습니다. 다른 노선이나 지정 루트가 필요합니다.');
  const edges=best.direct?[best.s.edge]:[best.s.edge,...best.path,best.t.edge];
  const points=[best.s.point], pointRoads=[best.s.edge.road];
  for(const e of best.path){points.push(graph.nodes.get(e.a));pointRoads.push(e.road);}
  if(!best.direct){points.push(graph.nodes.get(best.t.edge.a));pointRoads.push(best.t.edge.road);}
  points.push(best.t.point);pointRoads.push(best.t.edge.road);
  const roads=[];for(const e of edges)if(e.road&&roads.at(-1)!==e.road)roads.push(e.road);
  let length=0;for(let i=1;i<points.length;i++)length+=distance(points[i-1],points[i]);
  const waypoints=makeWaypoints(points,pointRoads);
  // Navigation must receive the same carriageway endpoints used by this graph,
  // rather than sending the original office building back to Naver.
  const navStart=start.snapToHighway?{...start,...best.s.point}:start;
  const navGoal=goal.snapToHighway?{...goal,...best.t.point}:goal;
  return {start:navStart,goal:navGoal,points,roads,length,waypoints,entryGap:best.s.gap,exitGap:best.t.gap};
}
export function makeWaypoints(points,roads){
  const cum=[0];for(let i=1;i<points.length;i++)cum.push(cum.at(-1)+distance(points[i-1],points[i]));
  const total=cum.at(-1);if(total<100)return [];
  const picks=new Set();
  const at=d=>picks.add(d);
  const runs=[];let from=0,road=roads[0];
  for(let i=1;i<=points.length;i++){
    const next=roads[i];if(i===points.length||(next&&next!==road)){
      const end=Math.min(i,points.length-1),span=cum[end]-cum[from];
      runs.push({from:cum[from],to:cum[end],span,road});
      from=i;road=next;
    }
  }
  runs.forEach((run,i)=>{
    // The first and last road's direction anchors double as road anchors,
    // leaving one waypoint per road instead of spending seven on five roads.
    if(runs.length===1){at(Math.min(300,total/2));at(Math.max(total-300,total/2));}
    else at(i===0?run.from+Math.min(300,run.span/2):i===runs.length-1?run.to-Math.min(300,run.span/2):(run.from+run.to)/2);
    if(run.span>40000)for(let j=1;j<=Math.ceil(run.span/40000);j++)at(run.from+run.span*j/(Math.ceil(run.span/40000)+1));
  });
  // Spend remaining capacity on long gaps to better guide Naver between roads.
  while(picks.size<5){const ordered=[0,...[...picks].sort((a,b)=>a-b),total];let left=0,gap=0;
    for(let i=1;i<ordered.length;i++)if(ordered[i]-ordered[i-1]>gap){gap=ordered[i]-ordered[i-1];left=ordered[i-1];}
    if(gap<3000)break;at(left+gap/2);
  }
  const selected=[];for(const d of [...picks].sort((a,b)=>a-b))if(!selected.length||d-selected.at(-1)>=200)selected.push(d);
  if(selected.length>5)throw new Error('이 경로는 방향·노선을 유지하려면 경유지가 5개 넘게 필요합니다. 더 가까운 저장 지점을 목적지로 선택해 구간을 나누세요.');
  return selected.map((d,k)=>{
    let i=cum.findIndex(v=>v>=d);if(i<1)i=1;
    const a=points[i-1],b=points[i],t=(d-cum[i-1])/(cum[i]-cum[i-1]||1);
    return {lat:a.lat+t*(b.lat-a.lat),lng:a.lng+t*(b.lng-a.lng),name:`${k+1}. ${roads[i-1]||'고속도로 연결로'}`};
  });
}
export function navigationURL(result, appURL, android=false){
  if(!validPoint(result.start)||!validPoint(result.goal)||result.waypoints.length>5||result.waypoints.some(p=>!validPoint(p)))throw new Error('네이버지도에 전달할 경로가 올바르지 않습니다.');
  const q=new URLSearchParams({slat:String(result.start.lat),slng:String(result.start.lng),sname:result.start.name||'현재 위치',dlat:String(result.goal.lat),dlng:String(result.goal.lng),dname:result.goal.name||'선택한 지점',appname:appURL});
  result.waypoints.forEach((p,i)=>{q.set(`v${i+1}lat`,String(p.lat));q.set(`v${i+1}lng`,String(p.lng));q.set(`v${i+1}name`,p.name);});
  return android?`intent://navigation?${q}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end`:`nmap://navigation?${q}`;
}
