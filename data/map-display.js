// Screen-space label placement. Geographic marker positions are never changed.
(function (root) {
  'use strict';
  const junctions = [
    {id:'MAP_PANGYO_IC',name:'판교IC',type:'IC',lat:37.39742,lng:127.10066,desc:'경부고속도로 판교 나들목',coordinate_status:'PUBLIC_REFERENCE'},
    {id:'MAP_SINGAL_JC',name:'신갈JC',type:'JCT',lat:37.295386,lng:127.103562,desc:'경부고속도로 · 영동고속도로 분기점',coordinate_status:'PUBLIC_REFERENCE'}
  ];
  const nameKey = value => String(value||'').replace(/\s/g,'').toUpperCase().replace(/JCT$/,'JC');
  function withJunctions(items=[]) {
    const seen=new Set(items.map(p=>nameKey(p.name)));
    return [...items,...junctions.filter(p=>!seen.has(nameKey(p.name)))];
  }
  // Shared offices belong to both branch packs, but are one physical place in the combined map.
  const officeKey=office=>JSON.stringify([office.id||String(office.name||'').replace(/\s/g,''),Number(office.lat),Number(office.lng)]);
  const overlaps=(a,b,gap=4)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
  function placeLabels(items,width,height,obstacles=[]) {
    const occupied=[...obstacles],result=[];
    const sorted=items.slice().sort((a,b)=>(b.priority||0)-(a.priority||0)||a.anchor.y-b.anchor.y||a.anchor.x-b.anchor.x||String(a.id).localeCompare(String(b.id)));
    for(const item of sorted) {
      const w=Math.min(item.width,width-8),h=item.height,step=h+6;
      if(item.anchor.x<0||item.anchor.y<0||item.anchor.x>width||item.anchor.y>height)continue;
      const candidates=[{x:item.x,y:item.y}];
      // First preserve the original position; then prefer below / right and their next rows.
      for(let row=0;row<Math.ceil(height/step);row++) {
        candidates.push({x:item.anchor.x-w/2,y:item.anchor.y+14+row*step});
        candidates.push({x:item.anchor.x+14,y:item.anchor.y-h/2+row*step});
        candidates.push({x:item.anchor.x+14,y:item.anchor.y+14+row*step});
      }
      // View edges and dense clusters can require another column. Keep all labels within the map.
      for(let y=4;y+h<=height-4;y+=step)
        for(let x=4;x+w<=width-4;x+=Math.max(20,w/2))candidates.push({x,y});
      const preferred=candidates.shift();
      const cost=p=>{
        const dx=p.x+w/2-item.anchor.x,dy=p.y+h/2-item.anchor.y;
        return dx*dx+dy*dy+(dx<0?300:0)+(dy<0?500:0);
      };
      candidates.sort((a,b)=>cost(a)-cost(b));candidates.unshift(preferred);
      let placed=null;
      for(const c of candidates) {
        const rect={x:Math.max(4,Math.min(c.x,width-w-4)),y:Math.max(4,Math.min(c.y,height-h-4)),width:w,height:h};
        if(!occupied.some(other=>overlaps(rect,other))){placed=rect;break;}
      }
      // If the viewport cannot physically fit every name, keep the remaining label available on its marker.
      if(!placed)continue;
      occupied.push(placed);result.push({...placed,id:item.id,dx:placed.x-item.x,dy:placed.y-item.y,anchor:item.anchor});
    }
    return result;
  }
  function placeStableLabels(items,width,height,obstacles=[],offsets=new Map()) {
    const placed=[],pending=[];
    for(const item of items) {
      const saved=offsets.get(item.id);
      if(saved)placed.push({...item,x:item.x+saved.dx,y:item.y+saved.dy,dx:saved.dx,dy:saved.dy});
      else pending.push(item);
    }
    // Previously placed labels translate with their geographic anchor, even across screen edges.
    // Only a newly visible label needs placement; it cannot move any existing one.
    for(const p of placeLabels(pending,width,height,[...obstacles,...placed])) {
      offsets.set(p.id,{dx:p.dx,dy:p.dy});placed.push(p);
    }
    return placed;
  }
  function create(map,leaflet) {
    let labels=[],frame=0;
    const layouts=new Map();
    const leaders=leaflet.layerGroup().addTo(map);
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(layout);};
    function layout() {
      frame=0;leaders.clearLayers();
      const container=map.getContainer(),bounds=container.getBoundingClientRect();
      const entries=[];
      for(const entry of labels) {
        const icon=entry.marker.getElement?.(),element=icon?.querySelector('[data-map-label]');
        if(!element)continue;
        element.style.translate='0px 0px';element.style.visibility='';
        element.style.maxWidth=`${Math.max(40,bounds.width-12)}px`;
        const rect=element.getBoundingClientRect(),point=map.latLngToContainerPoint(entry.marker.getLatLng());
        if(!rect.width||!rect.height)continue;
        const latlng=entry.marker.getLatLng();
        const id=JSON.stringify([entry.priority,latlng.lat,latlng.lng,element.textContent.replace(/\s+/g,' ').trim()]);
        entries.push({...entry,id,element,x:rect.left-bounds.left,y:rect.top-bounds.top,width:rect.width,height:rect.height,anchor:{x:point.x,y:point.y}});
      }
      const obstacles=[...container.querySelectorAll('.leaflet-control,.map-controls,.map-info,.custom-office-icon > div > div:first-child,.map-label-anchor,.map-inspection-anchor')].map(el=>{
        const r=el.getBoundingClientRect();return {x:r.left-bounds.left,y:r.top-bounds.top,width:r.width,height:r.height};
      }).filter(r=>r.width&&r.height);
      // The layout belongs to a zoom, viewport and visible layer set, not to the current map centre.
      const signature=JSON.stringify([map.getZoom(),Math.round(bounds.width),Math.round(bounds.height),entries.map(e=>[e.id,Math.round(e.width*10),Math.round(e.height*10)]).sort()]);
      if(!layouts.has(signature))layouts.set(signature,new Map());
      if(layouts.size>16)layouts.delete(layouts.keys().next().value);
      const placements=new Map(placeStableLabels(entries,bounds.width,bounds.height,obstacles,layouts.get(signature)).map(p=>[p.id,p]));
      for(const entry of entries) {
        const p=placements.get(entry.id);
        if(!p){entry.element.style.visibility='hidden';continue;}
        entry.element.style.translate=`${p.dx}px ${p.dy}px`;
        if(Math.abs(p.dx)<1&&Math.abs(p.dy)<1)continue;
        const end={x:Math.max(p.x,Math.min(p.anchor.x,p.x+p.width)),y:Math.max(p.y,Math.min(p.anchor.y,p.y+p.height))};
        if(Math.hypot(end.x-p.anchor.x,end.y-p.anchor.y)>8)
          leaflet.polyline([entry.marker.getLatLng(),map.containerPointToLatLng([end.x,end.y])],{color:entry.color||'#64748b',weight:1,opacity:.75,interactive:false}).addTo(leaders);
      }
    }
    map.on('moveend zoomend resize',schedule);
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(schedule):null;observer?.observe(map.getContainer());
    document.fonts?.ready.then(schedule);
    return {
      begin(){labels=[];leaders.clearLayers();schedule();},
      add(marker,priority=0,color='#64748b'){labels.push({id:labels.length,marker,priority,color});schedule();},
      schedule,
      destroy(){map.off('moveend zoomend resize',schedule);observer?.disconnect();if(frame)cancelAnimationFrame(frame);leaders.remove();layouts.clear();}
    };
  }
  root.HighwayMapDisplay={withJunctions,officeKey,placeLabels,placeStableLabels,overlaps,create};
})(globalThis);
