import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { makeDocument } from './dom-fixture.mjs';

const source = fs.readFileSync(new URL('../board.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const storageKey = 'charlotte-dispatch-board-v1';
const stamp = Date.parse('2026-11-27T03:04:05Z');

function harness({ native = 'unsupported', saved } = {}) {
    const document = makeDocument(html);
    document.documentElement = document.querySelector('html');
    document.fullscreenElement = null;
    const data = new Map(saved ? [[storageKey, saved]] : []);
    const calls = { request: 0, exit: 0 };
    let failSave = false;
    let completeFullscreen;
    const window = {
        innerWidth: 1280, innerHeight: 900, scrollX: 0, scrollY: 400,
        addEventListener() {}, scrollBy() {},
        scrollTo({ left, top }) { this.scrollX = left; this.scrollY = top; }
    };
    class Clock extends Date {
        constructor(...args) { super(...(args.length ? args : [stamp])); }
        static now() { return stamp; }
    }
    if (native !== 'unsupported') {
        document.documentElement.requestFullscreen = () => {
            calls.request++;
            if (native === 'rejected') return Promise.reject(new Error('Fullscreen unavailable'));
            if (native === 'throws') throw new Error('Fullscreen unavailable');
            const enter = () => { document.fullscreenElement = document.documentElement; document.fire('fullscreenchange'); };
            if (native === 'pending') return new Promise(resolve => { completeFullscreen = () => { enter(); resolve(); }; });
            enter();
            return Promise.resolve();
        };
        document.exitFullscreen = () => {
            calls.exit++;
            document.fullscreenElement = null;
            document.fire('fullscreenchange');
            return Promise.resolve();
        };
    }
    const context = vm.createContext({
        document, window, Date: Clock, Intl, Set, Map, JSON, Math, Object, Number, String, Array, Blob, URL,
        localStorage: {
            getItem: key => data.get(key) ?? null,
            setItem: (key, value) => { if (failSave) throw new Error('Storage full'); data.set(key, value); }
        },
        navigator: {}, location: { protocol: 'file:' },
        getComputedStyle: node => ({ overflowY: node.style.overflowY || 'visible' }),
        requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setInterval() {}, setTimeout() {}, confirm: () => true
    });
    const run = code => vm.runInContext(code, context);
    run(source);
    return {
        document, window, data, calls, run,
        el: id => document.getElementById(id),
        state: () => JSON.parse(run('serializeBoard()')),
        completeFullscreen: () => completeFullscreen(),
        failSaving: value => { failSave = value; }
    };
}

function ready(options) {
    const h = harness(options);
    h.run(`replaceBoard(readBoard({
        teams: [
            {id:'t1',name:'ALPHA-1',status:'roaming',location:'venue-1-polk'},
            {id:'tpin',name:'FIXED-2',status:'onscene',location:'venue-1-pit'},
            {id:'tmeal',name:'MEAL-3',status:'roaming',location:'venue-2-roaming',mealBreak:{startedAt:Date.now()-60000,returnedAt:null}},
            {id:'twait',name:'WAIT-4',status:'roaming',location:'unassigned'}
        ], locations: [], venue:'bill-graham', notes:'Current shift'
    })); setView('venue'); undoHistory.length=0; updateUndoControls()`);
    return h;
}

let passed = 0;
async function test(name, action) {
    await action();
    console.log('PASS', name);
    passed++;
}

await test('fixed map teams retain operational colors and a separate pin', () => {
    const h = ready();
    const marker = () => h.document.querySelector('[data-map-team="tpin"]');
    assert.equal(marker().querySelector('.venue-unit-ball').getAttribute('fill'), 'url(#venue-ball-onscene)');
    assert.ok(marker().querySelector('.venue-fixed-pin'));
    h.run("updateStatus('tpin','transporting')");
    assert.equal(marker().querySelector('.venue-unit-ball').getAttribute('fill'), 'url(#venue-ball-transporting)');
    assert.ok(marker().querySelector('.venue-fixed-pin'));
    h.run("moveTeam('tpin','venue-1-table-service')");
    assert.ok(marker().querySelector('.venue-fixed-pin'));
    h.run("moveTeam('tpin','venue-1-polk')");
    assert.equal(marker().querySelector('.venue-fixed-pin'), null);
});

await test('meal countdowns tick in place, turn overdue and survive return Undo', () => {
    const h = ready();
    const timer = h.document.querySelector('[data-map-team="tmeal"] .venue-meal-countdown');
    const before = h.state();
    const deadline = Number(timer.dataset.deadline);
    h.run(`updateMealBreakTimers(${deadline - 61000})`);
    assert.equal(timer.textContent, '1:01');
    assert.equal(timer.dataset.overdue, 'false');
    h.run(`updateMealBreakTimers(${deadline + 65000})`);
    assert.equal(timer.textContent, '+1:05');
    assert.equal(timer.dataset.overdue, 'true');
    assert.equal(h.document.querySelector('[data-map-team="tmeal"] .venue-meal-countdown'), timer);
    assert.deepEqual(h.state(), before);
    h.run("toggleMealBreak('tmeal')");
    assert.equal(h.document.querySelector('[data-map-team="tmeal"] .venue-meal-countdown'), null);
    h.run('undoChange()');
    assert.ok(h.document.querySelector('[data-map-team="tmeal"] .venue-meal-countdown'));
    assert.deepEqual(h.state(), before);
});

await test('eighty additional unassigned balls leave the entire venue drawing unchanged', async () => {
    const h = ready();
    await h.run('enterDispatchMode()');
    const drawing = h.el('venue-canvas').innerHTML;
    h.run("teams.push(...Array.from({length:80},(_,i)=>({id:'tunplaced'+i,name:'WAIT-'+i,status:'roaming',zone:'field-zone',location:'unassigned',statusSince:Date.now(),mealBreak:null})));refresh()");
    assert.equal(h.el('venue-unassigned-count').textContent, '81');
    assert.equal(h.el('venue-unassigned-tray').querySelectorAll('[data-map-team]').length, 81);
    assert.equal(h.el('venue-canvas').innerHTML, drawing);
    assert.equal(h.run('dispatchModeActive'), true);
});

await test('tray dragging and full-screen Undo preserve team status and assignments', async () => {
    const h = ready();
    await h.run('enterDispatchMode()');
    const before = h.state();
    const marker = h.el('venue-unassigned-tray').querySelector('[data-map-team="twait"]');
    marker.fire('pointerdown', { button: 0, pointerId: 77, clientX: 1100, clientY: 300 });
    h.document.fire('pointermove', { pointerId: 77, clientX: 700, clientY: 320 });
    h.document.hitTarget = h.document.querySelector('.venue-destination[data-venue-post="venue-1-grove"] polygon');
    h.document.fire('pointerup', { pointerId: 77, clientX: 700, clientY: 320 });
    assert.equal(h.state().teams.find(team => team.id === 'twait').location, 'venue-1-grove');
    assert.equal(h.state().teams.find(team => team.id === 'twait').status, 'roaming');
    assert.equal(h.el('venue-unassigned-panel').hidden, true);
    h.el('dispatch-mode-undo').click();
    assert.deepEqual(h.state(), before);
    assert.ok(h.el('venue-unassigned-tray').querySelector('[data-map-team="twait"]'));
    assert.equal(h.run('dispatchModeActive'), true);
    assert.equal(h.el('dispatch-mode-undo').disabled, true);
});

await test('entering and leaving focused mode never changes saved board data or Undo history', async () => {
    const h = ready();
    const before = h.state();
    const saved = h.data.get(storageKey);
    await h.run('enterDispatchMode()');
    assert.ok(h.document.body.classList.contains('is-dispatch-mode'));
    assert.equal(h.el('dispatch-mode-status').hidden, false);
    assert.equal(h.el('dispatch-mode-toggle').textContent, 'Exit full-screen');
    assert.equal(h.el('dispatch-mode-toggle').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(h.state(), before);
    assert.equal(h.data.get(storageKey), saved);
    await h.run('exitDispatchMode()');
    assert.equal(h.document.body.classList.contains('is-dispatch-mode'), false);
    assert.equal(h.el('dispatch-mode-status').hidden, true);
    assert.equal(h.el('dispatch-mode-toggle').textContent, 'Full-screen dispatch');
    assert.equal(h.document.activeElement, h.el('dispatch-mode-toggle'));
    assert.equal(h.window.scrollY, 400);
    assert.deepEqual(h.state(), before);
    assert.equal(h.run('undoHistory.length'), 0);
});

await test('full-screen is unavailable until a venue map is selected', async () => {
    const h = harness({ native: 'supported' });
    await h.run('enterDispatchMode()');
    assert.equal(h.run('dispatchModeActive'), false);
    h.run("changeVenue('bill-graham')");
    await h.run('enterDispatchMode()');
    assert.equal(h.run('dispatchModeActive'), false);
    assert.equal(h.calls.request, 0);
});

await test('native fullscreen enters from the toggle and exits from the same control', async () => {
    const h = ready({ native: 'supported' });
    h.el('dispatch-mode-toggle').click();
    await Promise.resolve();
    assert.equal(h.document.fullscreenElement, h.document.documentElement);
    assert.equal(h.calls.request, 1);
    assert.equal(h.run('dispatchModeActive'), true);
    h.el('dispatch-mode-toggle').click();
    await Promise.resolve();
    assert.equal(h.document.fullscreenElement, null);
    assert.equal(h.calls.exit, 1);
    assert.equal(h.run('dispatchModeActive'), false);
});

await test('browser Escape and fullscreenchange restore the normal view', async () => {
    const h = ready({ native: 'supported' });
    await h.run('enterDispatchMode()');
    h.document.fullscreenElement = null;
    h.document.fire('fullscreenchange');
    assert.equal(h.run('dispatchModeActive'), false);
    assert.equal(h.el('dispatch-mode-toggle').getAttribute('aria-pressed'), 'false');
    assert.equal(h.document.activeElement, h.el('dispatch-mode-toggle'));
});

await test('Escape exits the window-filling fallback without losing a selected unit', async () => {
    const h = ready();
    h.run("selectVenueTeam('t1')");
    await h.run('enterDispatchMode()');
    h.document.fire('keydown', { key: 'Escape' });
    assert.equal(h.run('dispatchModeActive'), false);
    assert.equal(h.run('selectedVenueTeam'), 't1');
    assert.equal(h.el('venue-inspector').hidden, false);
});

await test('rejected and throwing fullscreen APIs both retain a usable focused fallback', async () => {
    for (const native of ['rejected', 'throws']) {
        const h = ready({ native });
        await h.run('enterDispatchMode()');
        assert.equal(h.run('dispatchModeActive'), true);
        assert.equal(h.run('dispatchModeFullscreenOwned'), false);
        assert.equal(h.el('dispatch-mode-toggle').textContent, 'Exit full-screen');
        h.document.fire('keydown', { key: 'Escape' });
        assert.equal(h.run('dispatchModeActive'), false);
        assert.equal(h.calls.exit, 0);
    }
});

await test('exiting during a pending native fullscreen request does not trap the browser', async () => {
    const h = ready({ native: 'pending' });
    const entering = h.run('enterDispatchMode()');
    assert.equal(h.run('dispatchModeActive'), true);
    await h.run('exitDispatchMode()');
    h.completeFullscreen();
    await entering;
    assert.equal(h.document.fullscreenElement, null);
    assert.equal(h.run('dispatchModeActive'), false);
    assert.equal(h.calls.exit, 1);
});

await test('quick re-entry while fullscreen is pending makes only one native request', async () => {
    const h = ready({ native: 'pending' });
    const entering = h.run('enterDispatchMode()');
    await h.run('exitDispatchMode()');
    await h.run('enterDispatchMode()');
    h.completeFullscreen();
    await entering;
    assert.equal(h.calls.request, 1);
    assert.equal(h.run('dispatchModeActive'), true);
    assert.equal(h.document.fullscreenElement, h.document.documentElement);
    await h.run('exitDispatchMode()');
    assert.equal(h.document.fullscreenElement, null);
});

await test('a fullscreen session that already existed is never closed by dispatch mode', async () => {
    const h = ready({ native: 'supported' });
    h.document.fullscreenElement = h.document.documentElement;
    await h.run('enterDispatchMode()');
    await h.run('exitDispatchMode()');
    assert.equal(h.calls.request, 0);
    assert.equal(h.calls.exit, 0);
    assert.equal(h.document.fullscreenElement, h.document.documentElement);
});

await test('both Undo buttons and availability meters stay synchronized in dispatch mode', async () => {
    const h = ready();
    await h.run('enterDispatchMode()');
    assert.equal(h.el('dispatch-mode-undo').disabled, true);
    assert.equal(h.document.querySelector('.dispatch-mode-level [data-level-value]').textContent, '2');
    h.run("updateStatus('t1','onscene')");
    assert.equal(h.el('dispatch-mode-undo').disabled, false);
    assert.equal(h.el('undo-button').disabled, false);
    assert.equal(h.document.querySelector('.dispatch-mode-level [data-level-value]').textContent, '1');
    h.el('dispatch-mode-undo').click();
    assert.equal(h.el('dispatch-mode-undo').disabled, true);
    assert.equal(h.el('undo-button').disabled, true);
    assert.equal(h.document.querySelector('.dispatch-mode-level [data-level-value]').textContent, '2');
    assert.equal(h.run('dispatchModeActive'), true);
});

await test('Pacific time and saving failures remain visible in the dispatch header', async () => {
    const h = ready();
    await h.run('enterDispatchMode()');
    assert.equal(h.el('dispatch-mode-clock').textContent, '19:04:05');
    assert.equal(h.el('dispatch-mode-clock').textContent, h.el('pacific-time').textContent);
    assert.equal(h.el('dispatch-mode-zone').textContent, 'PST');
    h.failSaving(true);
    h.run("updateStatus('t1','onscene')");
    assert.equal(h.el('dispatch-mode-save').dataset.error, 'true');
    assert.equal(h.el('dispatch-mode-save').textContent, h.el('save-indicator').textContent);
    h.failSaving(false);
    h.run('saveBoard()');
    assert.equal(h.el('dispatch-mode-save').dataset.error, 'false');
});

await test('search, selection and floor settings are preserved across mode changes', async () => {
    const h = ready();
    h.el('venue-search').value = 'FIXED';
    h.el('venue-search').fire('input');
    h.run("selectVenueTeam('tpin');venueFloor='2';venueAngle=-6;renderVenue()");
    const before = h.state();
    await h.run('enterDispatchMode()');
    assert.equal(h.el('venue-unit-list').querySelectorAll('[data-move-team]').length, 1);
    assert.equal(h.el('venue-selected-name').textContent, 'FIXED-2');
    await h.run('exitDispatchMode()');
    assert.equal(h.el('venue-search').value, 'FIXED');
    assert.equal(h.run('selectedVenueTeam'), 'tpin');
    assert.equal(h.run('venueFloor'), '2');
    assert.equal(h.run('venueAngle'), -6);
    assert.deepEqual(h.state(), before);
});

await test('changing views or undoing the venue selection exits dispatch mode safely', async () => {
    const h = ready({ native: 'supported' });
    await h.run('enterDispatchMode()');
    h.run("setView('dispatch',true)");
    await Promise.resolve();
    assert.equal(h.run('dispatchModeActive'), false);
    assert.equal(h.document.fullscreenElement, null);
    assert.equal(h.document.activeElement, h.el('dispatch-tab'));
    h.run("setView('venue');changeVenue('');changeVenue('bill-graham')");
    await h.run('enterDispatchMode()');
    h.el('dispatch-mode-undo').click();
    await Promise.resolve();
    assert.equal(h.run('selectedVenue'), '');
    assert.equal(h.run('dispatchModeActive'), false);
    assert.equal(h.document.fullscreenElement, null);
});

await test('Escape closes call actions before leaving the focused fallback', async () => {
    const h = ready();
    await h.run('enterDispatchMode()');
    h.run("showCallActions('tpin','venue')");
    h.document.fire('keydown', { key: 'Escape' });
    assert.equal(h.el('call-actions').hidden, true);
    assert.equal(h.run('dispatchModeActive'), true);
    h.document.fire('keydown', { key: 'Escape' });
    assert.equal(h.run('dispatchModeActive'), false);
});

await test('reload preserves the shift and meal clock without automatically entering fullscreen', async () => {
    const h = ready();
    await h.run('enterDispatchMode()');
    const before = h.state();
    assert.equal(Object.hasOwn(before, 'dispatchModeActive'), false);
    const reloaded = harness({ native: 'supported', saved: h.data.get(storageKey) });
    assert.equal(reloaded.run('dispatchModeActive'), false);
    assert.equal(reloaded.calls.request, 0);
    assert.deepEqual(reloaded.state(), before);
    reloaded.run("setView('venue')");
    assert.ok(reloaded.document.querySelector('[data-map-team="tmeal"] .venue-meal-countdown'));
    assert.ok(reloaded.el('venue-unassigned-tray').querySelector('[data-map-team="twait"]'));
});

console.log(`${passed} dispatch and map checks passed.`);
