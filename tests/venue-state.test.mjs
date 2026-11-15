import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {makeDocument} from './dom-fixture.mjs';
const root=new URL('../',import.meta.url);
const source=fs.readFileSync(new URL('board.js',root),'utf8');
const html=fs.readFileSync(new URL('index.html',root),'utf8');
const document=makeDocument(html);
const data=new Map();
const context=vm.createContext({document,localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},navigator:{},location:{protocol:'file:'},Intl,Date,Set,Map,JSON,Math,Object,Number,String,Array,Blob,URL,setInterval(){},setTimeout(){},confirm:()=>true});
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
test('selecting Bill Graham opens four levels and creates the eight main board posts',()=>{
 el('venue-select').value='bill-graham';el('venue-select').fire('change');
 assert.equal(el('venue-content').hidden,false);
 assert.equal(el('venue-no-view').hidden,true);
 assert.equal(document.querySelectorAll('.venue-floor-name').length,4);
 assert.equal(document.querySelectorAll('.venue-zone-surface').length,15);
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
 const before=state();
 document.querySelector('[data-venue-level="2"]').click();
 assert.equal(document.querySelectorAll('.venue-floor').length,1);
 assert.equal(document.querySelectorAll('.venue-zone-surface').length,4);
 el('venue-rotate-left').click();
 document.querySelector('[data-venue-level="4"]').click();
 assert.equal(document.querySelectorAll('.venue-zone-surface').length,4);
 assert.equal(document.querySelector('.venue-floor-name').textContent,'4th floor');
 el('venue-reset').click();
 assert.equal(document.querySelectorAll('.venue-floor').length,4);
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
 assert.equal(document.querySelectorAll('.venue-floor').length,4);
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
 for(const status of ['onscene','transporting','atclinic','roaming']){
  document.querySelector('[data-map-team="t1"]').click();
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
 assert.equal(state().handoffLog.length,original.handoffLog.length+4);
 assert.ok(state().teams[0].statusSince>=original.teams[0].statusSince);
 run('undoChange()');assert.equal(state().teams[0].status,'atclinic');
 run('undoChange();undoChange();undoChange()');assert.deepEqual(state(),original);
});
test('keyboard activation cycles status once and keeps focus when a team moves to Medical',()=>{
 run("venueFloor='1';renderVenue();suppressVenueClickUntil=0");
 document.querySelector('[data-map-team="t1"]').fire('keydown',{key:'Enter'});
 assert.equal(state().teams[0].status,'onscene');
 document.querySelector('[data-map-team="t1"]').fire('keydown',{key:' '});
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
test('both roaming destinations sit along the same Grove frontage as the Grove posts',()=>{
 run("moveTeam('t1','venue-1-roaming');moveTeam('t2','venue-2-roaming');updateStatus('t1','roaming')");
 const points=node=>node.getAttribute('points').split(' ').map(pair=>pair.split(',').map(Number));
 for(const level of ['1','2']){
  const roaming=document.querySelector(`.venue-destination[data-venue-post="venue-${level}-roaming"]`);
  const grove=document.querySelector(`.venue-destination[data-venue-post="venue-${level}-grove"]`);
  assert.equal(roaming.dataset.venueSide,'Grove');
  assert.equal(grove.dataset.venueSide,'Grove');
  const r=points(roaming.querySelector('polygon')),g=points(grove.querySelector('polygon'));
  const [a,b]=[g[2],g[3]];
  const distance=p=>Math.abs((b[1]-a[1])*p[0]-(b[0]-a[0])*p[1]+b[0]*a[1]-b[1]*a[0])/Math.hypot(b[1]-a[1],b[0]-a[0]);
  assert.ok(distance(r[2])<.25&&distance(r[3])<.25);
 }
 assert.equal(run('venuePostForTeam(teams[0]).side'),'Grove');
 assert.equal(run('venuePostForTeam(teams[1]).side'),'Grove');
});
test('the Medical shortcut is removed while the Medical map destination remains',()=>{
 assert.equal(el('locate-medical'),null);
 assert.equal(document.querySelector('.medical-shortcut'),null);
 assert.ok(document.querySelector('.venue-destination[data-venue-post="clinic-zone"] polygon'));
});
test('Basement is one map destination and has no street-side dropdowns',()=>{
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
 const legacy={teams:['polk','larkin','grove'].map((side,i)=>({id:'told'+i,name:'OLD-'+i,status:'roaming',location:'venue-b-'+side,statusSince:before})),locations:[],venue:'bill-graham',venueBoardPosts:['venue-b-polk','venue-b-larkin','venue-b-grove']};
 run(`replaceBoard(readBoard(${JSON.stringify(legacy)}))`);
 assert.equal(state().teams.length,3);
 assert.deepEqual(state().venueBoardPosts,['venue-b-basement']);
 for(const team of state().teams){assert.equal(team.location,'venue-b-basement');assert.equal(team.statusSince,before);}
 assert.equal(document.querySelectorAll('[data-location="venue-b-basement"]').length,1);
 assert.equal(document.querySelectorAll('.venue-map-unit').length,3);
 assert.deepEqual(state().teams.map(team=>team.name),['OLD-0','OLD-1','OLD-2']);
});
test('Basement accepts and displays a large team group without a team limit',()=>{
 const many={teams:Array.from({length:80},(_,i)=>({id:'tbase'+i,name:'BASE-'+i,status:'roaming',location:i?'venue-b-basement':'unassigned'})),locations:[],venue:'bill-graham'};
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
run(`replaceBoard(readBoard({teams:[{id:'t1',name:'TABLE-1',status:'roaming',location:'unassigned'},{id:'t2',name:'LARKIN-2',status:'roaming',location:'venue-2-larkin'},{id:'t3',name:'POLK-2',status:'transporting',location:'venue-2-polk'}],locations:[],venue:'bill-graham'}));venueFloor='all';showThirdFloor=false;venueAngle=18;setView('venue')`);
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
  run(`showThirdFloor=true;venueFloor='all';venueAngle=${angle};renderVenue()`);
  for(const level of ['1','2','3','4'])assert.ok(center(`venue-${level}-larkin`)<center(`venue-${level}-polk`));
  assert.ok(Math.abs(center('clinic-zone')-center('venue-4-polk'))<Math.abs(center('clinic-zone')-center('venue-4-larkin')));
  const larkin=Number(document.querySelector('[data-map-team="t2"] .venue-unit-ball').getAttribute('cx'));
  const polk=Number(document.querySelector('[data-map-team="t3"] .venue-unit-ball').getAttribute('cx'));
  assert.ok(larkin<polk);
  assert.equal(el('location-t2').value,'venue-2-larkin');
  assert.equal(el('location-t3').value,'venue-2-polk');
 }
 run("showThirdFloor=false;venueAngle=18;renderVenue()");
 assert.deepEqual(state(),before);
});
console.log(`${passed} checks passed.`);
