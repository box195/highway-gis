// Names stay at their geographic point. Only compact symbols are separated.
(function(root){
 'use strict';
 const junctions=[
  {id:'MAP_PANGYO_IC',name:'판교IC',type:'IC',lat:37.39742,lng:127.10066,desc:'경부고속도로 판교 나들목',coordinate_status:'PUBLIC_REFERENCE'},
  {id:'MAP_SINGAL_JC',name:'신갈JC',type:'JCT',lat:37.295386,lng:127.103562,desc:'경부고속도로 · 영동고속도로 분기점',coordinate_status:'PUBLIC_REFERENCE'}
 ];
 const key=s=>String(s||'').replace(/\s/g,'').toUpperCase().replace(/JCT$/,'JC');
 function withJunctions(items=[]){const seen=new Set(items.map(p=>key(p.name)));return [...items,...junctions.filter(p=>!seen.has(key(p.name)))];}
 const officeKey=o=>JSON.stringify([o.id||String(o.name||'').replace(/\s/g,''),Number(o.lat),Number(o.lng)]);
 const overlaps=(a,b,gap=2)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
 const MAX_ICON_SHIFT=28;
 const nearby=[];
 for(let dx=-MAX_ICON_SHIFT;dx<=MAX_ICON_SHIFT;dx+=2)for(let dy=-MAX_ICON_SHIFT;dy<=MAX_ICON_SHIFT;dy+=2)
  if(dx*dx+dy*dy<=MAX_ICON_SHIFT**2)nearby.push({dx,dy});
 nearby.sort((a,b)=>a.dx*a.dx+a.dy*a.dy-b.dx*b.dx-b.dy*b.dy||b.dx-a.dx||b.dy-a.dy);
 function placeIcons(items,previous=new Map()){
  const placed=[];
  for(const item of items.slice().sort((a,b)=>(b.priority||0)-(a.priority||0)||String(a.id).localeCompare(String(b.id)))){
   const saved=previous.get(item.id);let best=null;
   for(const offset of [...(saved?[saved]:[]),...nearby]){
    const rect={...item,x:item.x+offset.dx,y:item.y+offset.dy,...offset};
    if(!placed.some(p=>overlaps(rect,p))){best=rect;break;}
   }
   // A very low zoom must never send an icon far away from its real point.
   best??={...item,dx:0,dy:0};previous.set(item.id,{dx:best.dx,dy:best.dy});placed.push(best);
  }
  return placed;
 }
 function create(map,leaflet){
  let markers=[],frame=0;
  const previous=new Map(),leaders=leaflet.layerGroup().addTo(map);
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(layout);};
  function layout(){
   frame=0;leaders.clearLayers();const entries=[];
   const zoom=map.getZoom();
   const sizes=zoom>=10?[16,14]:zoom>=9?[12,10]:zoom>=8?[8,6]:zoom>=7?[6,5]:[4,3];
   map.getContainer().style.setProperty('--map-office-icon-size',`${sizes[0]}px`);
   map.getContainer().style.setProperty('--map-junction-icon-size',`${sizes[1]}px`);
   for(const entry of markers){
    const node=entry.marker.getElement?.();if(!node)continue;
    for(const label of node.querySelectorAll('[data-map-label]')){label.style.translate='';label.style.visibility='';}
    const icon=node.querySelector('.map-junction-symbol,.custom-office-symbol,.map-inspection-anchor');
    if(!icon)continue;icon.style.translate='';const rect=icon.getBoundingClientRect();if(!rect.width||!rect.height)continue;
    const p=entry.marker.getLatLng();entries.push({...entry,icon,id:JSON.stringify([p.lat,p.lng,node.textContent.replace(/\s+/g,' ').trim()]),x:rect.left,y:rect.top,width:rect.width,height:rect.height});
   }
   for(const p of placeIcons(entries,previous)){
    p.icon.style.translate=`${p.dx}px ${p.dy}px`;
    if(Math.hypot(p.dx,p.dy)<=3)continue;
    const a=map.latLngToContainerPoint(p.marker.getLatLng());
    leaflet.polyline([p.marker.getLatLng(),map.containerPointToLatLng([a.x+p.dx,a.y+p.dy])],{color:p.color||'#64748b',weight:1,opacity:.6,interactive:false}).addTo(leaders);
   }
  }
  map.on('moveend zoomend resize',schedule);
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(schedule):null;observer?.observe(map.getContainer());document.fonts?.ready.then(schedule);
  return {
   begin(){markers=[];leaders.clearLayers();schedule();},
   add(marker,priority=0,color='#64748b'){
    marker.getElement?.()?.querySelector('.custom-office-icon > div > div:first-child')?.classList.add('custom-office-symbol');
    markers.push({marker,priority,color});schedule();
   },schedule,
   destroy(){map.off('moveend zoomend resize',schedule);observer?.disconnect();if(frame)cancelAnimationFrame(frame);leaders.remove();previous.clear();}
  };
 }
 root.HighwayMapDisplay={withJunctions,officeKey,overlaps,placeIcons,MAX_ICON_SHIFT,create};
})(globalThis);
