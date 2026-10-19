import {validPoint} from './highway-routing.mjs?v=20261019-s3-dscoord-ga4';

// KakaoMap 6.0+ route scheme uses latitude,longitude pairs, with vp (not
// vp1) for the first waypoint. Hand off directly to the installed app:
// the desktop redirect of the mobile-web scheme can lose via points.
export function kakaoNavigationURL(result,android=false){
  // Official Kakao web supports a POI ID, but app route takes coordinates only.
  // Do not substitute GIS office coordinates for a map-provider POI.
  if(result?.goal?.providerPlace){const p=result.goal.providerPlace;
    if(p.provider!=='kakao'||p.name!=='동서울영업소')throw new Error('카카오 장소 식별자가 올바르지 않습니다.');
    return 'https://map.kakao.com/link/search/'+encodeURIComponent(p.name);
  }
  if(!result||!validPoint(result.start)||!validPoint(result.goal)||
    !Array.isArray(result.waypoints)||result.waypoints.length>5||result.waypoints.some(p=>!validPoint(p)))
    throw new Error('카카오맵에 전달할 경로가 올바르지 않습니다.');
  const coord=p=>`${p.lat},${p.lng}`;
  const q=new URLSearchParams({sp:coord(result.start),ep:coord(result.goal),by:'car'});
  result.waypoints.forEach((p,i)=>q.set(i===0?'vp':`vp${i+1}`,coord(p)));
  return android?`intent://route?${q}#Intent;scheme=kakaomap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=net.daum.android.map;end`:`kakaomap://route?${q}`;
}
