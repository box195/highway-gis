import {archiveMonths,monthLabel,inspectionRows,rowTotals} from './inspection-history-model.mjs?v=20261023-history';

const app=window.InspectionApp,tab=document.getElementById('tab-plan');
const $=id=>document.getElementById(id);
let archive=null,loading=false;
function el(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;}
const controls=el('div','space-y-2 p-3 rounded-xl bg-slate-950 border border-slate-800');
const label=el('label','block text-xs font-bold text-slate-200','조회할 점검계획');label.htmlFor='inspection-month';
const select=el('select','w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-xs text-white');select.id='inspection-month';select.append(new Option('현재 점검계획','current'));
const source=el('p','text-[11px] text-slate-400');source.id='inspection-history-source';source.setAttribute('aria-live','polite');
const retry=el('button','text-xs text-cyan-300 underline','이전 달 자료 다시 불러오기');retry.type='button';retry.hidden=true;
controls.append(label,select,source,retry);
const panel=el('div','space-y-2');panel.id='inspection-history-panel';panel.hidden=true;
const filterLabel=el('label','block text-xs text-slate-300','지사');filterLabel.htmlFor='inspection-history-branch';
const branch=el('select','w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-xs text-white');branch.id='inspection-history-branch';
const search=el('input','w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-xs text-white');search.type='search';search.placeholder='거점·선로·설비 검색';search.setAttribute('aria-label','과거 점검계획 검색');
const summary=el('p','text-xs text-slate-300');summary.id='inspection-history-summary';summary.setAttribute('aria-live','polite');
const list=el('div','space-y-2 max-h-[65vh] overflow-y-auto');list.id='inspection-history-list';
panel.append(filterLabel,branch,search,summary,list);
const calendar=$('inspection-calendar-panel');tab.insertBefore(controls,calendar);tab.insertBefore(panel,calendar);

function selectedMonth(){return archive?.months.find(m=>m.month===select.value);}
function renderRows(){
  const month=selectedMonth();if(!month)return;
  const rows=inspectionRows(month,branch.value||'ALL',search.value),totals=rowTotals(rows);
  summary.textContent=`${totals.days}일 · 일정 ${totals.plans}건 · 점검 표기 ${totals.items}개`;
  $('plan-total-badge').textContent=`일정 ${totals.plans}건`;
  list.replaceChildren();
  if(!rows.length){list.append(el('p','p-3 text-xs text-slate-400','조건에 맞는 점검계획이 없습니다.'));return;}
  for(const group of rows){
    const card=el('details','p-3 rounded-xl bg-slate-900 border border-slate-800');
    const title=el('summary','cursor-pointer space-y-1');
    title.append(el('div','text-[11px] text-cyan-300',`${group.date} · ${group.branch}`),el('div','text-xs font-bold text-white',group.target),el('div','text-[11px] text-slate-400',`${group.section}${group.milepost?' · 이정 '+group.milepost:''} · ${group.items.length}항목`));
    const items=el('ul','mt-2 space-y-1 text-[11px] text-slate-200');
    for(const item of group.items)items.append(el('li','',`${item.equipment}${item.cycle?' ('+item.cycle+')':''}: ${item.value}`));
    card.append(title,items,el('p','mt-2 text-[10px] text-slate-500',`원본: ${group.sheet}`));list.append(card);
  }
}
function renderView(){
  const month=selectedMonth(),historical=!!month;
  app.archiveActive=historical;
  calendar.hidden=historical;$('inspection-current-list').hidden=historical;
  $('inspection-native-legend').style.display=historical?'none':'';panel.hidden=!historical;
  if(historical){
    $('active-inspection-banner').classList.add('hidden');
    $('inspection-plan-heading').textContent=`${monthLabel(month.month)} ITS 점검계획표`;
    source.textContent=`${month.source}${month.source_kind==='1팀'?' · 1팀 자료만 제공됩니다.':' · 총괄파일 기준'} · M 월간 / Q 분기 / H 반기`;
    renderRows();
  }else{
    const keys=Object.keys(app.data.inspection_schedule||{}).sort(),key=keys.at(-1)?.slice(0,7);
    $('inspection-plan-heading').textContent=key?`${monthLabel(key)} ITS 점검계획표`:'ITS 점검계획표';
    select.options[0].textContent=key?`${monthLabel(key)} · 현재 데이터팩`:'현재 점검계획';
    source.textContent=loading?'이전 달 자료를 불러오는 중입니다.':archive?'이전 달은 위 목록에서 선택하세요.':'이전 달 자료를 아직 불러오지 못했습니다.';
  }
}
select.addEventListener('change',()=>{
  const previous=branch.value;branch.replaceChildren(new Option('전체 지사','ALL'),...(selectedMonth()?.branches||[]).map(b=>new Option(b,b)));
  if([...branch.options].some(o=>o.value===previous))branch.value=previous;
  search.value='';app.clearInspectionDate();renderView();
});
branch.addEventListener('change',renderRows);search.addEventListener('input',renderRows);
window.addEventListener('inspection:render',renderView);
async function load(){
  if(loading)return;loading=true;retry.hidden=true;renderView();
  try{
    const response=await fetch(new URL('./inspection-history.enc.json?v=20261023-history',import.meta.url));
    if(!response.ok)throw new Error('archive download');
    const data=await app.decrypt(await response.json());
    if(data?.version!==1||!data.months?.length)throw new Error('archive format');
    archive=data;const current=select.value;
    select.replaceChildren(new Option(select.options[0].textContent,'current'),...archiveMonths(archive).map(m=>new Option(`${monthLabel(m.month)} · ${m.source_kind}`,m.month)));
    if([...select.options].some(o=>o.value===current))select.value=current;
  }catch{retry.hidden=false;}finally{loading=false;renderView();}
}
retry.addEventListener('click',load);void load();
