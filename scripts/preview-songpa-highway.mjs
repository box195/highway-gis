// Print public-graph Songpa HIGHWAY route links for separate human Kakao browser verification.
// Usage: node scripts/preview-songpa-highway.mjs
// Does not open browsers or modify routing data.
import fs from 'node:fs';
import {buildGraph,availableOriginOptions,route} from '../data/highway-routing.mjs';
import {navigationCatalog,destinationPoint} from '../data/navigation-catalog.mjs';
import {savedRoute} from '../data/saved-navigation.mjs';
import {savedOfficeDeparture} from '../data/highway-endpoints.mjs';
import {TOLL_GATES} from '../data/highway-tollgates.mjs';
import {SONGPA_EXIT_ACCESS} from '../data/songpa-exit-access.mjs';
import {kakaoNavigationURL} from '../data/kakao-navigation.mjs';

const graph=buildGraph(JSON.parse(fs.readFileSync(new URL('../data/highway-roads.json',import.meta.url),'utf8')));
const songpa=navigationCatalog()[0].items[0],goal=destinationPoint(songpa);
const saved=savedRoute('suwon','songpa');
const office={...TOLL_GATES.find(p=>p.id===1814821448),name:saved.start.name};
const start=savedOfficeDeparture(office,[],TOLL_GATES);
const browserLink=r=>'https://map.kakao.com/link/by/car/'+
  [r.start,...r.waypoints,r.goal].map(p=>encodeURIComponent(p.name||'Point')+','+p.lat+','+p.lng).join('/');
function show(label,r){
  console.log(JSON.stringify({
    label,origin:[r.start.lat,r.start.lng],destination:[r.goal.lat,r.goal.lng],
    roads:r.roads,arrivalDirection:r.arrivalDirection,waypoints:r.waypoints.map(p=>[p.lat,p.lng]),
    kakaoApp:kakaoNavigationURL(r),kakaoBrowser:browserLink(r)
  }));
}
console.log('SAVED_MODE_ENTRY='+JSON.stringify({goal:saved.goal,controls:saved.waypoints.map(p=>[p.lat,p.lng])}));
const choices=availableOriginOptions(graph,start,goal);
if(!choices.choices.length)throw Error('No Suwon highway route: '+JSON.stringify(choices.rejected));
for(const c of choices.choices)show('Suwon: '+c.label,c.result);
for(const a of SONGPA_EXIT_ACCESS){
  const e=graph.mainEdgeByKey.get(a.edgeKey);
  const synthetic={name:a.approach+' Ring approach',...graph.nodes.get(e.a),roadHint:a.road,snapToHighway:true};
  show('Directed '+a.approach,route(graph,synthetic,goal,a.bearing));
}

