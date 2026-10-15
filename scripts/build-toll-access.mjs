// Derive direction-specific toll approaches from public OSM topology.
// Usage: node scripts/build-toll-access.mjs intermediate.json
import fs from 'node:fs/promises';
import {buildGraph,distance} from '../data/highway-routing.mjs';
import {TOLL_GATES} from '../data/highway-tollgates.mjs';
const raw=JSON.parse(await fs.readFile(process.argv[2],'utf8')),graph=buildGraph(raw);
const nodes=new Map(raw.elements.filter(e=>e.type==='node').map(n=>[n.id,{lat:n.lat,lng:n.lon}]));
const rampsIn=new Map(),mainIn=new Map(),mainAt=new Set();
for(const e of graph.mainEdges){mainAt.add(e.a);mainAt.add(e.b);if(!mainIn.has(e.b))mainIn.set(e.b,[]);mainIn.get(e.b).push(e);}
const permitted=t=>!['no','private'].includes(t.access)&&!['no','private'].includes(t.vehicle)&&!['no','private'].includes(t.motor_vehicle);
const add=(a,b)=>{if(!rampsIn.has(b))rampsIn.set(b,[]);rampsIn.get(b).push(a);};
for(const w of raw.elements.filter(e=>e.type==='way'&&e.tags.highway==='motorway_link'&&permitted(e.tags))){
  for(let i=1;i<w.nodes.length;i++){
    if(w.tags.oneway==='-1')add(w.nodes[i],w.nodes[i-1]);
    else {add(w.nodes[i-1],w.nodes[i]);if(!['yes','1','true'].includes(w.tags.oneway))add(w.nodes[i],w.nodes[i-1]);}
  }
}
const bearing=(a,b)=>(Math.atan2((b.lng-a.lng)*Math.cos(a.lat*Math.PI/180),b.lat-a.lat)*180/Math.PI+360)%360;
const anchor=(e,point,kind)=>({edgeKey:`${e.a}:${e.b}`,lat:point.lat,lng:point.lng,road:e.road,bearing:Math.round(bearing(graph.nodes.get(e.a),graph.nodes.get(e.b))),kind});
const result={};
for(const gate of TOLL_GATES){
  const arrivals=[];
  if(mainAt.has(gate.id)){
    // Finish beyond the plaza on its own directed carriageway. A point in
    // the middle of a wide plaza can otherwise snap to the opposite side.
    for(const incoming of mainIn.get(gate.id)||[]){
      let id=gate.id,remaining=700,previous=incoming;
      const seen=new Set();let endpoint;
      while(remaining>0&&!seen.has(id)){
        seen.add(id);const outs=(graph.adj.get(id)||[]).filter(e=>e.road===incoming.road);
        const angle=bearing(graph.nodes.get(previous.a),graph.nodes.get(previous.b));
        outs.sort((a,b)=>Math.abs(((bearing(graph.nodes.get(a.a),graph.nodes.get(a.b))-angle+540)%360)-180)-Math.abs(((bearing(graph.nodes.get(b.a),graph.nodes.get(b.b))-angle+540)%360)-180));
        const e=outs[0];if(!e)break;
        const a=graph.nodes.get(e.a),b=graph.nodes.get(e.b),fraction=Math.min(1,remaining/(e.length||1));
        endpoint={...anchor(e,{lat:a.lat+(b.lat-a.lat)*fraction,lng:a.lng+(b.lng-a.lng)*fraction},'through'),offset:700};
        remaining-=e.length;previous=e;id=e.b;
      }
      if(endpoint)arrivals.push(endpoint);
    }
  }else{
    // Follow only ramp predecessors to find the carriageway exits that can
    // actually reach this booth. Proximity alone cannot identify an exit.
    const stack=[{id:gate.id,length:0}],seen=new Set();
    while(stack.length){const {id,length}=stack.pop();if(seen.has(id)||length>5000)continue;seen.add(id);
      if(mainAt.has(id)){
        for(const e of mainIn.get(id)||[]){const a=graph.nodes.get(e.a),b=graph.nodes.get(e.b),t=Math.max(0,1-30/(e.length||1));arrivals.push(anchor(e,{lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t},'exit'));}continue;
      }
      for(const a of rampsIn.get(id)||[])if(nodes.has(a)&&nodes.has(id))stack.push({id:a,length:length+distance(nodes.get(a),nodes.get(id))});
    }
  }
  result[gate.id]=[...new Map(arrivals.map(a=>[a.edgeKey+':'+a.lat,a])).values()];
}
await fs.writeFile(new URL('../data/highway-toll-access.mjs',import.meta.url),'// Directed public OSM toll approaches (ODbL-1.0), data as of '+raw.dataAsOf+'.\n// Source: https://download.geofabrik.de/asia/south-korea.html\nexport const TOLL_ACCESS = '+JSON.stringify(result,null,2)+';\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(result).map(([k,v])=>[k,v.length]))));
