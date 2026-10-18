## Songpa IC → Suwon-Singal shared saved return (2026-10-19)

- **Implemented only**: Songpa IC manual origin -> Suwon-Singal office top **SAVED RETURN** button. Other six origins do **not** have saved hybrid routes yet and show an unsupported-origin explanation. This does not change nearest-origin / manual-origin policy, the highway return button, or provider app links.
- Return **start**, WGS84: **37.47496233343897, 127.12880007529834**, southwest-running Ring 1 carriageway after the Songpa IC ramp merge (public OSM).
- Four return controls in order, each on directed public OSM roads: (1) **37.467587435693986, 127.12534885167113** Ring 1 southwest; (2) **37.40764245477234, 127.10681988958095** Ring 1 southwest before Pangyo; (3) **37.3778653722917, 127.10309435514655** Gyeongbu southbound; (4) **37.27021872946055, 127.10367176332836** Gyeongbu southbound before Suwon toll exit. They are not a reversed copy of the original northbound controls. Four is under the five-point limit.
- Return **goal**: runtime Suwon-Singal office GIS building coordinates, WGS84 **37.26694, 127.10244** in the current navigation fields. If that office is absent from a loaded data pack, saved-navigation's existing public toll-booth fallback is **37.2656246, 127.1027408**. Original GIS dataset is unchanged.
- [Official Kakao browser route with A/V1–V4/B positions](https://map.kakao.com/link/by/car/A,37.47496233343897,127.12880007529834/V1,37.467587435693986,127.12534885167113/V2,37.40764245477234,127.10681988958095/V3,37.3778653722917,127.10309435514655/V4,37.27021872946055,127.10367176332836/B,37.26694,127.10244). This is a **reproducible link for Codex to verify**, not a claim that the live Kakao-selected itinerary was tested here. App links retain kakaomap://route and navigation route schemes.
- Outbound Suwon -> Songpa remains three existing northbound guide points and the exact Songpa **entry ramp** goal, unmodified. The saved return instead follows southwest Ring 1 -> southbound Gyeongbu opposite carriageways through the public directed road graph. Note: the public OSM extract lacks parallel local surface road lanes; this return is a motorway corridor and must not be presented as a verified surface-road retrace of the outbound controls.
- Dongseoul toll office now opens the official Kakao place search for 동서울영업소, never its GIS building or former Plus Code as final arrival; the provider place ID is NOT VERIFIED and the user must select the actual POI (not 동서울지사). Coordinate-only app routing cannot automatically preserve the existing guide waypoints with that selected POI: they are displayed for manual use. Seongnam 8Q99C4PF+6FG remains exact; Gwangam now pins directed Ring1 westbound/Pangyo carriageway, not its former Plus Code. Dongseoul branch and Seoul-Gyeonggi HQ access is unchanged.
- Run npm run test:highway, node scripts/stamp-route-cache.mjs --check and node scripts/stamp-route-cache.mjs --verify-newlines. No browser routing/real-drive verification, commits, pushes or deployment are performed by the Worker.

---

## Current Songpa IC HIGHWAY / SAVED destination policy (2026-10-18)

This section supersedes historical statements below that both navigation modes share the Songpa entry-ramp goal.

- HIGHWAY: two OSM-directed exits on the first Ring Expressway. Northbound WGS84 **37.47000181300962, 127.13160689644921** and southbound **37.47311468100521, 127.12669970838598**.
- Northbound exit way chain: 908687231 -> 908687232 -> 908687237 -> 903231701. Southbound: 908687234 -> 908687236 -> 908687235.
- Each destination is 35 metres upstream of its final mapped motorway_link node. The selected directed approach determines the exact endpoint sent to both KakaoMap and Naver; neither is the opposite lane, the saved entry ramp or a surface-road projection.
- SAVED: Suwon to Songpa only, with the ENTRY-ramp endpoint **37.4743032763, 127.1294794184**, and three controls **[37.3778625,127.101984375]**, **[37.4562625,127.119484375]**, **[37.4671625,127.1218]** unchanged.
- GIS original interchange marker, branch/office destinations, Gonjiam/Hanam, Gwangju, and max-five-waypoint policy remain untouched.

Regenerate metadata from the existing public OSM extract:

    node scripts/build-songpa-exit-access.mjs ../roads-osm.json

Print generated Suwon and both Ring approach routes, ordered controls, provider URI and human Kakao browser validation links:

    node scripts/preview-songpa-highway.mjs

Open the printed `kakaoBrowser` link manually, inspect the actual provider route and verify it exits Songpa IC without a Heolleung-ro U-turn, opposite-carriageway jump, or re-entry. Browser execution and live map-provider behavior were not verified by local tests. The source OSM extract excludes surface roads; the 35-metre upstream offset intentionally stops within the last mapped ramp.

---

## 현재 도착점 보정 (2026-10-18)

곤지암영업소(37.3550644, 127.3225997; OSM 436295298)와 하남영업소(37.5284503, 127.2179637; OSM 10705706620)는 **영업소 앞 진출 톨게이트**를 내비게이션 최종 도착점으로 전달합니다. **영업소 건물 입구까지 안내하는 것이 아닙니다.** Codex가 카카오 웹 경로에서 확인한 국도 회차 제거에 따른 예외이며, 기존 진출 방향 경유지는 그대로 둡니다.

송파IC는 선택된 **고속도로 진입 램프**의 WGS84 **37.4743032763, 127.1294794184**를 저장경로·고속도로 모드 모두에 사용합니다(카카오 WCONGNAMUL 528633, 1104150 / 2.5 → EPSG:5181 → WGS84; 기준점 528279, 1104207 → 37.4745104494, 127.1278789719, 제시 좌표와 1m 이내). 송파 최종 목표는 본선으로 스냅하지 않으며 저장경로의 기존 경유지 3개와 단방향 제한을 유지합니다.

GIS 원본 좌표, 출발지 판정, 통과형 영업소, 정상 확인된 경기광주영업소, 지사 매핑 및 다른 거점의 목표는 변경하지 않았습니다. Node 고속도로 테스트 **52/52 통과**(앱 좌표 동등성·5개 경유지 상한 포함). 실제 모바일 앱 주행·경로는 이번 로컬 테스트에서 재검증하지 않았습니다. 아래 내용은 기존 변경 이력입니다.

## GIS 도착 위치 통일 (2026-10-18)

사용자 요청으로 통과형 외의 영업소도 GIS에 저장된 영업소 좌표를 지도앱 도착점으로 전달합니다. 정상 확인된 경기광주영업소의 기존 진출 톨게이트 도착점은 유지합니다. 지사의 기존 지정 접속점도 유지합니다. 고속도로 접근 방향 경유지는 유지하며, 최종 영업소 진입로는 지도앱이 계산합니다.

송파IC는 저장경로와 고속도로 모드 모두 GIS 송파IC 좌표를 그대로 전달합니다. 기존 고정된 OSM 도착점과 고속도로 본선으로의 도착점 보정을 제거했습니다. GIS 좌표가 없을 때의 기본 위치도 같은 송파IC 마커 좌표를 사용합니다. 저장경로 3번 경유지의 동쪽 이동은 유지합니다.

자동검사 51개 통과. 곤지암·하남의 영업소 도착 좌표, 경기광주영 도착 유지와 송파IC 두 모드의 좌표 일치를 확인했습니다. 실제 지도앱 재탐색은 별도 모바일 확인이 필요합니다.

---

## 도착점 및 송파 경유지 수정 (2026-10-18)

사용자 지정 기준: 본선 통과형 톨게이트는 GIS에 저장된 영업소 좌표로 도착합니다. 도착 좌표만 영업소로 고정하며 각 경로의 직접 접근 방향을 유지합니다. 한쪽 차로를 강제해 장거리 회차를 유발하지 않습니다. 영업소까지의 최종 진입로를 확인하지 못한 구간은 GIS 경로 선을 임의의 직선으로 이어 그리지 않고 도착 마커를 별도로 표시합니다.

IC형 영업소는 실제 진출 톨게이트를 도착점으로 사용합니다. 진출 약 350m 전 본선 경유지로 접근 방향을 유도하고, GIS 미리보기에는 공개 OSM 일방통행 연결로에서 추출한 실제 톨게이트 진출 경로를 표시합니다. 입체교차 직전 본선이나 요금소 통과 후 700m 지점을 도착점으로 전달하던 동작을 제거했습니다. 지사의 지정 IC 및 광암터널관리동 지정 위치 규칙은 유지합니다.

송파 저장경로 3번 경유지는 위도 37.4671625를 유지하고 경도를 127.1218로 약 5.8m 동쪽으로 옮겼습니다. 헌릉로758길의 동쪽(북상 차로 쪽)이며 1·2번과 목적지는 유지합니다. 두 지도앱 모두 같은 수정 좌표를 받습니다.

최신 자동검사는 50개 통과입니다. 경기광주·곤지암·서이천 실제 진출 톨게이트, 통과형 영업소 고정 좌표와 선택한 접근 차로, 저장경로 좌표 및 경유지 상한을 확인합니다. 휴대폰 지도앱의 실제 재탐색 경로는 현장 확인이 필요합니다.

---

# 빠른 길찾기 (2026-10-18)

GIS 상단 **점검계획 버튼 바로 옆 화살표 아이콘**을 누르면 전용 화면을 엽니다. PC와 모바일 모두 제공하며 [직접 열기](https://box195.github.io/highway-gis/#navigation)도 가능합니다. 같은 앱 안에서 전체 화면으로 전환하며 **← GIS**로 원래 지도에 돌아갑니다. GIS 상세의 길찾기 버튼도 유지합니다.

상단에는 수원영 고속도로 복귀·저장경로 복귀 버튼을 배치했습니다. 아래에는 송파IC·신갈JC, 경기광주지사·동서울지사, 영업소 사전순, 동서울지사 맨홀, 경기광주지사 관내 맨홀 순서로 목적지 버튼을 펼쳐 표시합니다. 로드된 데이터팩을 함께 사용합니다.

목적지 → **고속도로 / 국도** → 방향을 누르면 지도앱으로 바로 연결합니다. 기본 앱은 카카오맵이며 상단에서 네이버지도로 바꿀 수 있습니다. 방향 선택지를 표시하기 전에 경로를 계산해 연결 불가·경유지 5개 초과 방향을 제외합니다. 기존 GIS 모달의 고속도로 모드에도 카카오맵 연결을 제공합니다.

출발지는 항상 현재 GPS에서 직선거리로 가장 가까운 지원 거점이며 현재 진행 방향은 사용하지 않습니다. 선택한 방향의 톨게이트·IC 본선 접속점을 출발 좌표로 전달합니다. 거점까지의 이동은 내부 경로에 포함하지 않습니다. 전용 화면은 위치를 30초간 재사용하고, 2분 이상 지난 경로의 실행 요청 시 먼저 다시 계산합니다. 위치 권한 거절·큰 위치 오차·경로 오류 시 실행 링크를 표시하지 않습니다.

국도는 등록된 저장경로를 사용합니다. 현재는 수원신갈영업소→송파IC 한 방향만 등록되어 있으며, 다른 구간과 수원영 저장경로 복귀는 미등록으로 안내합니다. 역방향이나 임의 국도 경로는 만들지 않습니다. 기존 모달의 저장경로는 GPS 없이 조회하며 전용 화면은 가장 가까운 출발 거점 확인에 GPS를 사용합니다.

전용 화면과 기존 모달은 같은 도로망 로더와 계산기를 공유합니다. 카카오맵과 네이버지도에 같은 출발·도착·경유지를 같은 순서로 전달합니다. 각 앱이 점 사이를 재탐색하므로 최종 주행 경로의 일치를 보장하지는 않습니다. 신갈JC는 공개 OSM 본선 노드 436210017(37.295386, 127.103562)을 사용합니다.

## 최신 검증

`npm run test:highway`: **49개 통과**. 공개 거점과 송파IC·신갈JC를 포함한 369개 방향 조합에서 양 지도앱 전달 좌표·순서, 허용 노선과 경유지 5개 상한을 확인합니다.

로컬 전체 데이터 감사에서는 유효 방향 9,790개, 연결 불가 조합 0개, 앱 전달 좌표 불일치 0개, 최대 경유지 5개였습니다. 불가능한 대안 방향 194개는 선택지에서 제외합니다. 같은 접속점에 이미 도착한 조합은 제외합니다. 감사에는 맨홀도 포함했으나 **사용자 요청에 따라 이후 경로 점검은 IC·JC·영업소·지사 등 거점 사이에 집중합니다.** 감사 원본과 복호화 결과는 저장소에 추가하지 않았습니다.

제2중부선으로 표기됐지만 실제 중부선 공통 북쪽 구간에 있는 지점의 탐색 오류를 수정했습니다. 제2중부선까지 500m를 넘고 중부선 본선 45m 이내인 경우에만 탐색 노선을 중부선으로 해석합니다. 실제 제2중부선 및 두 노선이 가까이 평행한 구간의 정책과 저장 좌표는 유지합니다.

브라우저에서 실제 GIS 데이터팩 목록 순서, 모바일 390px 화면, 상단 진입 아이콘, GIS 복귀를 확인했습니다. 모의 GPS 테스트는 하남/호법 두 방향, 양 앱 동일 좌표, 송파 저장경로, 수원 복귀, GPS 재사용 및 권한 오류를 확인합니다. `tests/quick-navigation-preview.html`은 실제 GPS와 지도앱 실행을 사용하지 않는 테스트 페이지입니다.

휴대폰의 실제 경유지 수신과 두 앱이 계산한 전체 경로의 일치는 현장 확인이 필요합니다. 네이버 실시간 소요시간 비교는 계정·서버 설정이 없어 계속 보류합니다.

---
# 고속도로 경유지 안내 (초기 구현)

거점·시설물 상세 하단의 **고속도로 길찾기**를 누르면 현재 선택한 지점, 점검계획의 맨홀 또는 저장된 다른 거점을 목적지로 고를 수 있습니다. 수원신갈영업소는 저장된 거점 목록 상단에 표시됩니다.

1. 목적지와 **출발지 기준**을 고르고 **고속도로 경로 만들기**를 누릅니다. 현재 버전은 현재 위치에서 가장 가까운 저장 거점을 출발지로 사용합니다.
2. GPS 진행 방향을 확인할 수 없으면 출발 고속도로와 나침반 방향을 선택하고 다시 누릅니다.
3. 이용 노선, 본선 거리, 경유지와 GIS 지도 경로를 확인합니다.
4. 휴대폰의 **네이버지도에서 경로 확인**을 눌러 네이버지도 앱에 목적지와 최대 5개 경유지를 전달합니다.

가까운 거점 출발은 GPS와 저장된 거점 좌표 사이의 직선거리로 선택합니다. 선택된 거점 이름과 거리를 표시하며, 현재 위치의 진행 방향은 사용하지 않습니다. 네이버에도 거점의 선택한 방향 본선 접속점을 출발지로 전달합니다. 현재 위치에서 거점까지의 이동은 포함하지 않으며, 거점은 경유지 개수를 차지하지 않습니다. 출발지 기준을 바꾸면 기존 경로와 방향 선택을 초기화합니다.

목적지 목록과 지도앱에 보내는 이름에는 거점명을 표시합니다. 접속 좌표와 도착 방향 계산은 유지합니다. 교통센터와 좌표 없는 거점은 출발 후보에서 제외합니다.

2026-10-16 지정 접속점: 경기광주지사는 **곤지암톨게이트**, 동서울지사·서울경기본부는 **서하남IC**로 연결합니다. 지사 건물과 가까운 다른 요금소로 추정하지 않습니다. 서하남IC는 공개 OSM의 양방향 진출 램프가 시작되는 실제 본선 진출 전 지점을 사용하며, `scripts/build-office-access.mjs`로 공개 추출본에서 생성합니다. 광암터널관리동은 이전 Plus Code 대신 **제1순환선 판교방향 서행 본선 (37.5163803548384, 127.17451770787038)**을 지정합니다. OSM way 86197957, directed edge 1000475753→2153572261, 방위 257°를 확인했습니다. 교통센터는 고속도로 목적지와 가까운 거점 출발 후보에서 제외합니다. 이 규칙은 길찾기 접속 좌표에만 적용하며 저장된 시설물 좌표를 덮어쓰지 않습니다.

방향 선택지를 표시하기 전에 실제 경로와 경유지를 생성해 연결 불가·5개 초과 선택지를 제외합니다. 하나만 가능하면 자동 사용하고, 모두 불가능하면 사유를 표시합니다. 선택 후에는 해당 계산 결과를 사용합니다. 전체 거점 조합을 영구 저장하는 캐시나 수원 외 모든 출발지의 하남/호법 경유 선택 확대는 아직 구현하지 않았습니다.

공개 요금소와 지정 접속점으로 구성한 가상 거점 14곳의 방향 조합 전수 계산: 441개 경로 생성, 경유지 초과 0개, 같은 접속점을 공유하는 조합 12개, 연결 불가 2개(수원 남하→청계·성남)입니다. 연결 불가 선택지는 사전 계산으로 제외합니다. 사용자 데이터팩의 실제 저장 좌표를 전수 검증한 결과는 아닙니다.

## 범위

- 수도권제1순환선, 경부선, 중부선, 제2중부선, 영동선의 본선과 이들 사이의 연결로만 내부 경로 탐색에 사용합니다.
- 일반 이동은 제2중부선을 제외하고 중부선을 이용합니다. 제2중부선 위 점검 지점이 목적지인 경우에만 제2중부선을 허용합니다. 현재 위치가 이미 제2중부선 위라면 최초 진출 구간은 허용하되, 다른 본선에 합류한 후 제2중부선으로 재진입하지 않습니다.
- 영업소는 해당 톨게이트 및 소속 노선을 연결합니다. 공개 OSM 요금소 좌표를 우선 사용하고 등록된 TG/IC 좌표를 보조 기준으로 사용합니다. 곤지암·서이천은 가까운 제2중부선이 아닌 **중부선**에 고정합니다. 네이버에 보내는 영업소 출발·도착 좌표는 실제 선택한 방향의 본선 접속점이며 영업소 건물 좌표가 아닙니다. 요금소 자체까지의 램프 주행은 안내 범위에 포함하지 않습니다.
- 도착은 요금소까지 실제로 이어지는 일방통행 연결 관계로 방향을 결정합니다. 본선 통과형은 선택한 접근 차로로 접근한 뒤 저장된 영업소 위치를, IC형은 해당 진출 램프로 이어지는 실제 톨게이트를 도착점으로 사용합니다. 건물에서 가까운 요금소 한쪽을 고정하지 않습니다. 진입 전용 요금소는 도착 후보에서 제외하고, 방향 데이터를 확인할 수 없는 경우 임의로 반대편을 선택하지 않고 오류를 표시합니다. 공개 접근 데이터는 `scripts/build-toll-access.mjs`로 원본 OSM 중간 파일에서 생성합니다.
- 현재 위치가 영업소 400m 이내이고 본선에서 45m 넘게 떨어져 있으며 속도 5m/s 이하일 때 해당 영업소의 톨게이트 기준으로 출발점을 보정합니다. 이미 도로 위인 현재 위치와 맨홀·수공 등 점검지의 좌표는 유지합니다.
- 공개 OpenStreetMap 도로의 실제 노드 연결과 일방통행을 이용합니다. 입체 교차를 임의로 연결하지 않으며, 일반도로·휴게소·허용 노선으로 되돌아오지 않는 IC 램프는 내부 탐색에서 제외합니다.
- 고속도로 본선에서 3km 넘게 떨어진 출발지·목적지와 연결되지 않는 구간은 오류로 표시합니다. 진출입 일반도로의 실제 연결은 계산하지 않습니다. 거리·접속 위치는 본선 후보이며, 진출입 가능 여부를 보장하지 않습니다.
- 네이버 앱은 자체 경로를 계산하므로 **고속도로만 이용하도록 강제하거나 최종 경로를 검증하는 기능은 아닙니다**. 본선 경유지로 노선을 유도합니다. 톨게이트 제외와 사용자가 만든 국도 루트는 이번 범위에 포함하지 않습니다.
- OSM의 실시간 통제·공사·특수차량 제한·turn restriction 관계는 반영하지 않습니다. GPS heading은 이동 속도 2m/s 초과일 때만 사용하며, GPS 오차 150m 초과 시 경로를 만들지 않습니다.
- 경유지는 각 노선 변경 전 본선에 하나씩 배치하며, 긴 구간이라는 이유로 중간점을 추가하거나 빈 자리를 채우지 않습니다. 본선 통과 요금소는 마지막 합류 후 지점을 생략하고 선택한 접근 차로의 진입 전 경유지를 유지합니다. IC형은 실제 톨게이트 도착과 진출 전 약 350m 본선 경유지를 함께 전달합니다. 일반 점검지 목적지의 합류 후 지점은 유지합니다. 그래도 5개를 넘으면 출발 좌표가 선택한 방향의 본선에 고정된 거점 출발에 한해 첫 분기 전 경유지를 생략합니다. 중간 노선 경유지와 요금소 진입 방향 지점은 유지하며, 축소 후에도 5개를 넘으면 오류로 안내합니다. 수원→동서울 하남/호법 경로는 각각 4개에서 3개로 줄었습니다. 축소한 경유지를 이용한 실제 네이버 앱의 재탐색 경로는 현장 확인이 필요합니다.
- 수원신갈영업소 출발→중부선 목적지 및 토평·구리남양주 방면 제1순환선 목적지는 **판교·하남 경유 / 신갈·호법 경유**로 선택합니다. 두 경로 모두 경부선 북상으로 출발하며, 중간 분기점에서 연결되는 경로를 고르는 기능입니다. 신갈·호법을 선택하면 경부→영동→중부 순서를 반드시 거친 뒤 필요하면 제1순환선으로 연결합니다. 판교·하남은 경부→제1순환 순서로 연결합니다. 동서울 목적지는 기존의 남하/북상 도착 설명도 유지합니다. 그 외 출발지는 선택지가 출발 지점의 진행 방향임을 명시합니다. 성남·청계처럼 하남 이전 목적지에는 이 두 경유 선택지를 표시하지 않습니다.

## 도로 데이터와 개인정보

Geofabrik의 한국 OSM 원본에서 다섯 노선과 노선 간 연결로만 추출한 `data/highway-roads.json`을 앱에 포함합니다. 데이터 기준 시각은 **2026-10-14 20:21:12 UTC**입니다. 본선·연결로 3,359개 way와 20,051개 노드의 공개 도로 데이터이며 약 2MB입니다. 일반 사용 시 외부 도로 API나 비밀키가 필요하지 않습니다. 현재 위치·목적지·시설물 데이터는 도로 서버에 보내지 않습니다. 인프라 데이터팩 및 기존 암호화 저장소는 변경하지 않습니다. 네이버 앱 연결은 사용자가 링크를 누를 때 수행합니다.

내장 파일을 읽지 못하면 고정된 노선 전체 조회문으로 Overpass 조회를 시도합니다. API가 혼잡하면 실패할 수 있습니다. 수동 갱신이 필요하면 `공개 도로 데이터`의 조회문을 [Overpass Turbo](https://overpass-turbo.eu/)에서 실행하여 **원본 OSM JSON**을 내보낸 후 가져올 수 있습니다. 가져온 데이터는 메모리에만 보관됩니다. 최소한 다섯 노선 본선, 연결로와 그 노드 좌표가 모두 필요합니다. GeoJSON은 지원하지 않습니다.

동일한 원본에서 재생성하려면 `pip install osmium` 후 `scripts/build-highway-data.py`와 `scripts/compact-highway-data.mjs`를 순서대로 실행합니다. 공개 도로 데이터 파일은 ODbL-1.0에 따라 배포합니다. 원본은 [Geofabrik 한국 OSM 다운로드](https://download.geofabrik.de/asia/south-korea.html)에서 받을 수 있습니다.

출처: [OpenStreetMap / ODbL](https://www.openstreetmap.org/copyright), [네이버지도 공식 앱 연동 문서](https://guide.ncloud-docs.com/docs/en/application-maps-url-scheme-vpc).

## 검증

`npm run test:highway` (Node.js 내장 테스트 러너, 별도 패키지 설치 없음)

자동 테스트 **43개 통과**: 합성 도로망의 방향·연결로·입체 교차 분리·사유/일반도로 제외·경유지 상한·좌표/URL 인코딩과 내장 실도로망을 검사합니다. 실제 방향 연결망의 5,028개 노드 핵심 연결 성분에 다섯 노선이 모두 포함되는 것을 확인했습니다. 경유지 배치를 변경한 뒤 노선별 실제 본선 지점 간 20개 방향 조합 모두 5개 이내 경유지를 생성합니다. 수원→동서울의 하남/호법 두 경로와 서로 다른 도착 차로도 검사합니다. 추가 검증은 합류 후 중복 지점 제거, 본선 출발이 확정된 6구간의 5개 축소, 축소가 불가능한 경로의 오류 유지, 본선 목적지의 마지막 중복 경유지 제거를 포함합니다.

브라우저에서는 기존 데이터팩 자동 로드, 수원신갈영업소 검색·상세 진입, 길찾기 모달의 목적지 선택을 확인했습니다. `tests/navigation-preview.html`에서 **모의 GPS**와 내장 실제 도로망으로 경부→제1순환 및 경부→제1순환→중부 경로 생성, GIS 지도 미리보기, 네이버 경유지 링크, 목적지 변경 시 기존 링크 무효화와 재계산을 확인했습니다. 이 테스트 페이지는 실제 GPS를 요청하지 않고 네이버 앱 실행도 차단합니다. `?gps=no-heading` 또는 `?gps=denied`로 방향 선택과 위치 권한 오류 흐름을 점검할 수 있습니다.

실제 휴대폰 GPS와 네이버지도 앱의 경유지 수신·재탐색, 목적지의 실제 차량 진출입 가능 여부는 현장 미검증입니다. 운영 반영 전에 확인해야 합니다. 테스트 결과는 도로망 데이터와 경유지 생성의 검증이며 실제 주행 보장은 아닙니다.

도착 방향 및 경유지 수정 후 테스트는 **28개 통과**입니다. 청계·성남·구리남양주·동서울 본선 요금소에 양쪽 차로 각각에서 접근해 같은 진행 방향으로 짧게 도착하는지, 곤지암 도착 시 진입 전용 요금소가 제외되는지, 네이버 URL의 도착 좌표·방향 이름이 선택한 접근 방향을 유지하는지 검사합니다.

## 보류한 후속 작업

### 카카오맵 송파IC 연결 시험 (2026-10-18)

길찾기 → 저장 경로 → 수원신갈영업소 → 송파IC → 저장 경로 불러오기에서 **카카오맵 앱에서 저장 경로 확인** 버튼도 제공합니다. 기존 네이버 버튼을 유지하며 고속도로 모드에도 카카오맵 버튼을 표시합니다. 저장된 출발·도착 및 경유지 3개의 좌표와 순서를 바꾸지 않습니다. `data/kakao-navigation.mjs`는 카카오맵 6.0 이상 공식 route 스킴의 `sp`, `ep`, `vp`, `vp2`, `vp3`, `by=car`를 사용합니다. Android에서는 카카오맵 패키지의 intent로 직접 연결하고 그 외에는 kakaomap 스킴을 사용합니다. 연결은 사용자가 버튼을 누를 때만 수행합니다.

자동 테스트 **45개 통과**. 카카오맵 링크의 위도·경도 순서, 세 경유지의 정확한 값과 순서, 첫 경유지 키 `vp`, Android 패키지 지정, 잘못된 좌표와 5개 상한 거부를 검사했습니다. 모의 GPS 브라우저 테스트에서는 저장 경로를 불러온 뒤 링크 생성·클릭 처리와 고속도로 모드 전환 시 이전 링크 제거를 확인했습니다. 모의 테스트 페이지는 실제 지도앱 실행을 차단합니다.

공식 모바일 웹 스킴을 PC 브라우저에서 열었을 때는 PC 지도에서 경유지가 2개로 표시돼 기존 세 점의 경로를 제대로 검증할 수 없었습니다. 이 결과를 앱의 3개 경유지 수신 성공으로 간주하지 않습니다. 따라서 시험 버튼은 모바일 웹 리다이렉트 대신 설치된 카카오맵 앱으로 직접 전달합니다. **실제 휴대폰 카카오맵에서 경유지 3개 수신, 주행 경로 및 톨게이트 통과 여부는 아직 미검증**입니다. 다른 지도 엔진이므로 네이버에서 확인했던 경로와 같다고 보장하지 않습니다.

공식 문서: https://apis.map.kakao.com/android_v2/docs/api-guide/urlscheme/

**저장 경로 시험 구간 추가**: 길찾기 → 경로 방식 → 저장 경로에서 수원신갈영업소→송파IC만 선택할 수 있습니다. 사용자 요청으로 역방향은 제거했습니다. 경유지는 `8Q9994H2+4QX`, `8Q99F449+GQ5`, `8Q99F48C+VP7` 순서이며, 3번의 중심 좌표는 37.4671625, 127.1218입니다. 모든 경유지를 그대로 전달하며 고속도로 본선 보정이나 경유지 축소는 하지 않습니다. 사용자 조건은 다른 톨게이트를 지나지 않는 고속도로·일반도로 조합이며 수원신갈톨게이트는 통과 허용입니다. 이 조건에 맞는 실제 네이버 재탐색 결과는 사용자가 확인해야 합니다. 통행료 계산이나 회피 API는 추가하지 않았습니다.

송파IC는 공개 OSM의 NE 도착 접속점 734968654을 사용합니다. 수원은 데이터팩에 저장된 실제 수원신갈영업소 좌표를 우선 사용하고, 없으면 공개 수원신갈 요금소 좌표를 사용합니다. GPS는 요청하지 않습니다. 지도에는 저장된 출발·도착·경유지 마커만 표시하며 이를 직선이나 가상의 도로 경로로 연결하지 않습니다. 네이버 URL을 생성해 실제 경로를 확인할 수 있습니다. 방향/경로 방식을 바꾸면 이전 링크와 지도 표시를 지웁니다. 초기 브라우저 모의 테스트에서 GPS 요청 0회와 방식 변경 후 링크 초기화를 확인했으며, 최신 자동 테스트는 변경된 3번 좌표의 URL 전달과 역방향 요청 거부를 검사합니다.

지도에서 직접 점을 추가하는 편집기와 임의 출발·목적지에 저장 경로 일부를 자동 연결하는 기능은 아직 구현하지 않았습니다. 핵심 경유지는 최대 5개이며 네이버가 점 사이를 다시 계산하므로 저장한 선 자체를 강제할 수는 없습니다.

2026-10-16 사용자 요청: 출발 방향 선택지 두 경로에 대해 검색 시점의 네이버 실시간 소요 시간을 미리 조회해 더 빠른 쪽을 비교할 수 있게 합니다. 네이버 클라우드 Maps Directions API 계정·API 설정과 비밀키를 보관할 서버가 아직 없습니다. 사용자가 시간 비교는 나중으로 미루고 도착 방향만 우선 수정하도록 요청했으므로 **현재 미구현·보류** 상태입니다. 거리나 자체 계산 시간을 네이버 실시간 시간으로 표시하지 않습니다.

톨게이트 보정 테스트는 공개 요금소 좌표에서 위치를 옮긴 가상의 영업소를 사용합니다. 영업소↔요금소 이름 대응, 중부/제2중부 구분, 네이버에 전달되는 출발·도착 좌표의 본선 일치, 이미 도로 위인 점검지 좌표 유지, 제2중부선 목적지 예외와 최초 진출 후 재진입 금지를 검사합니다. `tests/navigation-preview.html?case=tollgate`에서 모의 수원신갈 출발→곤지암 도착을 검증할 수 있습니다. 이 경로가 경부→영동→중부로 계산되고 양 끝점이 본선 좌표로 전달되는 것을 브라우저에서도 확인했습니다.


## 2026-10-19 빠른 길찾기 수정 (미배포, 브라우저 경로 확인 대기)

- **목적지 목록**: 최상단 송파IC·신갈JC는 유지하고, 지사·영업소의 기존 순서를 보존합니다. 수원신갈영업소는 목록에서만 제외하며 상단 '수원 복귀'는 그대로 작동합니다. 두 맨홀 목록 대신 기존 GIS `interchanges` 중 IC/JC/JCT 이름과 유효 좌표가 있는 기록을 한국어 가나다순·중복 제거 후 표시합니다. 실제 GIS 지도와 맨홀 원본 데이터는 손대지 않습니다. 새 IC/JC의 도착 연결 품질은 별도의 지도앱 확인이 필요합니다.
- **지속 캐시**: 가까운 출발 거점은 매번 현재 GPS로 확인합니다(위치 정보 자체는 저장하지 않음). 확정된 출발 거점 + 목적지 + 모드 + 도착 정보가 같으면 브라우저 `localStorage`의 사전 계산 경로 선택지를 즉시 재사용하여 큰 OSM 그래프 로드와 탐색을 생략합니다. 저장 경로/고속도로 모드, 도착 방향의 별도 선택지는 그대로 유지합니다. 경로 결과에 필요한 시작·도착·경유 좌표/이름만 최소화해 저장하고 원본 GPS, 정확도, 원본 GIS 데이터팩, 오류는 저장하지 않습니다. 캐시는 최대 32개, 수명 7일, 총 크기 180KB 제한입니다. JSON 손상, 오래된 항목, 버전 불일치, 브라우저 저장 공간 차단·용량 초과 시 자동으로 통상 재계산합니다. 그래프·라우터·목적지 목록·접근 자료·저장 경로 변경은 소스 파일 SHA-256 결합 지문으로 구분합니다. 변경 후 `node scripts/stamp-route-cache.mjs`를 실행하고 `--check` 검사에 통과시켜야 합니다.
- **요금소 도착**: 성남·동서울 본선형은 각 접근 차로에서 요금소 중심보다 약 32m 전방에 멈추도록 하고, 공개 OSM 진행 방향의 도로 오른쪽 4m를 목표로 지정합니다. 서이천은 각각의 일방통행 진출 램프 말단을 따라 같은 방식으로 요금소 통과 전에 멈춥니다. 진입 방향을 임의 반전하지 않습니다. 우측 도로 가장자리 계산은 OSM 선형 기준이며 실제 정차 가능 장소·차단봉·요금 부스 접근은 현장 검증되지 않았습니다.
- **하남영업소**: 과거 진출 요금소점 37.5284503,127.2179637에 강제 도착시키지 않습니다. 영업소가 진입측에 있으므로 저장된 사무소 좌표로 최종 안내하고 카카오/네이버에서 합법적 유턴·재진입을 계산하도록 둡니다. 자체 그래프는 일반도로 회전 규칙을 검증하지 못합니다.
- **동서울지사**: 서하남IC의 실제 진행 방향별 진출점 두 곳 중 하나를 접근점으로 사용하지만 최종 목적지는 동서울지사 저장 좌표 37.51413,127.15375입니다. 본선으로 건물 좌표를 투영하지 않습니다. 지도앱 재탐색에서 지정 IC를 유지하도록 마지막 본선 경유점도 서하남IC 진출 전 방향에 배치합니다.
- **절대 구분**: 송파IC 고속도로 진출 목적지는 유지하고, 등록 저장 경로의 진입 목표 37.4743032763,127.1294794184 및 경유점 3개는 변경하지 않습니다.
- **한계**: 이 캐시는 내부 OSM 경유지 계산 결과만 재사용합니다. 외부 카카오맵/네이버지도 앱의 실시간 교통량 반영·재탐색·요금소 진입 판단은 캐시하지도 통제하지도 못합니다. 실제 앱의 요금소 앞 회차·루프 방지 성공 여부는 Codex의 공개 카카오 브라우저 경로 검증이 필요합니다.

검증: `npm run test:highway`, `node scripts/stamp-route-cache.mjs --check`. 맨홀 전수 감사는 실행하지 않습니다.


## 2026-10-19 후속 정정: 사용자 지정 영업소 목적지 / 수동 출발

- 동서울영업소 FULL Plus Code `8Q99G68C+Q8F`의 정확한 셀 중심: `37.5169375, 127.220796875`.
- 성남영업소 FULL Plus Code `8Q99C4PF+6FG`의 정확한 셀 중심: `37.4355625, 127.123703125`.
- 두 영업소는 양쪽 진행 방향에서 지정한 셀 중심 그대로 최종 도착점으로 사용합니다. 위치 스냅, 오프셋, 근사 보정은 금지합니다. 기존 접근 차로별 본선 경유지는 유지합니다. 이 설명은 위의 32m 전·4m 우측 보정 설명보다 우선합니다. 서이천·하남·동서울지사·송파 접근 정책은 그대로 유지합니다.
- 새 카카오 실경로 재확인용 URL (아직 재검증 전):
  - 성남TG 남하: https://map.kakao.com/link/by/car/A,37.5897562,127.1564031/V1,37.44133600526664,127.12291165183585/B,37.4355625,127.123703125
  - 동서울TG 북상: https://map.kakao.com/link/by/car/A,37.44872247223371,127.26743778273014/V1,37.511902582628174,127.22498626585622/B,37.5169375,127.220796875
  - 동서울TG 남하: https://map.kakao.com/link/by/car/A,37.52870418849862,127.21825458471939/V1,37.52326576039262,127.22024756514803/B,37.5169375,127.220796875
- 상단 출발지 선택기는 기본 GPS 최근접 거점과 저장 영업소/지사/IC/JC를 지원합니다. 선택된 저장 출발지는 GPS를 요청하지 않습니다. 수원신갈영업소는 목적지 버튼에서는 빠지고 출발 목록 및 상단 복귀에는 남습니다. 맨홀 데이터는 사용하지 않습니다. 수동 IC/JC 출발 시 도착 전용 진출 앵커를 재사용하지 않으며, 출발 본선 방향 후보를 별도로 계산합니다.
- 출발 거점 ID 선택값만 로컬에 저장합니다. 오래된 거점 ID는 기본 GPS 선택으로 복귀하고, 출발 ID/방식과 사용자 지정 도착 좌표는 캐시 키에 반영합니다. 텍스트 파일 지문은 LF/CRLF 변환을 정규화합니다. `node scripts/stamp-route-cache.mjs --verify-newlines` 테스트로 동일 결과를 검증합니다.
- 실제 카카오/네이버 길찾기와 현장 차량 접근은 별도 검증이 필요합니다. 사용자의 승인 없이 커밋/푸시/배포하지 않습니다.

## 2026-10-19 Songpa IC saved return corridor correction

The saved Songpa IC -> Suwon return uses the reverse of the existing local-road corridor, not Ring 1/Gyeongbu. Outbound Suwon -> Songpa original three guides and entry goal remain unchanged. The return now starts from the user's exact Plus Code 8Q99F4HM+HH3 (37.4788875,127.133921875), replacing the prior directed OSM southbound EXIT-link start, then follows the saved guide corridor south via Heolleung-ro 758-gil, Tancheon-ro, Daewangpangyo-ro, and Shinsu-ro to the runtime Suwon office (37.26694, 127.10244). The last two guide points lie on separately mapped southbound one-way Shinsu-ro carriageways, OSM 277611773 and 624073974. First return guide is now user-provided Daewang bridge full Plus Code 8Q99F48C+QWM, decoded exactly to 37.4669625, 127.122296875, with no offset or snapping. The next two guide positions use the previous OSM two-way centerline corridor, ways 186410728 and 473590580. Full local South Korea PBF was inspected. This is topology/geometry validation only; live Kakao driving result is NOT_RUN pending user phone confirmation. Five waypoints maximum. Six extra hybrid hub routes remain future work.
## 2026-10-19 bounded POI / Pangyo / Songpa update

- Kakao POI entry: https://map.kakao.com/link/search/%EB%8F%99%EC%84%9C%EC%9A%B8%EC%98%81%EC%97%85%EC%86%8C (HTTP 200 redirect to map.kakao.com/?q=...). **POI place ID / map-provider entrance NOT VERIFIED; live selected POI NOT_RUN.** Never use office GIS coordinate, Plus Code or an arbitrary booth offset for the final destination. Search is user-select; no automatic via-point transfer (coordinate-only kakaomap://route and nmap://navigation protocols cannot be treated as POI selections). Manual via-point coordinates remain visible. Branch/HQ are unrelated places.
- Gwangam: arrival at Ring1 Pangyo-bound directed westbound edge (37.5163803548384,127.17451770787038). Nearby opposite eastbound has a public OSM directed 7.9km route through the Hanam Dream rest-area shared access / opposite Jungbu carriageway and reentry to Ring1 westbound. **Only OSM direction/topology confirmed; public access legality, on-site U-turn rules and live Kakao/Naver navigation NOT_RUN.** Limit to five controls, reject distant/unverified local reversals. Original source GIS records untouched.
- Songpa return: guide 1 Daewang bridge exact full Plus Code 8Q99F48C+QWM → cell center 37.4669625,127.122296875. Four remaining existing local surface controls preserved (total five); no cheap proof of fewer-waypoint route equivalence. Following the later exact user input, Songpa saved return departure is now full Plus Code **8Q99F4HM+HH3** → cell center **37.4788875,127.133921875**, without geocoding or snapping. This overrides the previous directed EXIT-link start only (not the Songpa ENTRY destination). The address near 장지동 354-3 was not separately geocoded or asserted to be identical. Songpa ENTRY destination and Suwon→Songpa outbound saved route unchanged.
