import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {archiveMonths,monthLabel,inspectionRows,rowTotals} from '../data/inspection-history-model.mjs';

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
    assert.equal(month.branches.length,month.month==='2026-06'?2:5);
    assert.equal(month.invalid_dates.length,0);
    assert.equal(rowTotals(month.groups).items,month.cell_count);
    const cells=new Set();
    for(const group of month.groups){
      assert.ok(group.date.startsWith(month.month+'-'));
      for(const item of group.items){const id=group.sheet+'!'+item.cell;assert.ok(!cells.has(id),'No source cell is counted twice');cells.add(id);}
    }
    assert.equal(cells.size,month.cell_count);
  }
});

test('native calendar handles month length, starting weekday, and branch data dates',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const start=html.indexOf('    function renderInspectionCalendar() {'),end=html.indexOf('    function getClosestOrTodayInspectionDate()',start);
  const nodes=new Map();
  const get=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',innerText:'',textContent:''});return nodes.get(id);};
  const state={data:{inspection_schedule:{}},activeInspectionDate:null};
  const context=vm.createContext({AppState:state,document:{getElementById:get},lucide:{createIcons(){}},window:{dispatchEvent(){}},Event:class{},getDayOfWeek:()=>''});
  vm.runInContext(html.slice(start,end),context);
  for(const [key,days,offset] of [['2026-04-02',30,3],['2024-02-20',29,4],['2026-11-03',30,0]]){
    state.data.inspection_schedule={[key]:{type:'OFFICE',day:Number(key.slice(8)),office_name:'Example',transmission:[],wired:[]}};
    vm.runInContext('renderInspectionCalendar()',context);
    assert.ok(get('calendar-days-grid').innerHTML.includes(key));
    assert.equal((get('calendar-days-grid').innerHTML.match(/&nbsp;/g)||[]).length,offset);
    assert.equal((get('calendar-days-grid').innerHTML.match(/<span(?: class="font-bold text-xs")?>\d+<\/span>/g)||[]).length,days);
    assert.ok(get('inspection-list-title').innerText.startsWith(Number(key.slice(5,7))+'월'));
  }
});
