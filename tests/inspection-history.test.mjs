import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {archiveMonths,monthLabel,inspectionRows,rowTotals,calendarSchedule} from '../data/inspection-history-model.mjs';

test('monthly lists filter by branch and equipment, preserve source order, and keep zero counts',()=>{
  const group=(date,branch,target,items)=>({date,branch,target,section:'전송',milepost:'',items:items.map(value=>({equipment:'PTN',value,cycle:''}))});
  const month={groups:[group('2026-04-30','B','Site B',['M']),group('2026-04-02','A','Site A',['Q','H'])]};
  assert.equal(monthLabel('2026-04'),'2026년 4월');assert.throws(()=>monthLabel('2026-13'));
  assert.deepEqual(archiveMonths({months:[{month:'2026-04'},{month:'2026-09'}]}).map(m=>m.month),['2026-09','2026-04']);
  assert.deepEqual(inspectionRows(month).map(g=>g.date),['2026-04-02','2026-04-30']);
  assert.equal(inspectionRows(month,'A','PTN').length,1);
  assert.equal(inspectionRows(month,'A','Site B').length,0);
  assert.deepEqual(rowTotals(inspectionRows(month)),{plans:2,days:2,items:3});
  assert.deepEqual(rowTotals(inspectionRows(month,'missing')),{plans:0,days:0,items:0});
  assert.equal(month.groups[0].date,'2026-04-30');
});

test('encrypted archive covers April to October with total workbooks preferred and June marked partial',async()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const declaration=html.match(/const MASTER_KEY_SEED\s*=\s*("[^"]+")/);
  const hash=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.parse(declaration[1])));
  const key=await webcrypto.subtle.importKey('raw',hash,{name:'AES-GCM'},false,['decrypt']);
  const encoded=JSON.parse(fs.readFileSync(new URL('../data/inspection-history.enc.json',import.meta.url),'utf8'));
  assert.equal(encoded.encrypted,true);assert.equal(encoded.months,undefined);
  const bytes=await webcrypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(encoded.iv)},key,new Uint8Array(encoded.ciphertext));
  const archive=JSON.parse(new TextDecoder().decode(bytes));
  assert.deepEqual(archive.months.map(m=>m.month),['2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']);
  for(const month of archive.months){
    assert.equal(month.source_kind,month.month==='2026-06'?'1팀':'총괄');
    assert.deepEqual(month.branches,['경기광주지사','동서울지사']);
    assert.equal(month.invalid_dates.length,0);
    assert.equal(rowTotals(month.groups).items,month.cell_count);
    const cells=new Set();
    for(const group of month.groups){
      assert.ok(group.date.startsWith(month.month+'-'));
      for(const item of group.items){const id=group.sheet+'!'+item.cell;assert.ok(!cells.has(id),'No source cell is counted twice');cells.add(id);}
    }
    assert.equal(cells.size,month.cell_count);
    const plans=Object.values(calendarSchedule(month)).flatMap(e=>e.plans);
    assert.equal(plans.reduce((n,p)=>n+p.history_items.length,0),month.cell_count);
    assert.ok(plans.every(p=>['DONGSEOUL','GWANGJU'].includes(p.branch_code)));
  }
});

test('native calendar handles month length, starting weekday, and branch data dates',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const start=html.indexOf('    function getInspectionSchedule() {'),end=html.indexOf('    function getClosestOrTodayInspectionDate()',start);
  const nodes=new Map();
  const get=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',innerText:'',textContent:''});return nodes.get(id);};
  const state={data:{inspection_schedule:{}},activeInspectionDate:null};
  const window={InspectionApp:{scheduleOverride:null,monthOverride:null},dispatchEvent(){}};
  const context=vm.createContext({AppState:state,document:{getElementById:get},lucide:{createIcons(){}},window,Event:class{},getDayOfWeek:()=>''});
  vm.runInContext(html.slice(start,end),context);
  for(const [key,days,offset] of [['2026-04-02',30,3],['2024-02-20',29,4],['2026-11-03',30,0]]){
    state.data.inspection_schedule={[key]:{type:'OFFICE',day:Number(key.slice(8)),office_name:'Example',transmission:[],wired:[]}};
    vm.runInContext('renderInspectionCalendar()',context);
    assert.ok(get('calendar-days-grid').innerHTML.includes(key));
    assert.equal((get('calendar-days-grid').innerHTML.match(/&nbsp;/g)||[]).length,offset);
    assert.equal((get('calendar-days-grid').innerHTML.match(/<span(?: class="font-bold text-xs")?>\d+<\/span>/g)||[]).length,days);
    assert.ok(get('inspection-list-title').innerText.startsWith(Number(key.slice(5,7))+'월'));
  }
  window.InspectionApp.scheduleOverride={};window.InspectionApp.monthOverride='2026-06';
  vm.runInContext('renderInspectionCalendar()',context);
  assert.equal((get('calendar-days-grid').innerHTML.match(/<span>\d+<\/span>/g)||[]).length,30);
  assert.equal(get('inspection-cards-list').innerHTML,'');
  assert.ok(state.data.inspection_schedule['2026-11-03'],'Archive overlay never overwrites current data');
});

test('past schedules use native office/line plans and stay isolated to the two branches',()=>{
  const group=(section,target,items,branch='동서울지사')=>({date:'2026-09-04',branch,section,target,milepost:'1~2',sheet:'source',items});
  const item=(equipment,value,cycle='')=>({equipment,value,cycle,cell:'G7'});
  const month={groups:[group('전송설비','성남영업소',[item('PTN','M')]),group('유선설비','성남영업소',[item('부대시설','M')]),group('선로설비','성남영',[item('국소 OFD','Q','Q')]),group('선로설비','수도권제1순환선',[item('인공 / 수공','27M','Q'),item('수공','19-1H','Q'),item('접속함체 광','2','H')]),group('전송설비','제외 거점',[item('PTN','M')],'수원지사')]};
  const data={manholes:[{name:'27M',branch_code:'GWANGJU',id:'wrong'},{name:'27M',branch_code:'DONGSEOUL',id:'right'}],inspection_schedule:{existing:{}}};
  const before=JSON.stringify(data),schedule=calendarSchedule(month,data),plans=schedule['2026-09-04'].plans;
  assert.equal(plans.length,2);
  const office=plans.find(p=>p.type==='OFFICE'),line=plans.find(p=>p.type==='LINE');
  assert.equal(office.office_name,'성남영업소');assert.equal(office.transmission.length,1);assert.equal(office.wired.length,1);assert.ok(office.ofd_check);
  assert.deepEqual(line.line.manhole_names,['27M','19-1H']);assert.equal(line.line.manholes[0].id,'right');assert.equal(line.line.joint_box_count,2);
  assert.equal(line.line.cycle,'Q·H');
  assert.equal(calendarSchedule(month,data,'경기광주지사')['2026-09-04'],undefined);
  assert.equal(JSON.stringify(data),before);
});
