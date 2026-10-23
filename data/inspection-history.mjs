import {archiveMonths,monthLabel,calendarSchedule,INSPECTION_BRANCHES} from './inspection-history-model.mjs?v=20261023-calendar';
const app=window.InspectionApp,tab=document.getElementById('tab-plan');
const $=id=>document.getElementById(id);
let archive=null,loading=false;
function el(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}
const controls=el('div','space-y-2 p-3 rounded-xl bg-slate-950 border border-slate-800');
const label=el('label','block text-xs font-bold text-slate-200','조회할 점검계획');label.htmlFor='inspection-month';
const select=el('select','w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-xs text-white');select.id='inspection-month';select.append(new Option('현재 점검계획','current'));
const branchLabel=el('label','block text-xs text-slate-300','지사');branchLabel.htmlFor='inspection-history-branch';
const branch=el('select','w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-xs text-white');branch.id='inspection-history-branch';branch.append(new Option('동서울·경기광주 전체','ALL'),...Object.keys(INSPECTION_BRANCHES).map(b=>new Option(b,b)));
const source=el('p','text-[11px] text-slate-400');source.id='inspection-history-source';source.setAttribute('aria-live','polite');
const retry=el('button','text-xs text-cyan-300 underline','이전 달 자료 다시 불러오기');retry.type='button';retry.hidden=true;
controls.append(label,select,branchLabel,branch,source,retry);
tab.insertBefore(controls,$('inspection-calendar-panel'));
function selectedMonth(){return archive?.months.find(m=>m.month===select.value);}
function labels(){
  const month=selectedMonth(),keys=Object.keys(app.data.inspection_schedule||{}).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)).sort(),key=keys.at(-1)?.slice(0,7);
  $('inspection-plan-heading').textContent=month?`${monthLabel(month.month)} ITS 점검계획표`:key?`${monthLabel(key)} ITS 점검계획표`:'ITS 점검계획표';
  select.options[0].textContent=key?`${monthLabel(key)} · 현재 데이터팩`:'현재 점검계획';
  branch.hidden=branchLabel.hidden=!month;
  source.textContent=month?`${month.source} · 동서울·경기광주${month.source_kind==='1팀'?' · 1팀 자료':' · 총괄파일 기준'}`:loading?'이전 달 자료를 불러오는 중입니다.':archive?'이전 달도 위 목록에서 선택해 달력으로 확인하세요.':'이전 달 자료를 아직 불러오지 못했습니다.';
}
function applyMonth(){
  const month=selectedMonth();
  app.setSchedule(month?calendarSchedule(month,app.data,branch.value):null,month?.month||null);
  labels();
}
select.addEventListener('change',applyMonth);branch.addEventListener('change',applyMonth);
window.addEventListener('inspection:render',labels);
window.addEventListener('highway:datachange',()=>{if(selectedMonth())applyMonth();});
async function load(){
  if(loading)return;loading=true;retry.hidden=true;labels();
  try{
    const response=await fetch(new URL('./inspection-history.enc.json?v=20261023-calendar',import.meta.url));
    if(!response.ok)throw new Error('archive download');
    const data=await app.decrypt(await response.json());
    if(data?.version!==1||!data.months?.length)throw new Error('archive format');
    archive=data;select.replaceChildren(new Option(select.options[0].textContent,'current'),...archiveMonths(archive).map(m=>new Option(`${monthLabel(m.month)} · ${m.source_kind}`,m.month)));
  }catch{retry.hidden=false;}finally{loading=false;labels();}
}
retry.addEventListener('click',load);void load();
