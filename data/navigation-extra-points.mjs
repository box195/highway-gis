// Public-reference navigation locations, separate from user GIS records.
// These are junction/toll CENTRES, not verified individual exit ramps.
// Pangyo/Seongnam IC: Mapcarta road-junction centre coordinates.
// Seoul: Seoul TG centre, 대왕판교로 240 (궁내동).
export const EXTRA_NAV_OFFICES=[
  {name:'서울영업소',lat:37.3651583,lng:127.1033500,roadHint:'경부고속도로',
   coordinate_status:'PUBLIC_REFERENCE',coordinate_source:'서울TG 공개 중심 좌표 · 진출입로 미검증'}
];
export const EXTRA_NAV_JUNCTIONS=[
  {name:'판교IC',lat:37.39742,lng:127.10066,roadHint:'경부고속도로',
   coordinate_status:'PUBLIC_REFERENCE',coordinate_source:'판교IC 공개 중심 좌표 · 진출입로 미검증'},
  {name:'성남IC',lat:37.42724,lng:127.12338,roadHint:'수도권제1순환고속도로',
   coordinate_status:'PUBLIC_REFERENCE',coordinate_source:'성남IC 공개 중심 좌표 · 진출입로 미검증'}
];
