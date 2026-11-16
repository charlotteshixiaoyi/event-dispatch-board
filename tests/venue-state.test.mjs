import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {makeDocument} from './dom-fixture.mjs';
const root=new URL('../',import.meta.url);
const source=fs.readFileSync(new URL('board.js',root),'utf8');
const html=fs.readFileSync(new URL('index.html',root),'utf8');
const document=makeDocument(html);
const data=new Map();
const frames=new Map();
let frameId=0;
const scrollWindow={innerWidth:1280,innerHeight:800,scrollY:400,addEventListener(){},scrollBy({top}){this.scrollY=Math.max(0,this.scrollY+top);}};
const browserGlobals={window:scrollWindow,getComputedStyle:node=>({overflowY:node.style.overflowY||'visible'}),requestAnimationFrame:callback=>{frames.set(++frameId,callback);return frameId;},cancelAnimationFrame:id=>frames.delete(id)};
const nextFrame=time=>{const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(time);};
const context=vm.createContext({...browserGlobals,document,localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},navigator:{},location:{protocol:'file:'},Intl,Date,Set,Map,JSON,Math,Object,Number,String,Array,Blob,URL,setInterval(){},setTimeout(){},confirm:()=>true});
const run=code=>vm.runInContext(code,context);
const state=()=>JSON.parse(run('serializeBoard()'));
const el=id=>document.getElementById(id);
let passed=0;
function test(name,action){action();console.log('PASS',name);passed++;}
run(source);
test('no selected venue shows No view without rendering the map',()=>{
 assert.equal(state().teams.length,0);
 assert.equal(state().venue,'');
 el('venue-tab').click();
 assert.equal(el('dispatch-panel').hidden,true);
 assert.equal(el('venue-panel').hidden,false);
 assert.equal(el('venue-no-view').hidden,false);
 assert.equal(el('venue-content').hidden,true);
 assert.equal(document.querySelectorAll('.venue-floor-name').length,0);
});
test('selecting Bill Graham opens three standard levels and creates the eight main board posts',()=>{
 el('venue-select').value='bill-graham';el('venue-select').fire('change');
 assert.equal(el('venue-content').hidden,false);
 assert.equal(el('venue-no-view').hidden,true);
 assert.equal(document.querySelectorAll('.venue-floor-name').length,3);
 assert.equal(document.querySelectorAll('.venue-zone-surface').length,14);
 assert.equal(document.querySelector('[data-floor="3"]'),null);
 assert.equal(document.querySelectorAll('.post-name-select').length,8);
 assert.equal(el('custom-post-field').hidden,true);
 assert.equal(el('newLocationInput').required,false);
 assert.equal(el('venue-post-field').hidden,false);
 const labels=el('newVenuePostSelect').querySelectorAll('option').map(option=>option.textContent);
 for(const name of ['1st floor Grove','1st floor Polk','1st floor Larkin','2nd floor Grove','2nd floor Polk','2nd floor Larkin','1st roaming','2nd roaming'])assert.ok(labels.includes(name));
});
test('legacy backups and custom posts remain compatible',()=>{
 run(`replaceBoard(readBoard({teams:[{id:'t1',name:'ALPHA',status:'onscene',location:'loc_gate'},{id:'t2',name:'BRAVO',status:'roaming',location:'unassigned'}],locations:[{id:'loc_gate',name:'Gate A'}],notes:'Night shift'}))`);
 assert.equal(state().teams[0].location,'loc_gate');
 assert.equal(state().venue,'');
 run("changeVenue('bill-graham')");
 assert.equal(run('venuePostForTeam(teams[0])'),undefined);
 assert.ok(document.querySelector('[data-move-team="t1"]').textContent.includes('Not placed · Gate A'));
 assert.equal(el('shift-notes').value,'Night shift');
});
test('select and place updates shared state, roster, board post and log',()=>{
 document.querySelector('[data-move-team="t1"]').click();
 document.querySelector('[data-venue-post="venue-2-larkin"] polygon').click();
 assert.equal(state().teams[0].location,'venue-2-larkin');
 assert.equal(el('location-t1').value,'venue-2-larkin');
 assert.ok(document.querySelector('[data-location="venue-2-larkin"]').textContent.includes('ALPHA'));
 assert.ok(el('timestamp-list').textContent.includes('Gate A to 2nd floor Larkin'));
});
test('all floor-side destinations and the unified basement round-trip through backups',()=>{
 run("moveVenueTeam('t1','venue-b-basement')");
 assert.equal(run('readBoard(JSON.parse(serializeBoard())).teams[0].location'),'venue-b-basement');
 for(const level of ['1','2','3','4'])for(const side of ['polk','larkin','grove']){
  run(`moveVenueTeam('t1','venue-${level}-${side}')`);
  assert.equal(state().teams[0].location,`venue-${level}-${side}`);
  assert.equal(run(`readBoard(JSON.parse(serializeBoard())).teams[0].location`),`venue-${level}-${side}`);
 }
});
test('non-medical map moves preserve status, status timer and active meal break',()=>{
 el('venue-show-basement').checked=true;el('venue-show-basement').fire('change');
 run(`toggleMealBreak('t1')`);
 const before=state().teams[0];
 run(`moveVenueTeam('t1','venue-b-basement')`);
 const after=state().teams[0];
 assert.equal(after.status,before.status);
 assert.equal(after.statusSince,before.statusSince);
 assert.deepEqual(after.mealBreak,before.mealBreak);
 assert.ok(document.querySelector('[data-map-team="t1"]').getAttribute('data-meal-break'));
});
test('Main Medical updates status, zone and both views; Undo restores everything',()=>{
 const before=state();
 run(`moveVenueTeam('t1','clinic-zone')`);
 const team=state().teams[0];
 assert.equal(team.status,'atclinic');assert.equal(team.zone,'clinic-zone');
 assert.equal(el('location-t1').value,'clinic-zone');
 assert.ok(el('clinic-grid').textContent.includes('ALPHA'));
 assert.equal(run('venuePostForTeam(teams[0]).level'),'4');
 assert.equal(run('venuePostForTeam(teams[0]).side'),'Polk');
 run('undoChange()');
 assert.deepEqual(state(),before);
});
test('roster changes flow back to the map and leaving medical resets to roaming',()=>{
 run(`moveVenueTeam('t1','clinic-zone')`);
 const selector=el('location-t1');selector.value='venue-1-polk';selector.fire('change');
 assert.equal(state().teams[0].status,'roaming');
 assert.equal(document.querySelector('[data-map-team="t1"]').closest('[data-venue-post]').dataset.venuePost,'venue-1-polk');
 assert.equal(el('atclinic-total').textContent,'0');
});
test('meal-break actions work in the map inspector and remain on the board',()=>{
 run(`selectVenueTeam('t1')`);
 el('venue-meal-action').click();
 assert.ok(state().teams[0].mealBreak.returnedAt);
 assert.equal(el('venue-meal-action').hidden,true);
 assert.ok(el('meal-break-list').textContent.includes('Back early'));
});
test('keyboard placement and tab navigation use the same move operation',()=>{
 el('venue-show-third').checked=true;el('venue-show-third').fire('change');
 document.querySelector('[data-move-team="t2"]').fire('click',{detail:0});
 document.querySelector('[data-venue-post="venue-3-grove"] polygon').fire('keydown',{key:'Enter'});
 assert.equal(state().teams[1].location,'venue-3-grove');
 document.querySelector('.view-tabs').fire('keydown',{key:'Home'});
 assert.equal(el('dispatch-tab').getAttribute('aria-selected'),'true');
 document.querySelector('.view-tabs').fire('keydown',{key:'End'});
 assert.equal(el('venue-tab').getAttribute('aria-selected'),'true');
});
test('native drag/drop routes the correct unit and destination',()=>{
 const transfer={values:{},setData(k,v){this.values[k]=v;},getData(k){return this.values[k]||'';}};
 document.querySelector('[data-move-team="t2"]').fire('dragstart',{dataTransfer:transfer});
 document.querySelector('[data-venue-post="venue-b-basement"] polygon').fire('dragover',{dataTransfer:transfer});
 assert.ok(document.querySelector('[data-venue-post="venue-b-basement"]').classList.contains('is-drop-target'));
 document.querySelector('[data-venue-post="venue-b-basement"] polygon').fire('drop',{dataTransfer:transfer});
 assert.equal(state().teams[1].location,'venue-b-basement');
});
test('map marker pointer drag routes correctly and cancellation keeps the post',()=>{
 run('suppressVenueClickUntil = 0');
 document.querySelector('[data-map-team="t2"]').fire('pointerdown',{button:0,pointerId:1,clientX:10,clientY:10});
 document.hitTarget=document.querySelector('[data-venue-post="venue-4-larkin"] polygon');
 document.fire('pointermove',{pointerId:1,clientX:50,clientY:50});
 document.fire('pointerup',{pointerId:1,clientX:50,clientY:50});
 assert.equal(state().teams[1].location,'venue-4-larkin');
 document.querySelector('[data-map-team="t2"]').fire('pointerdown',{button:0,pointerId:2,clientX:10,clientY:10});
 document.hitTarget=null;
 document.fire('pointermove',{pointerId:2,clientX:60,clientY:60});
 document.fire('pointerup',{pointerId:2,clientX:60,clientY:60});
 assert.equal(state().teams[1].location,'venue-4-larkin');
});
test('floor filters, rotation, and reset do not mutate assignments',()=>{
 el('venue-show-third').checked=false;el('venue-show-third').fire('change');
 el('venue-show-basement').checked=false;el('venue-show-basement').fire('change');
 const before=state();
 document.querySelector('[data-venue-level="2"]').click();
 assert.equal(document.querySelectorAll('.venue-floor').length,1);
 assert.equal(document.querySelectorAll('.venue-zone-surface').length,4);
 el('venue-rotate-left').click();
 document.querySelector('[data-venue-level="4"]').click();
 assert.equal(document.querySelectorAll('.venue-zone-surface').length,4);
 assert.equal(document.querySelector('.venue-floor-name').textContent,'4th floor');
 el('venue-reset').click();
 assert.equal(document.querySelectorAll('.venue-floor').length,3);
 assert.deepEqual(state(),before);
});
test('unit filters do not remove teams; deletion clears the selected inspector',()=>{
 el('venue-search').value='BRAVO';el('venue-search').fire('input');
 assert.equal(document.querySelectorAll('.venue-unit').length,1);
 assert.equal(state().teams.length,2);
 el('venue-search').value='';el('venue-search').fire('input');
 run(`selectVenueTeam('t2');deleteTeam('t2')`);
 assert.equal(el('venue-selection').hidden,true);
 assert.equal(run('selectedVenueTeam'),null);
 run('undoChange()');
 assert.equal(state().teams.length,2);
});
test('saved reload preserves venue placement and has no duplicate map teams',()=>{
 const saved=JSON.parse(data.get('charlotte-dispatch-board-v1'));
 assert.deepEqual(saved,state());
 run(`replaceBoard(readBoard(JSON.parse(serializeBoard())))`);
 assert.equal(document.querySelectorAll('[data-map-team="t1"]').length,1);
 assert.equal(document.querySelectorAll('[data-map-team="t2"]').length,1);
});
test('invalid and unknown locations cannot create phantom assignments',()=>{
 const before=state();run(`moveVenueTeam('t1','bogus');moveTeam('t1','bogus')`);assert.deepEqual(state(),before);
 assert.equal(run(`readBoard({teams:[{id:'t9',name:'OLD',status:'roaming',location:'venue-9-polk'}],locations:[]}).teams[0].location`),'unassigned');
});
test('user call signs remain escaped in SVG, roster and unit list',()=>{
 el('newTeamInput').value='<img src=x onerror=alert(1)>';
 el('team-form').fire('submit');
 run(`moveVenueTeam(teams[teams.length-1].id,'venue-1-polk')`);
 assert.equal(document.querySelector('#venue-canvas img'),null);
 assert.ok(el('venue-canvas').innerHTML.includes('&lt;img'));
});
test('the first-tab roster can assign all eight primary posts before any map drag',()=>{
 run("setView('dispatch')");
 for(const id of run('[...defaultVenueBoardPosts]')){
  const select=el('location-t1');select.value=id;select.fire('change');
  assert.equal(state().teams[0].location,id);
  run("setView('venue')");
  assert.equal(document.querySelector('[data-map-team="t1"]').closest('[data-venue-post]').dataset.venuePost,id);
  run("setView('dispatch')");
 }
 run("setView('venue')");
});
test('changing a first-tab post dropdown moves its units and merges existing posts with one Undo',()=>{
 run("moveTeam('t1','venue-1-grove');moveTeam('t2','venue-1-grove')");
 const before=state();
 const select=document.querySelector('[data-location="venue-1-grove"] .post-name-select');
 select.value='venue-2-polk';select.fire('change');
 assert.equal(state().teams[0].location,'venue-2-polk');
 assert.equal(state().teams[1].location,'venue-2-polk');
 assert.equal(document.querySelector('[data-map-team="t1"]').closest('[data-venue-post]').dataset.venuePost,'venue-2-polk');
 assert.equal(document.querySelectorAll('[data-location="venue-2-polk"]').length,1);
 run('undoChange()');assert.deepEqual(state(),before);
});
test('a removed empty venue post can be added with the first-tab Post name dropdown',()=>{
 run("removeLocation('venue-2-larkin')");
 assert.equal(document.querySelector('[data-location="venue-2-larkin"]'),null);
 el('newVenuePostSelect').value='venue-2-larkin';el('location-form').fire('submit');
 assert.ok(document.querySelector('[data-location="venue-2-larkin"] .post-name-select'));
});
test('third-floor visibility is reversible and does not change assignments',()=>{
 const before=state();
 el('venue-show-third').checked=true;el('venue-show-third').fire('change');
 assert.ok(document.querySelector('[data-floor="3"]'));
 document.querySelector('[data-venue-level="3"]').click();
 assert.equal(document.querySelectorAll('.venue-floor').length,1);
 el('venue-show-third').checked=false;el('venue-show-third').fire('change');
 assert.equal(document.querySelectorAll('.venue-floor').length,3);
 assert.equal(document.querySelector('[data-floor="3"]'),null);
 assert.deepEqual(state(),before);
});
test('clearing the venue hides the map, preserves assignments, and is undoable',()=>{
 const before=state();
 el('venue-select').value='';el('venue-select').fire('change');
 assert.equal(el('venue-no-view').hidden,false);
 assert.equal(el('venue-content').hidden,true);
 assert.equal(document.querySelectorAll('.venue-map-unit').length,0);
 assert.deepEqual(state().teams,before.teams);
 assert.equal(el('venue-post-field').hidden,true);
 const frozen=state();run("moveVenueTeam('t1','venue-1-polk')");assert.deepEqual(state(),frozen);
 run('undoChange()');assert.deepEqual(state(),before);
 assert.equal(el('venue-select').value,'bill-graham');
});
test('venue selection and visible board posts survive save and restore',()=>{
 const saved=state();
 assert.equal(saved.venue,'bill-graham');
 assert.ok(saved.venueBoardPosts.includes('venue-2-larkin'));
 run('replaceBoard(readBoard(JSON.parse(serializeBoard())))');
 assert.deepEqual(state(),saved);
 assert.equal(el('venue-select').value,'bill-graham');
 assert.equal(document.querySelectorAll('.post-name-select').length,8);
});
test('every placed team has a ball with its name above it, including crowded posts',()=>{
 for(let i=0;i<9;i++)run(`teams.push({id:'textra${i}',name:'TEAM-${i}',status:'roaming',zone:'field-zone',location:'venue-1-grove',statusSince:Date.now()})`);
 run('refresh()');
 const visible=state().teams.filter(team=>team.zone==='clinic-zone'||(team.location.startsWith('venue-')&&!team.location.startsWith('venue-3-')));
 assert.equal(document.querySelectorAll('.venue-unit-ball').length,visible.length);
 for(const marker of document.querySelectorAll('.venue-map-unit')){
  assert.equal(marker.querySelector('rect'),null);
  assert.ok(Number(marker.querySelector('text').getAttribute('y'))<Number(marker.querySelector('.venue-unit-ball').getAttribute('cy')));
 }
 for(const copy of ['Place here','Concourse around the floor','Five levels. One shared dispatch board.'])assert.ok(!el('venue-content').textContent.includes(copy));
 assert.equal(document.querySelector('.venue-about'),null);
});
// Start a small board for fixed-post and status-interaction checks.
run(`replaceBoard(readBoard({teams:[{id:'t1',name:'FIXED-1',status:'roaming',location:'unassigned'},{id:'t2',name:'ROVER-2',status:'roaming',location:'unassigned'}],locations:[],venue:'bill-graham',notes:''}));setView('venue')`);
test('Pit is a fixed-post dropdown option and its teams stay inside Fixed posts',()=>{
 const groups=el('location-t1').querySelectorAll('optgroup');
 const fixedGroup=groups.find(group=>group.getAttribute('label')==='Fixed posts');
 assert.ok(fixedGroup.querySelector('option[value="venue-1-pit"]'));
 const selector=el('location-t1');selector.value='venue-1-pit';selector.fire('change');
 assert.equal(state().teams[0].location,'venue-1-pit');
 assert.equal(state().teams[0].status,'roaming');
 assert.equal(run('isFixedPost(teams[0])'),true);
 const pit=document.querySelector('.fixed-subpost[data-location="venue-1-pit"]');
 assert.equal(pit.parentElement.dataset.location,'pit-table-service');
 assert.equal(el('t1').closest('.field-location').dataset.location,'pit-table-service');
 assert.ok(pit.contains(el('t1')));
 assert.equal(document.querySelectorAll('.field-location[data-location="venue-1-pit"]').length,0);
 assert.equal(document.querySelector('[data-map-team="t1"]').closest('.venue-floor').dataset.floor,'1');
 assert.equal(document.querySelector('[data-map-team="t1"]').closest('[data-venue-post]').dataset.venuePost,'venue-1-pit');
 assert.equal(el('level-number').textContent,'1');
});
test('Pit is inside the first-floor auditorium at performer stage left',()=>{
 const pit=document.querySelector('.venue-destination[data-venue-post="venue-1-pit"] polygon');
 assert.ok(pit.getAttribute('aria-label').includes('stage left inside 1st floor auditorium'));
 const stage=document.querySelector('.venue-stage');
 const midpoint=poly=>{const points=poly.getAttribute('points').split(' ').map(pair=>pair.split(',').map(Number));return points.reduce((total,p)=>total+p[0],0)/points.length;};
 assert.ok(midpoint(pit)>midpoint(stage));
 assert.equal(pit.closest('.venue-floor').dataset.floor,'1');
 const polk=document.querySelector('.venue-destination[data-venue-post="venue-1-polk"] polygon');
 assert.ok(midpoint(pit)<midpoint(polk));
});
test('all fixed-post teams are marked pale and excluded from dispatch availability',()=>{
 run("moveTeam('t2','pit-table-service')");
 assert.equal(el('level-number').textContent,'0');
 assert.equal(el('t1').dataset.fixedPost,'true');
 assert.equal(el('t2').dataset.fixedPost,'true');
 assert.equal(document.querySelector('[data-move-team="t1"]').dataset.fixedPost,'true');
 assert.equal(document.querySelector('[data-map-team="t1"] .venue-unit-ball').getAttribute('fill'),'url(#venue-ball-fixed)');
 assert.equal(el('location-t1').value,'venue-1-pit');
 assert.ok(document.querySelector('[data-location="pit-table-service"] .location-count').textContent.includes('2 units'));
 assert.equal(run('venuePostForTeam(teams[1])'),undefined);
});
test('a fixed team on meal break uses the gray meal marker and returns to fixed-post gray afterward',()=>{
 run("toggleMealBreak('t1')");
 assert.equal(document.querySelector('[data-map-team="t1"] .venue-unit-ball').getAttribute('fill'),'url(#venue-ball-meal)');
 assert.equal(document.querySelector('[data-map-team="t1"]').dataset.mealBreak,'true');
 assert.equal(el('t1').dataset.mealBreak,'true');
 run("toggleMealBreak('t1')");
 assert.equal(document.querySelector('[data-map-team="t1"] .venue-unit-ball').getAttribute('fill'),'url(#venue-ball-fixed)');
 assert.equal(el('t1').dataset.mealBreak,undefined);
});
test('tapping map teams cycles status just like the board, including Medical and Undo',()=>{
 run('suppressVenueClickUntil=0');
 const original=state();
 for(const [status,choice] of [['onscene'],['roaming','roaming'],['onscene'],['transporting','transporting'],['atclinic'],['roaming']]){
  const before=state();
  document.querySelector('[data-map-team="t1"]').click();
  if(choice){
   assert.deepEqual(state(),before);
   assert.equal(el('call-actions').hidden,false);
   document.querySelector(`[data-call-status="${choice}"]`).click();
  }
  assert.equal(state().teams[0].status,status);
  assert.equal(el('status-t1').value,status);
  assert.equal(el('venue-selected-status').value,status);
  if(status==='atclinic'){
   assert.equal(document.querySelector('[data-map-team="t1"]').closest('[data-venue-post]').dataset.venuePost,'clinic-zone');
   assert.equal(el('t1').dataset.fixedPost,undefined);
  }else{
   assert.equal(document.querySelector('[data-map-team="t1"]').closest('[data-venue-post]').dataset.venuePost,'venue-1-pit');
   assert.equal(document.querySelector('[data-map-team="t1"] .venue-unit-ball').getAttribute('fill'),'url(#venue-ball-fixed)');
  }
 }
 assert.equal(state().handoffLog.length,original.handoffLog.length+6);
 assert.ok(state().teams[0].statusSince>=original.teams[0].statusSince);
 run('undoChange()');assert.equal(state().teams[0].status,'atclinic');
 run('undoChange();undoChange();undoChange();undoChange();undoChange()');assert.deepEqual(state(),original);
});
test('keyboard activation cycles status once and keeps focus when a team moves to Medical',()=>{
 run("venueFloor='1';renderVenue();suppressVenueClickUntil=0");
 document.querySelector('[data-map-team="t1"]').fire('keydown',{key:'Enter'});
 assert.equal(state().teams[0].status,'onscene');
 document.querySelector('[data-map-team="t1"]').fire('keydown',{key:' '});
 assert.equal(state().teams[0].status,'onscene');
 assert.equal(el('call-actions').hidden,false);
 assert.equal(document.activeElement.dataset.callStatus,'roaming');
 document.fire('keydown',{key:'Escape'});
 assert.equal(el('call-actions').hidden,true);
 assert.equal(document.activeElement.dataset.mapTeam,'t1');
 document.querySelector('[data-map-team="t1"]').fire('keydown',{key:'Enter'});
 document.querySelector('[data-call-status="transporting"]').click();
 assert.equal(state().teams[0].status,'transporting');
 document.querySelector('[data-map-team="t1"]').fire('keydown',{key:'Enter'});
 assert.equal(state().teams[0].status,'atclinic');
 assert.equal(document.activeElement.id,'venue-selected-status');
 run("updateStatus('t1','roaming');venueFloor='all';renderVenue()");
});
test('dragging a map ball moves its post without changing status or firing a tap afterward',()=>{
 document.querySelector('[data-map-team="t1"]').fire('pointerdown',{button:0,pointerId:9,clientX:10,clientY:10});
 document.hitTarget=document.querySelector('.venue-destination[data-venue-post="venue-1-roaming"] polygon');
 document.fire('pointermove',{pointerId:9,clientX:70,clientY:70});
 document.fire('pointerup',{pointerId:9,clientX:70,clientY:70});
 assert.equal(state().teams[0].location,'venue-1-roaming');
 assert.equal(state().teams[0].status,'roaming');
 assert.equal(run('isFixedPost(teams[0])'),false);
 assert.equal(el('level-number').textContent,'1');
 document.querySelector('[data-map-team="t1"]').click();
 assert.equal(state().teams[0].status,'roaming');
 run('suppressVenueClickUntil=0');
 document.querySelector('[data-map-team="t1"]').click();
 assert.equal(state().teams[0].status,'onscene');
});
test('first-tab dragging into Pit preserves its nested assignment and Undo',()=>{
 const before=state();
 const transfer={values:{},setData(k,v){this.values[k]=v;},getData(k){return this.values[k]||'';}};
 el('t1').fire('dragstart',{dataTransfer:transfer});
 document.querySelector('.fixed-subpost[data-location="venue-1-pit"]').fire('drop',{dataTransfer:transfer});
 assert.equal(state().teams[0].location,'venue-1-pit');
 assert.equal(state().teams[0].status,'onscene');
 assert.equal(document.querySelector('[data-map-team="t1"]').dataset.fixedPost,'true');
 run('undoChange()');assert.deepEqual(state(),before);
});
test('choosing Pit on a post heading moves the whole group into Fixed posts',()=>{
 run("moveTeam('t1','venue-1-grove');moveTeam('t2','venue-1-grove')");
 const before=state();
 const select=document.querySelector('[data-location="venue-1-grove"] .post-name-select');
 select.value='venue-1-pit';select.fire('change');
 for(const team of state().teams){
  assert.equal(team.location,'venue-1-pit');
  assert.equal(el(team.id).closest('.field-location').dataset.location,'pit-table-service');
 }
 assert.equal(document.querySelectorAll('.field-location[data-location="venue-1-pit"]').length,0);
 assert.equal(document.querySelectorAll('.fixed-subpost[data-location="venue-1-pit"]').length,1);
 assert.equal(state().venueBoardPosts.includes('venue-1-pit'),false);
 assert.equal(el('level-number').textContent,'0');
 const saved=JSON.parse(run('JSON.stringify(readBoard(JSON.parse(serializeBoard())))'));
 assert.equal(saved.teams[0].location,'venue-1-pit');
 assert.equal(saved.teams[1].location,'venue-1-pit');
 run('undoChange()');assert.deepEqual(state(),before);
});
test('roaming teams sit in each floor center with one label and clear Grove frontage',()=>{
 run("moveTeam('t1','venue-1-roaming');moveTeam('t2','venue-2-roaming');updateStatus('t1','roaming')");
 const points=node=>node.getAttribute('points').split(' ').map(pair=>pair.split(',').map(Number));
 for(const level of ['1','2']){
  const roaming=document.querySelector(`.venue-destination[data-venue-post="venue-${level}-roaming"]`);
  const grove=document.querySelector(`.venue-destination[data-venue-post="venue-${level}-grove"]`);
  assert.equal(roaming.dataset.venueSide,'Roaming');
  assert.equal(grove.dataset.venueSide,'Grove');
  const r=points(roaming.querySelector('polygon')),g=points(grove.querySelector('polygon'));
  assert.ok(roaming.classList.contains('venue-roaming'));
  const floor=roaming.closest('.venue-floor');
  const slab=points(floor.querySelector('.venue-slab'));
  const center=slab.reduce((sum,p)=>[sum[0]+p[0]/4,sum[1]+p[1]/4],[0,0]);
  const ball=floor.querySelector(`[data-map-team="${level==='1'?'t1':'t2'}"] .venue-unit-ball`);
  assert.ok(Math.abs(Number(ball.getAttribute('cx'))-center[0])<.1);
  assert.ok(Math.abs(Number(ball.getAttribute('cy'))-center[1])<.1);
  assert.equal(floor.querySelectorAll('.venue-side-label').filter(node=>node.textContent==='ROAMING').length,1);
  assert.ok(r[2][1]<g[2][1]&&r[3][1]<g[3][1]);
  assert.ok(!floor.textContent.includes('Covers Grove'));
 }
 assert.equal(run('venuePostForTeam(teams[0]).side'),'Roaming');
 assert.equal(run('venuePostForTeam(teams[1]).side'),'Roaming');
});
test('the Medical shortcut is removed while the Medical map destination remains',()=>{
 assert.equal(el('locate-medical'),null);
 assert.equal(document.querySelector('.medical-shortcut'),null);
 assert.ok(document.querySelector('.venue-destination[data-venue-post="clinic-zone"] polygon'));
});
test('Basement is one map destination and has no street-side dropdowns',()=>{
 el('venue-show-basement').checked=true;el('venue-show-basement').fire('change');
 document.querySelector('[data-venue-level="b"]').click();
 assert.equal(document.querySelectorAll('.venue-zone-surface').length,1);
 assert.equal(document.querySelector('.venue-destination').dataset.venuePost,'venue-b-basement');
 const labels=el('venue-canvas').querySelectorAll('.venue-side-label').map(node=>node.textContent);
 assert.deepEqual(labels,['BASEMENT']);
 const options=el('location-t1').querySelectorAll('option');
 assert.equal(options.filter(option=>option.textContent==='Basement').length,1);
 for(const side of ['Polk','Larkin','Grove'])assert.ok(!options.some(option=>option.textContent==='Basement '+side));
 const select=el('location-t1');select.value='venue-b-basement';select.fire('change');
 assert.equal(state().teams[0].location,'venue-b-basement');
 assert.equal(document.querySelector('[data-map-team="t1"]').closest('[data-venue-post]').dataset.venuePost,'venue-b-basement');
});
test('old basement side assignments and board posts merge without losing teams or timers',()=>{
 const before=Date.now()-10000;
 const legacy={teams:['polk','larkin','grove'].map((side,i)=>({id:'told'+i,name:'OLD-'+i,status:'roaming',location:'venue-b-'+side,statusSince:before})),locations:[],venue:'bill-graham',additionalVenueLocations:['b'],venueBoardPosts:['venue-b-polk','venue-b-larkin','venue-b-grove']};
 run(`replaceBoard(readBoard(${JSON.stringify(legacy)}))`);
 assert.equal(state().teams.length,3);
 assert.deepEqual(state().venueBoardPosts,['venue-b-basement']);
 for(const team of state().teams){assert.equal(team.location,'venue-b-basement');assert.equal(team.statusSince,before);}
 assert.equal(document.querySelectorAll('[data-location="venue-b-basement"]').length,1);
 assert.equal(document.querySelectorAll('.venue-map-unit').length,3);
 assert.deepEqual(state().teams.map(team=>team.name),['OLD-0','OLD-1','OLD-2']);
});
test('Basement accepts and displays a large team group without a team limit',()=>{
 const many={teams:Array.from({length:80},(_,i)=>({id:'tbase'+i,name:'BASE-'+i,status:'roaming',location:i?'venue-b-basement':'unassigned'})),locations:[],venue:'bill-graham',additionalVenueLocations:['b']};
 run(`replaceBoard(readBoard(${JSON.stringify(many)}))`);
 assert.equal(state().teams.length,80);
 document.querySelector('[data-move-team="tbase0"]').click();
 run('suppressVenueClickUntil=0');
 document.querySelector('.venue-destination[data-venue-post="venue-b-basement"] polygon').click();
 assert.equal(state().teams[0].location,'venue-b-basement');
 assert.equal(document.querySelectorAll('.venue-map-unit').length,80);
 assert.equal(document.querySelectorAll('.venue-unit-ball').length,80);
 assert.equal(document.querySelectorAll('[data-location="venue-b-basement"] .team-badge').length,80);
 const polygon=document.querySelector('.venue-destination[data-venue-post="venue-b-basement"] polygon').getAttribute('points').split(' ').map(pair=>pair.split(',').map(Number));
 for(const ball of document.querySelectorAll('.venue-unit-ball')){
  const point=[Number(ball.getAttribute('cx')),Number(ball.getAttribute('cy'))];
  const signs=polygon.map((a,i)=>{const b=polygon[(i+1)%polygon.length];return(b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0]);});
  assert.ok(signs.every(value=>value>=0)||signs.every(value=>value<=0),'Basement ball must remain inside its floor');
 }

 assert.ok(document.querySelector('.venue-floor-detail').textContent.includes('80 units'));
 const restored=JSON.parse(run('JSON.stringify(readBoard(JSON.parse(serializeBoard())))'));
 assert.equal(restored.teams.length,80);
 assert.ok(restored.teams.every(team=>team.location==='venue-b-basement'));
});
// Table Service shares the fixed-post behavior and uses the corrected street orientation.
run(`replaceBoard(readBoard({teams:[{id:'t1',name:'TABLE-1',status:'roaming',location:'unassigned'},{id:'t2',name:'LARKIN-2',status:'roaming',location:'venue-2-larkin'},{id:'t3',name:'POLK-2',status:'transporting',location:'venue-2-polk'}],locations:[],venue:'bill-graham'}));venueFloor='all';additionalVenueLocations=[];venueAngle=18;setView('venue')`);
test('Table Service is a fixed-post dropdown option and teams stay nested under Fixed posts',()=>{
 const fixed=el('location-t1').querySelectorAll('optgroup').find(group=>group.getAttribute('label')==='Fixed posts');
 assert.ok(fixed.querySelector('option[value="venue-1-table-service"]'));
 const selector=el('location-t1');selector.value='venue-1-table-service';selector.fire('change');
 assert.equal(state().teams[0].location,'venue-1-table-service');
 assert.equal(state().teams[0].status,'roaming');
 assert.equal(run('isFixedPost(teams[0])'),true);
 const group=document.querySelector('.fixed-subpost[data-location="venue-1-table-service"]');
 assert.equal(group.parentElement.dataset.location,'pit-table-service');
 assert.ok(group.contains(el('t1')));
 assert.equal(document.querySelectorAll('.field-location[data-location="venue-1-table-service"]').length,0);
 assert.equal(el('t1').dataset.fixedPost,'true');
 assert.equal(document.querySelector('[data-map-team="t1"] .venue-unit-ball').getAttribute('fill'),'url(#venue-ball-fixed)');
 assert.equal(el('level-number').textContent,'1');
});
test('Table Service is on first-floor Grove at the end nearest Larkin',()=>{
 const table=document.querySelector('.venue-destination[data-venue-post="venue-1-table-service"]');
 assert.equal(table.dataset.venueSide,'Grove');
 assert.equal(table.closest('.venue-floor').dataset.floor,'1');
 assert.ok(table.querySelector('polygon').getAttribute('aria-label').includes('1st floor Grove nearest Larkin'));
 const points=node=>node.getAttribute('points').split(' ').map(pair=>pair.split(',').map(Number));
 const mid=id=>{const p=points(document.querySelector(`.venue-destination[data-venue-post="${id}"] polygon`));return p.reduce((sum,point)=>sum+point[0],0)/p.length;};
 const tableX=mid('venue-1-table-service'),larkinX=mid('venue-1-larkin'),polkX=mid('venue-1-polk');
 assert.ok(larkinX<tableX&&tableX<mid('venue-1-grove'));
 assert.ok(Math.abs(tableX-larkinX)<Math.abs(mid('venue-1-grove')-larkinX));
 assert.ok(Math.abs(tableX-larkinX)<Math.abs(tableX-polkX));
 const t=points(table.querySelector('polygon')),g=points(document.querySelector('.venue-destination[data-venue-post="venue-1-grove"] polygon'));
 const [a,b]=[g[2],g[3]];
 const distance=p=>Math.abs((b[1]-a[1])*p[0]-(b[0]-a[0])*p[1]+b[0]*a[1]-b[1]*a[0])/Math.hypot(b[1]-a[1],b[0]-a[0]);
 assert.ok(distance(t[2])<.25&&distance(t[3])<.25);
 assert.equal(document.querySelector('[data-map-team="t1"]').closest('[data-venue-post]').dataset.venuePost,'venue-1-table-service');
});
test('Table Service supports map drops, Undo, backups, status taps, and meal-break styling',()=>{
 const selector=el('location-t1');selector.value='venue-1-grove';selector.fire('change');
 const before=state();
 const transfer={values:{},setData(k,v){this.values[k]=v;},getData(k){return this.values[k]||'';}};
 document.querySelector('[data-move-team="t1"]').fire('dragstart',{dataTransfer:transfer});
 document.querySelector('.venue-destination[data-venue-post="venue-1-table-service"] polygon').fire('drop',{dataTransfer:transfer});
 assert.equal(state().teams[0].location,'venue-1-table-service');
 assert.equal(state().teams[0].status,'roaming');
 assert.equal(state().teams[0].statusSince,before.teams[0].statusSince);
 assert.equal(el('location-t1').value,'venue-1-table-service');
 assert.equal(el('t1').closest('.field-location').dataset.location,'pit-table-service');
 const restored=JSON.parse(run('JSON.stringify(readBoard(JSON.parse(serializeBoard())))'));
 assert.equal(restored.teams[0].location,'venue-1-table-service');
 run('undoChange()');assert.deepEqual(state(),before);
 run("moveTeam('t1','venue-1-table-service');suppressVenueClickUntil=0");
 document.querySelector('[data-map-team="t1"]').click();
 assert.equal(state().teams[0].status,'onscene');
 assert.equal(state().teams[0].location,'venue-1-table-service');
 assert.equal(document.querySelector('[data-map-team="t1"] .venue-unit-ball').getAttribute('fill'),'url(#venue-ball-fixed)');
 run("toggleMealBreak('t1')");
 assert.equal(document.querySelector('[data-map-team="t1"] .venue-unit-ball').getAttribute('fill'),'url(#venue-ball-meal)');
 run("toggleMealBreak('t1')");
 assert.equal(document.querySelector('[data-map-team="t1"] .venue-unit-ball').getAttribute('fill'),'url(#venue-ball-fixed)');
});
test('Larkin is left and Polk is right on every floor, including assigned units and Main Medical',()=>{
 const before=state();
 const center=id=>{const points=document.querySelector(`.venue-destination[data-venue-post="${id}"] polygon`).getAttribute('points').split(' ').map(pair=>pair.split(',').map(Number));return points.reduce((sum,p)=>sum+p[0],0)/points.length;};
 for(const angle of [-30,18,42]){
  run(`additionalVenueLocations=['3'];venueFloor='all';venueAngle=${angle};renderVenue()`);
  for(const level of ['1','2','3','4'])assert.ok(center(`venue-${level}-larkin`)<center(`venue-${level}-polk`));
  assert.ok(Math.abs(center('clinic-zone')-center('venue-4-polk'))<Math.abs(center('clinic-zone')-center('venue-4-larkin')));
  const larkin=Number(document.querySelector('[data-map-team="t2"] .venue-unit-ball').getAttribute('cx'));
  const polk=Number(document.querySelector('[data-map-team="t3"] .venue-unit-ball').getAttribute('cx'));
  assert.ok(larkin<polk);
  assert.equal(el('location-t2').value,'venue-2-larkin');
  assert.equal(el('location-t3').value,'venue-2-polk');
 }
 run("additionalVenueLocations=[];venueAngle=18;renderVenue()");
 assert.deepEqual(state(),before);
});
// Pit position is a saved venue setting shared by the board and map controls.
run(`replaceBoard(readBoard({teams:[{id:'tp1',name:'PIT-1',status:'onscene',location:'venue-1-pit'},{id:'tp2',name:'PIT-2',status:'roaming',location:'venue-1-pit',mealBreak:{startedAt:Date.now()-60000,returnedAt:null}},{id:'tt1',name:'TABLE-1',status:'roaming',location:'venue-1-table-service'}],locations:[],venue:'bill-graham',notes:'Pit positioning'}));venueFloor='all';venueAngle=18;setView('venue')`);
const pitCenter=()=>{const points=document.querySelector('.venue-destination[data-venue-post="venue-1-pit"] polygon').getAttribute('points').split(' ').map(pair=>pair.split(',').map(Number));return points.reduce((sum,p)=>sum+p[0],0)/points.length;};
const sideCenter=street=>{const points=document.querySelector(`.venue-destination[data-venue-post="venue-1-${street}"] polygon`).getAttribute('points').split(' ').map(pair=>pair.split(',').map(Number));return points.reduce((sum,p)=>sum+p[0],0)/points.length;};
test('Pit defaults to stage left near Polk and both selectors agree',()=>{
 assert.equal(state().pitSide,'stage-left');
 assert.equal(el('map-pit-side').value,'stage-left');
 assert.equal(el('board-pit-side').value,'stage-left');
 assert.ok(Math.abs(pitCenter()-sideCenter('polk'))<Math.abs(pitCenter()-sideCenter('larkin')));
 assert.ok(document.querySelector('.venue-destination[data-venue-post="venue-1-pit"] polygon').getAttribute('aria-label').includes('near Polk'));
});
test('map selector moves the Pit area and every Pit team to stage right near Larkin',()=>{
 const before=state();
 const originalX=Number(document.querySelector('[data-map-team="tp1"] .venue-unit-ball').getAttribute('cx'));
 const tableX=Number(document.querySelector('[data-map-team="tt1"] .venue-unit-ball').getAttribute('cx'));
 el('map-pit-side').value='stage-right';el('map-pit-side').fire('change');
 assert.equal(state().pitSide,'stage-right');
 assert.equal(el('board-pit-side').value,'stage-right');
 assert.ok(Math.abs(pitCenter()-sideCenter('larkin'))<Math.abs(pitCenter()-sideCenter('polk')));
 assert.ok(Number(document.querySelector('[data-map-team="tp1"] .venue-unit-ball').getAttribute('cx'))<originalX);
 assert.ok(Number(document.querySelector('[data-map-team="tp2"] .venue-unit-ball').getAttribute('cx'))<500);
 assert.equal(Number(document.querySelector('[data-map-team="tt1"] .venue-unit-ball').getAttribute('cx')),tableX);
 assert.deepEqual(state().teams,before.teams);
 assert.deepEqual(state().handoffLog,before.handoffLog);
 assert.equal(state().notes,before.notes);
 assert.equal(document.querySelector('[data-map-team="tp1"] .venue-unit-ball').getAttribute('fill'),'url(#venue-ball-fixed)');
 assert.equal(document.querySelector('[data-map-team="tp2"] .venue-unit-ball').getAttribute('fill'),'url(#venue-ball-meal)');
 assert.ok(document.querySelector('.venue-destination[data-venue-post="venue-1-pit"] polygon').getAttribute('aria-label').includes('stage right inside 1st floor auditorium, near Larkin'));
 for(const side of ['stage-left','stage-right'])for(const angle of [-30,18,42]){
  run(`changePitSide('${side}');venueAngle=${angle};renderVenue()`);
  const polygon=document.querySelector('.venue-destination[data-venue-post="venue-1-pit"] polygon').getAttribute('points').split(' ').map(pair=>pair.split(',').map(Number));
  for(const id of ['tp1','tp2']){
   const ball=document.querySelector(`[data-map-team="${id}"] .venue-unit-ball`);
   const point=[Number(ball.getAttribute('cx')),Number(ball.getAttribute('cy'))];
   const signs=polygon.map((a,i)=>{const b=polygon[(i+1)%polygon.length];return(b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0]);});
   assert.ok(signs.every(value=>value>=0)||signs.every(value=>value<=0));
  }
  const near=side==='stage-left'?'polk':'larkin',far=side==='stage-left'?'larkin':'polk';
  assert.ok(Math.abs(pitCenter()-sideCenter(near))<Math.abs(pitCenter()-sideCenter(far)));
 }
 run('venueAngle=18;renderVenue()');

});
test('first-tab selector returns Pit to stage left and Undo restores stage right',()=>{
 const before=state();run("setView('dispatch')");
 el('board-pit-side').value='stage-left';el('board-pit-side').fire('change');
 assert.equal(state().pitSide,'stage-left');
 assert.equal(el('map-pit-side').value,'stage-left');
 assert.equal(document.activeElement.id,'board-pit-side');
 run("setView('venue')");
 assert.ok(Math.abs(pitCenter()-sideCenter('polk'))<Math.abs(pitCenter()-sideCenter('larkin')));
 run('undoChange()');assert.deepEqual(state(),before);
 assert.equal(el('board-pit-side').value,'stage-right');
 assert.equal(el('map-pit-side').value,'stage-right');
});
test('Pit side is saved, restored from backups, and loaded on app startup',()=>{
 const saved=state();
 assert.equal(JSON.parse(data.get('charlotte-dispatch-board-v1')).pitSide,'stage-right');
 run('replaceBoard(readBoard(JSON.parse(serializeBoard())))');assert.deepEqual(state(),saved);
 const startupDocument=makeDocument(html);
 const startupData=new Map([['charlotte-dispatch-board-v1',JSON.stringify(saved)]]);
 const startupContext=vm.createContext({...browserGlobals,document:startupDocument,localStorage:{getItem:key=>startupData.get(key)??null,setItem:(key,value)=>startupData.set(key,value)},navigator:{},location:{protocol:'file:'},Intl,Date,Set,Map,JSON,Math,Object,Number,String,Array,Blob,URL,setInterval(){},setTimeout(){},confirm:()=>true});
 vm.runInContext(source,startupContext);
 assert.equal(startupDocument.getElementById('board-pit-side').value,'stage-right');
 assert.equal(startupDocument.getElementById('map-pit-side').value,'stage-right');
 assert.deepEqual(JSON.parse(startupData.get('charlotte-dispatch-board-v1')),saved);
});
test('Pit configuration survives camera reset and routine board actions; old backups default left',()=>{
 el('venue-reset').click();assert.equal(state().pitSide,'stage-right');
 const before=state();
 run("changePitSide('bad');changePitSide('stage-right')");assert.deepEqual(state(),before);
 for(const value of [undefined,'invalid',null,['stage-right']]){
  const backup={teams:[],locations:[],pitSide:value};
  assert.equal(run(`readBoard(${JSON.stringify(backup)}).pitSide`),'stage-left');
 }
 el('demo-board').click();assert.equal(state().pitSide,'stage-right');
 el('clear-board').click();assert.equal(state().pitSide,'stage-right');
 assert.equal(el('board-pit-side').value,'stage-right');
 run('undoChange()');assert.equal(state().pitSide,'stage-right');
});
test('Unassigned stays last after custom, venue, occupied, restored and undone posts',()=>{
 const last=()=>document.querySelectorAll('#field-locations .field-location').at(-1).dataset.location;
 run("replaceBoard(readBoard({teams:[],locations:[]}))");
 assert.equal(last(),'unassigned');
 el('newLocationInput').value='Back gate';el('location-form').fire('submit');
 assert.equal(last(),'unassigned');
 run("changeVenue('bill-graham');toggleAdditionalVenueLocation('outside',true);toggleAdditionalVenueLocation('b',true);toggleAdditionalVenueLocation('3',true)");
 assert.equal(last(),'unassigned');
 run("teams.push({id:'tedge',name:'EDGE',status:'roaming',zone:'field-zone',location:'venue-4-grove',statusSince:Date.now()});refresh()");
 assert.equal(last(),'unassigned');
 run('replaceBoard(readBoard(JSON.parse(serializeBoard())));undoChange()');
 assert.equal(last(),'unassigned');
 run("changeVenue('')");assert.equal(last(),'unassigned');
});
test('one additional-location menu offers Outside of Venue, Basement and Third floor, all off by default',()=>{
 run("replaceBoard(readBoard({teams:[{id:'topt',name:'OPTIONAL',status:'onscene',location:'unassigned'}],locations:[],venue:'bill-graham'}));setView('venue')");
 const menu=el('venue-additional-locations');
 assert.equal(menu.querySelector('summary').textContent,'Add additional location');
 assert.deepEqual(menu.querySelectorAll('label').map(label=>label.textContent),['Outside of Venue','Basement','Third floor']);
 for(const id of ['venue-show-outside','venue-show-basement','venue-show-third'])assert.equal(el(id).checked,false);
 for(const level of ['b','3'])assert.equal(document.querySelector(`[data-floor="${level}"]`),null);
 assert.equal(document.querySelector('.venue-outside-area'),null);
});
test('each optional location can be enabled independently and appears before Unassigned on the board',()=>{
 for(const [toggle,level,post] of [['outside','outside','venue-outside'],['basement','b','venue-b-basement'],['third','3','venue-3-grove']]){
  el(`venue-show-${toggle}`).checked=true;el(`venue-show-${toggle}`).fire('change');
  assert.ok(document.querySelector(`.venue-destination[data-venue-post="${post}"] .venue-zone-surface`));
  assert.ok(document.querySelector(`[data-location="${post}"]`));
  assert.ok(state().additionalVenueLocations.includes(level));
  assert.equal(document.querySelectorAll('#field-locations .field-location').at(-1).dataset.location,'unassigned');
 }
 assert.equal(document.querySelectorAll('.venue-floor').length,5);
});
test('Outside of Venue accepts native map drops, keyboard moves and dispatch-board drops',()=>{
 const transfer={values:{},setData(k,v){this.values[k]=v;},getData(k){return this.values[k]||'';}};
 const before=state().teams[0];
 document.querySelector('[data-move-team="topt"]').fire('dragstart',{clientX:400,clientY:300,dataTransfer:transfer});
 document.querySelector('.venue-destination[data-venue-post="venue-outside"] .venue-zone-surface').fire('dragover',{dataTransfer:transfer});
 assert.ok(document.querySelector('.venue-destination[data-venue-post="venue-outside"]').classList.contains('is-drop-target'));
 document.querySelector('.venue-destination[data-venue-post="venue-outside"] .venue-zone-surface').fire('drop',{dataTransfer:transfer});
 assert.equal(state().teams[0].location,'venue-outside');
 assert.equal(state().teams[0].status,before.status);
 assert.equal(state().teams[0].statusSince,before.statusSince);
 assert.equal(document.querySelector('[data-map-team="topt"]').closest('[data-venue-post]').dataset.venuePost,'venue-outside');
 assert.ok(document.querySelector('[data-location="venue-outside"]').textContent.includes('OPTIONAL'));
 run("moveTeam('topt','venue-1-polk');selectVenueTeam('topt');suppressVenueClickUntil=0");
 document.querySelector('.venue-destination[data-venue-post="venue-outside"] .venue-zone-surface').fire('keydown',{key:'Enter'});
 assert.equal(state().teams[0].location,'venue-outside');
 assert.equal(document.activeElement.tagName,'ellipse');
 run("moveTeam('topt','unassigned');setView('dispatch')");
 el('topt').fire('dragstart',{clientX:400,clientY:300,dataTransfer:transfer});
 document.querySelector('[data-location="venue-outside"]').fire('drop',{dataTransfer:transfer});
 assert.equal(state().teams[0].location,'venue-outside');
 assert.equal(run('dragScroll'),null);
 run("setView('venue')");
});
test('hiding optional locations preserves assignments and resets a hidden focused floor',()=>{
 run("toggleMealBreak('topt')");
 const before=state().teams[0];
 document.querySelector('[data-venue-level="b"]').click();
 el('venue-show-basement').checked=false;el('venue-show-basement').fire('change');
 assert.equal(document.querySelector('[data-venue-level="b"]'),null);
 assert.equal(document.querySelector('[data-venue-level="all"]').getAttribute('aria-pressed'),'true');
 el('venue-show-outside').checked=false;el('venue-show-outside').fire('change');
 assert.equal(document.querySelector('.venue-outside-area'),null);
 assert.deepEqual(state().teams[0],before);
 assert.ok(document.querySelector('[data-location="venue-outside"] .team-badge'));
 assert.equal(el('venue-outside-label').textContent,'Outside of Venue (1)');
 run('undoChange()');
 assert.ok(document.querySelector('.venue-outside-area [data-map-team="topt"]'));
 assert.ok(document.querySelector('[data-map-team="topt"]').getAttribute('data-meal-break'));
});
test('optional locations and outside assignments survive backups, startup and camera reset',()=>{
 const saved=state();
 const restored=JSON.parse(run('JSON.stringify(readBoard(JSON.parse(serializeBoard())))'));
 assert.deepEqual(restored,saved);
 const startupDocument=makeDocument(html);
 const startupData=new Map([['charlotte-dispatch-board-v1',JSON.stringify(saved)]]);
 const startupContext=vm.createContext({...browserGlobals,document:startupDocument,localStorage:{getItem:key=>startupData.get(key)??null,setItem:(key,value)=>startupData.set(key,value)},navigator:{},location:{protocol:'file:'},Intl,Date,Set,Map,JSON,Math,Object,Number,String,Array,Blob,URL,setInterval(){},setTimeout(){},confirm:()=>true});
 vm.runInContext(source,startupContext);
 vm.runInContext("setView('venue')",startupContext);
 assert.equal(startupDocument.getElementById('venue-show-outside').checked,true);
 assert.equal(startupDocument.getElementById('venue-show-third').checked,true);
 assert.equal(startupDocument.getElementById('venue-show-basement').checked,false);
 assert.ok(startupDocument.querySelector('.venue-outside-area [data-map-team="topt"]'));
 el('venue-reset').click();assert.deepEqual(state(),saved);
 for(const value of [undefined,null,'outside',['outside','outside','invalid',3]]){
  const expected=Array.isArray(value)?['outside']:[];
  assert.deepEqual(JSON.parse(run(`JSON.stringify(readBoard(${JSON.stringify({teams:[],locations:[],additionalVenueLocations:value})}).additionalVenueLocations)`)),expected);
 }
});
test('a crowded Outside of Venue platform grows to keep every team inside its ellipse',()=>{
 run("replaceBoard(readBoard({teams:Array.from({length:24},(_,i)=>({id:'tout'+i,name:'OUT-'+i,status:'roaming',location:'venue-outside'})),locations:[],venue:'bill-graham',additionalVenueLocations:['outside']}))");
 const ellipse=document.querySelector('.venue-destination[data-venue-post="venue-outside"] ellipse');
 const [cx,cy,rx,ry]=['cx','cy','rx','ry'].map(name=>Number(ellipse.getAttribute(name)));
 const area=ellipse.closest('.venue-outside-area');
 const rim=area.querySelector('.venue-slab-edge');
 assert.equal(area.querySelector('polygon'),null);
 assert.equal(rim.tagName,'ellipse');
 assert.equal(Number(rim.getAttribute('cy')),cy+7);
 assert.equal(document.querySelectorAll('.venue-outside-area .venue-unit-ball').length,24);
 for(const ball of document.querySelectorAll('.venue-outside-area .venue-unit-ball')){
  const x=Number(ball.getAttribute('cx')),y=Number(ball.getAttribute('cy'));
  for(const dx of [-8,8])for(const dy of [-8,8])assert.ok(((x+dx-cx)/rx)**2+((y+dy-cy)/ry)**2<1);
 }
});
test('native team dragging scrolls down and up at viewport edges, keeps scrolling while held, and stops in the middle',()=>{
 const transfer={setData(){}};
 const before=state();
 document.hitTarget=el('tout0');
 scrollWindow.scrollY=400;
 el('tout0').fire('dragstart',{clientX:300,clientY:790,dataTransfer:transfer});
 nextFrame(0);assert.ok(scrollWindow.scrollY>400);
 const held=scrollWindow.scrollY;nextFrame(16);assert.ok(scrollWindow.scrollY>held);
 document.fire('dragover',{clientX:300,clientY:10});
 const down=scrollWindow.scrollY;nextFrame(32);assert.ok(scrollWindow.scrollY<down);
 document.fire('dragover',{clientX:300,clientY:400});
 const middle=scrollWindow.scrollY;nextFrame(48);assert.equal(scrollWindow.scrollY,middle);
 el('tout0').fire('dragend');
 assert.equal(frames.size,0);assert.equal(run('dragScroll'),null);
 assert.deepEqual(state(),before);
});
test('dropping or cancelling a native drag stops all further scrolling',()=>{
 for(const type of ['drop','dragend']){
  el('tout0').fire('dragstart',{clientX:300,clientY:790,dataTransfer:{setData(){}}});
  nextFrame(0);
  document.fire(type);
  const position=scrollWindow.scrollY;nextFrame(16);
  assert.equal(scrollWindow.scrollY,position);assert.equal(frames.size,0);
 }
 el('tout0').fire('dragstart',{clientX:300,clientY:790,dataTransfer:{setData(){}}});
 document.fire('keydown',{key:'Escape'});assert.equal(frames.size,0);
});
test('a scrollable unit list consumes edge scrolling before the page',()=>{
 const list=el('venue-unit-list');
 list.scrollHeight=1200;list.clientHeight=300;list.scrollTop=200;list.style.overflowY='auto';
 list.getBoundingClientRect=()=>({top:200,bottom:500});
 document.hitTarget=document.querySelector('[data-move-team="tout0"]');
 const page=scrollWindow.scrollY;
 document.hitTarget.fire('dragstart',{clientX:300,clientY:490,dataTransfer:{setData(){}}});
 nextFrame(0);assert.ok(list.scrollTop>200);assert.equal(scrollWindow.scrollY,page);
 document.fire('dragover',{clientX:300,clientY:210});
 const down=list.scrollTop;nextFrame(16);assert.ok(list.scrollTop<down);
 document.fire('dragend');
 list.scrollHeight=0;list.clientHeight=0;document.hitTarget=null;
});
test('pointer dragging a map marker scrolls the page and still drops into Outside of Venue',()=>{
 run("moveTeam('tout0','venue-1-polk');suppressVenueClickUntil=0");
 const before=state().teams[0];
 document.querySelector('[data-map-team="tout0"]').fire('pointerdown',{button:0,pointerId:90,clientX:300,clientY:300});
 document.hitTarget=document.querySelector('.venue-destination[data-venue-post="venue-outside"] .venue-zone-surface');
 document.fire('pointermove',{pointerId:90,clientX:300,clientY:790});
 const start=scrollWindow.scrollY;nextFrame(0);assert.ok(scrollWindow.scrollY>start);
 document.fire('pointermove',{pointerId:90,clientX:300,clientY:10});
 const down=scrollWindow.scrollY;nextFrame(16);assert.ok(scrollWindow.scrollY<down);
 document.fire('pointerup',{pointerId:90,clientX:300,clientY:10});
 assert.equal(state().teams[0].location,'venue-outside');
 assert.equal(state().teams[0].status,before.status);assert.equal(state().teams[0].statusSince,before.statusSince);
 assert.equal(frames.size,0);assert.equal(run('dragScroll'),null);
 document.hitTarget=null;
});
test('the default three floors use a larger fitted layout with no clipped slabs at any camera angle',()=>{
 run("replaceBoard(readBoard({teams:sampleTeams,locations:[],venue:'bill-graham'}));venueFloor='all';venueAngle=18;renderVenue()");
 let box=el('venue-canvas').querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
 assert.ok(box[2]<840&&box[3]<486,'the normal three floors fill more of the map viewport');
 for(const angle of [-30,18,42]){
  run(`venueAngle=${angle};renderVenue()`);
  box=el('venue-canvas').querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
  assert.equal(document.querySelectorAll('.venue-floor').length,3);
  for(const polygon of document.querySelectorAll('.venue-slab'))for(const [x,y] of polygon.getAttribute('points').split(' ').map(pair=>pair.split(',').map(Number))){
   assert.ok(x>=box[0]&&x<=box[0]+box[2]&&y>=box[1]&&y<=box[1]+box[3],'each full floor fits inside the screen-scaled SVG');
  }
 }
 run("venueAngle=18;toggleAdditionalVenueLocation('b',true)");
 assert.equal(document.querySelectorAll('.venue-floor').length,4);
 assert.ok(el('venue-canvas').querySelector('svg').getAttribute('viewBox').startsWith('0 0 840 '));
});
test('board taps support both call paths with the new labels and independent units',()=>{
 run("replaceBoard(readBoard({teams:[{id:'tcycle1',name:'CYCLE-1',status:'roaming',location:'venue-1-roaming'},{id:'tcycle2',name:'CYCLE-2',status:'roaming',location:'venue-2-roaming'}],locations:[],venue:'bill-graham'}));setView('dispatch');lastDragEnd=0");
 for(const [status,choice] of [['onscene'],['roaming','roaming'],['onscene'],['transporting','transporting'],['atclinic'],['roaming']]){
  const before=state();
  el('tcycle1').click();
  if(choice){
   assert.deepEqual(state(),before);
   assert.equal(el('call-actions').hidden,false);
   assert.equal(el('call-actions-name').textContent,'CYCLE-1');
   document.querySelector(`[data-call-status="${choice}"]`).click();
  }
  assert.equal(state().teams[0].status,status);
  assert.equal(state().teams[1].status,'roaming');
  assert.equal(el('status-tcycle1').value,status);
  assert.equal(el('level-number').textContent,status==='roaming'?'2':'1');
  assert.equal(el('onscene-total').textContent,status==='onscene'?'1':'0');
  assert.equal(el('tcycle1').querySelector('.team-status').textContent,{onscene:'On call',roaming:'Roaming',transporting:'Transporting',atclinic:'At Main Medical'}[status]);
 }
 assert.ok(!/on scene/i.test(document.body.textContent));
 assert.ok(state().handoffLog.some(entry=>entry.message.includes('On call')));
});
test('map choices sit above the ball, dismiss safely, and preserve backups, reload, and Undo',()=>{
 el('tcycle1').click();
 run("setView('venue');suppressVenueClickUntil=0");
 const onCall=state();
 document.querySelector('[data-map-team="tcycle1"]').click();
 assert.deepEqual(state(),onCall);
 const popup=el('call-actions');
 const ball=document.querySelector('[data-map-team="tcycle1"] .venue-unit-ball');
 assert.equal(popup.hidden,false);
 assert.equal(popup.closest('.venue-sidebar'),null);
 assert.ok(parseFloat(popup.style.top)+popup.getBoundingClientRect().height<ball.getBoundingClientRect().top);
 assert.ok(Number.isFinite(parseFloat(popup.style.left)));
 ball.getBoundingClientRect=()=>({left:374,top:200,width:16,height:16});
 popup.getBoundingClientRect=()=>({width:276,height:100});
 scrollWindow.innerWidth=390;
 run('positionCallActions()');
 assert.equal(parseFloat(popup.style.left),106);
 assert.equal(parseFloat(popup.style.top),84);
 scrollWindow.innerWidth=1280;
 document.body.click();assert.equal(popup.hidden,true);assert.deepEqual(state(),onCall);
 document.querySelector('[data-map-team="tcycle1"]').click();
 document.querySelector('[data-call-status="roaming"]').click();
 assert.equal(state().teams[0].status,'roaming');
 run('undoChange()');assert.deepEqual(state(),onCall);assert.equal(popup.hidden,true);
 document.querySelector('[data-map-team="tcycle1"]').click();
 document.querySelector('[data-call-status="transporting"]').click();
 assert.equal(state().teams[0].status,'transporting');
 const saved=state();
 run('replaceBoard(readBoard(JSON.parse(serializeBoard())))');assert.deepEqual(state(),saved);
 const startupDocument=makeDocument(html);
 const startupData=new Map([['charlotte-dispatch-board-v1',JSON.stringify(saved)]]);
 const startupContext=vm.createContext({...browserGlobals,document:startupDocument,localStorage:{getItem:key=>startupData.get(key)??null,setItem:(key,value)=>startupData.set(key,value)},navigator:{},location:{protocol:'file:'},Intl,Date,Set,Map,JSON,Math,Object,Number,String,Array,Blob,URL,setInterval(){},setTimeout(){},confirm:()=>true});
 vm.runInContext(source,startupContext);
 startupDocument.getElementById('tcycle1').click();
 assert.equal(JSON.parse(startupData.get('charlotte-dispatch-board-v1')).teams[0].status,'atclinic');
 document.querySelector('[data-map-team="tcycle1"]').click();
 assert.equal(state().teams[0].status,'atclinic');
 run('undoChange()');assert.deepEqual(state(),saved);
 run("setView('dispatch')");el('tcycle1').click();
 assert.equal(state().teams[0].status,'atclinic');
 const selector=el('status-tcycle1');selector.value='roaming';selector.fire('change');
 el('tcycle1').click();assert.equal(state().teams[0].status,'onscene');
});
test('older saved on-scene units and activity entries use On call and both call choices',()=>{
 run("replaceBoard(readBoard({teams:[{id:'tlegacy',name:'LEGACY',status:'onscene',location:'venue-1-polk'}],locations:[],venue:'bill-graham',handoffLog:[{at:Date.now(),team:'LEGACY',message:'Roaming → On scene'}]}));setView('dispatch')");
 assert.equal(el('tlegacy').querySelector('.team-status').textContent,'On call');
 assert.equal(state().handoffLog[0].message,'Roaming → On call');
 el('tlegacy').click();assert.equal(state().teams[0].status,'onscene');
 document.querySelector('[data-call-status="roaming"]').click();assert.equal(state().teams[0].status,'roaming');
 el('tlegacy').click();assert.equal(state().teams[0].status,'onscene');
 el('tlegacy').click();document.querySelector('[data-call-status="transporting"]').click();
 assert.equal(state().teams[0].status,'transporting');
});
function assertPackedPost(id,count){
 const group=document.querySelector(`.venue-team-layer[data-venue-post="${id}"]`);
 const polygon=document.querySelector(`.venue-destination[data-venue-post="${id}"] polygon`).getAttribute('points').split(' ').map(pair=>pair.split(',').map(Number));
 const balls=group.querySelectorAll('.venue-unit-ball').map(ball=>[Number(ball.getAttribute('cx')),Number(ball.getAttribute('cy'))]);
 assert.equal(balls.length,count);
 assert.ok(new Set(balls.map(point=>point[0].toFixed(2))).size>1,`${id} must use several horizontal spots`);
 for(const point of balls){
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
   const a=polygon[i],b=polygon[j];
   if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
   const dx=b[0]-a[0],dy=b[1]-a[1];
   const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)));
   assert.ok(Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy)>=7.8,`${id}: complete ball must fit inside its destination`);
  }
  assert.ok(inside,`${id}: marker must stay in its assigned post`);
 }
 for(let i=0;i<balls.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(balls[i][0]-balls[j][0],balls[i][1]-balls[j][1])>=25.8,`${id}: selection rings must not overlap`);
 return balls;
}
test('crowded map posts use several spots and keep every ball inside the post while rotating',()=>{
 for(const [post,count] of [['venue-2-polk',4],['venue-2-larkin',5],['venue-1-grove',9],['venue-1-roaming',8],['venue-2-roaming',8],['clinic-zone',8],['venue-4-polk',6],['venue-1-pit',4],['venue-1-table-service',4],['venue-b-basement',80]]){
  run(`replaceBoard(readBoard({teams:Array.from({length:${count}},(_,i)=>({id:'tpack'+i,name:'PACK-'+i,status:'${post==='clinic-zone'?'atclinic':'roaming'}',location:'${post}'})),locations:[],venue:'bill-graham',additionalVenueLocations:${post==='venue-b-basement'?"['b']":"[]"}}));setView('venue')`);
  const before=state();
  for(const angle of [-30,0,18,42]){
   run(`venueAngle=${angle};renderVenue()`);
   assertPackedPost(post,count);
   assert.deepEqual(state(),before);
  }
 }
});
test('neighboring crowded posts remain on their surfaces and inside the map viewport',()=>{
 const groups=[['venue-1-grove',9],['venue-1-pit',3],['venue-1-polk',4],['venue-1-larkin',3],['venue-1-roaming',5],['clinic-zone',4],['venue-4-polk',3],['venue-4-grove',6]];
 const fixture={teams:groups.flatMap(([location,count],group)=>Array.from({length:count},(_,i)=>({id:`tneighbor${group}_${i}`,name:`GROUP-${group}-${i}`,status:location==='clinic-zone'?'atclinic':'roaming',location}))),locations:[],venue:'bill-graham'};
 run(`replaceBoard(readBoard(${JSON.stringify(fixture)}));setView('venue')`);
 for(const angle of [-30,0,18,42]){
  run(`venueAngle=${angle};renderVenue()`);
  const box=el('venue-canvas').querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
  for(const [post,count] of groups)assertPackedPost(post,count);
  for(const polygon of document.querySelectorAll('.venue-slab'))for(const [x,y] of polygon.getAttribute('points').split(' ').map(pair=>pair.split(',').map(Number)))assert.ok(x>=0&&x<=box[2]&&y>=0&&y<=box[3]);
  for(const label of document.querySelectorAll('.venue-marker-name'))assert.ok(Number(label.getAttribute('y'))>=12&&Number(label.getAttribute('y'))<=box[3]-2);
 }
});
test('automatic map spots remain stable through status changes, moves, Undo and backup restore',()=>{
 run("replaceBoard(readBoard({teams:Array.from({length:4},(_,i)=>({id:'tstable'+i,name:'STABLE-'+i,status:'roaming',location:'venue-2-polk'})),locations:[],venue:'bill-graham'}));venueAngle=18;setView('venue')");
 const positions=()=>document.querySelectorAll('.venue-map-unit').map(marker=>[marker.dataset.mapTeam,marker.querySelector('.venue-unit-ball').getAttribute('cx'),marker.querySelector('.venue-unit-ball').getAttribute('cy')]);
 const before=state(),spots=positions();
 run("updateStatus('tstable0','onscene')");assert.deepEqual(positions(),spots);
 run('undoChange()');assert.deepEqual(state(),before);
 run("moveTeam('tstable0','venue-2-larkin')");assert.equal(state().teams[0].location,'venue-2-larkin');assertPackedPost('venue-2-polk',3);
 run('undoChange()');assert.deepEqual(state(),before);assert.deepEqual(positions(),spots);
 run('replaceBoard(readBoard(JSON.parse(serializeBoard())))');assert.deepEqual(state(),before);assert.deepEqual(positions(),spots);
});
console.log(`${passed} checks passed.`);
