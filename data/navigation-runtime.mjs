import {ROAD_QUERY,buildGraph} from './highway-routing.mjs?v=20261019-s3-dscoord-ga4';
let graphPromise;
export async function loadGraph(){
  if(graphPromise)return graphPromise;
  graphPromise=(async()=>{
    // Versioned public snapshot ships with the app: no public API dependency
    // for ordinary navigation, and no precise-location requests to a router.
    try{
      const snapshot=await fetch(new URL('./highway-roads.json',import.meta.url));
      if(snapshot.ok)return buildGraph(await snapshot.json());
    }catch{/* A missing snapshot can still use the public-query fallback. */}
    let cache;const key=new URL('./highway-public-road-cache.json',import.meta.url).href;
    try{cache=await caches.open('highway-public-road-v1');const saved=await cache.match(key);
      if(saved && Date.now()-Number(saved.headers.get('x-saved-at'))<7*86400000)return buildGraph(await saved.json());
    }catch{/* Caching is optional, including private browsing. */}
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),135000);
    try{
      const res=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:ROAD_QUERY}),signal:controller.signal});
      if(!res.ok)throw new Error('HTTP '+res.status);
      const osm=await res.json();if(osm.remark)throw new Error(osm.remark);
      const graph=buildGraph(osm);
      try{await cache?.put(key,new Response(JSON.stringify(osm),{headers:{'Content-Type':'application/json','x-saved-at':String(Date.now())}}));}catch{/* Quota failure does not block navigation. */}
      return graph;
    }catch(error){throw new Error('공개 도로 데이터를 불러오지 못했습니다. 잠시 후 다시 시도하거나 공개 도로 데이터 메뉴에서 Overpass JSON을 가져오세요. ('+(error.name==='AbortError'?'응답 시간 초과':error.message)+')');}
    finally{clearTimeout(timeout);}
  })().catch(e=>{graphPromise=null;throw e;});
  return graphPromise;
}
export function gps(){return new Promise((resolve,reject)=>{
  if(!window.isSecureContext)return reject(new Error('위치 기능은 HTTPS 또는 localhost에서 사용할 수 있습니다.'));
  if(!navigator.geolocation)return reject(new Error('이 브라우저는 현재 위치를 지원하지 않습니다.'));
  navigator.geolocation.getCurrentPosition(p=>{
    if(p.coords.accuracy>150)return reject(new Error('현재 위치의 오차가 150m보다 큽니다. GPS 수신이 좋은 곳에서 다시 시도하세요.'));
    resolve({lat:p.coords.latitude,lng:p.coords.longitude,speed:p.coords.speed,heading:p.coords.speed>2?p.coords.heading:null,accuracy:p.coords.accuracy});
  },e=>reject(new Error(({1:'위치 권한을 허용한 뒤 다시 시도하세요.',2:'현재 위치를 확인할 수 없습니다.',3:'현재 위치 요청 시간이 초과됐습니다.'})[e.code]||'위치를 가져오지 못했습니다.')),{enableHighAccuracy:true,timeout:20000,maximumAge:0});
});}

export function replaceGraph(graph){graphPromise=Promise.resolve(graph);}
