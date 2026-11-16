const storageKey = 'charlotte-dispatch-board-v1';
const mealBreakDuration = 30 * 60 * 1000;
const statusNames = { roaming: 'Roaming', onscene: 'On call', transporting: 'Transporting', atclinic: 'At Main Medical' };
const builtInLocations = [{ id: 'pit-table-service', name: 'Fixed posts' }, { id: 'unassigned', name: 'No post assigned' }];
const venueLevels = [
    { id: 'b', name: 'Basement', short: 'B', detail: 'Service level' },
    { id: '1', name: '1st floor', short: '1', detail: 'Auditorium floor' },
    { id: '2', name: '2nd floor', short: '2', detail: 'Lower concourse' },
    { id: '3', name: '3rd floor', short: '3', detail: 'Upper concourse' },
    { id: '4', name: '4th floor', short: '4', detail: 'Main Medical · Polk' }
];
const venueSides = ['Grove', 'Polk', 'Larkin'];
const optionalVenueLocations = [
    { id: 'outside', name: 'Outside of Venue', toggle: 'venue-show-outside', label: 'venue-outside-label' },
    { id: 'b', name: 'Basement', toggle: 'venue-show-basement', label: 'venue-basement-label' },
    { id: '3', name: 'Third floor', toggle: 'venue-show-third', label: 'venue-third-label' }
];
const pitSides = {
    'stage-left': { label: 'Stage left · Polk', street: 'Polk', x: 95, minX: 35, maxX: 155 },
    'stage-right': { label: 'Stage right · Larkin', street: 'Larkin', x: -95, minX: -155, maxX: -35 }
};
const venuePosts = [
    { id: 'venue-outside', name: 'Outside of Venue', level: 'outside', side: 'Outside' },
    { id: 'venue-b-basement', name: 'Basement', level: 'b', side: 'Basement' },
    ...venueLevels.filter(level => level.id !== 'b').flatMap(level => venueSides.map(side => ({
        id: `venue-${level.id}-${side.toLowerCase()}`, name: `${level.name} ${side}`, level: level.id, side
    }))),
    { id: 'venue-1-roaming', name: '1st roaming', level: '1', side: 'Roaming', roaming: true },
    { id: 'venue-2-roaming', name: '2nd roaming', level: '2', side: 'Roaming', roaming: true },
    { id: 'venue-1-pit', name: 'Pit', level: '1', side: 'Pit', fixed: true },
    { id: 'venue-1-table-service', name: 'Table Service', level: '1', side: 'Grove', fixed: true, mapDescription: '1st floor Grove nearest Larkin' }
];
const defaultVenueBoardPosts = ['venue-1-grove', 'venue-1-polk', 'venue-1-larkin',
    'venue-2-grove', 'venue-2-polk', 'venue-2-larkin', 'venue-1-roaming', 'venue-2-roaming'];
let selectedVenue = '';
let pitSide = 'stage-left';
let venueBoardPosts = [...defaultVenueBoardPosts];
let additionalVenueLocations = [];
const mainMedicalPost = { id: 'clinic-zone', name: 'Main Medical · 4th floor · Polk', level: '4', side: 'Polk' };
let activeView = 'dispatch';
let selectedVenueTeam = null;
let callActionTeam = null;
let callActionView = 'dispatch';
let venueFloor = 'all';
let venueAngle = 18;
let venueDrag = null;
let suppressVenueClickUntil = 0;
let locations = [];
const sampleTeams = [
    { id: 't1', name: 'DEMO-1', status: 'roaming', zone: 'field-zone', location: 'venue-1-polk' },
    { id: 't2', name: 'DEMO-2', status: 'onscene', zone: 'field-zone', location: 'venue-2-larkin' },
    { id: 't3', name: 'DEMO-3', status: 'transporting', zone: 'field-zone', location: 'venue-2-roaming' },
    { id: 't4', name: 'DEMO-4', status: 'atclinic', zone: 'clinic-zone', location: 'unassigned' },
    { id: 't5', name: 'DEMO-5', status: 'roaming', zone: 'field-zone', location: 'venue-1-pit' },
    { id: 't6', name: 'DEMO-6', status: 'roaming', zone: 'field-zone', location: 'venue-1-table-service' }
];
let teams = [];
let savedNotes = '';
// Preserve this storage key for existing saved boards and backups.
let handoffLog = [];
const undoHistory = [];
let notesCheckpoint = null;
let lastDragEnd = 0;
let dragScroll = null;
let dragScrollFrame = null;

// Keep scrolling while a dragged team stays near an edge, even when the pointer pauses.
function edgeScrollSpeed(position, start, end, edge = 88) {
    const size = Math.min(edge, (end - start) / 3);
    if (position < start || position > end) return 0;
    if (position < start + size) return -720 * (1 - (position - start) / size);
    if (position > end - size) return 720 * (1 - (end - position) / size);
    return 0;
}
function updateDragScroll(event) {
    if (dragScroll && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        dragScroll.x = event.clientX;
        dragScroll.y = event.clientY;
    }
}
function stopDragScroll() {
    if (dragScrollFrame !== null) cancelAnimationFrame(dragScrollFrame);
    dragScrollFrame = null;
    dragScroll = null;
}
function startDragScroll(event) {
    stopDragScroll();
    dragScroll = { x: event.clientX, y: event.clientY, lastTime: null };
    dragScrollFrame = requestAnimationFrame(scrollDraggedTeam);
}
function scrollDraggedTeam(time) {
    if (!dragScroll) return;
    const { x, y, lastTime } = dragScroll;
    const seconds = Math.min(32, lastTime === null ? 16 : time - lastTime) / 1000;
    dragScroll.lastTime = time;
    let scrolled = false;
    // A long Units list scrolls itself before the surrounding page.
    for (let node = document.elementFromPoint(x, y); node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
        if (!(node.scrollHeight > node.clientHeight) || !/(auto|scroll)/.test(getComputedStyle(node).overflowY)) continue;
        const rect = node.getBoundingClientRect();
        const top = Math.max(0, rect.top);
        const bottom = Math.min(window.innerHeight, rect.bottom);
        const distance = edgeScrollSpeed(y, top, bottom, 64) * seconds;
        if (!distance) continue;
        const before = node.scrollTop;
        node.scrollTop = Math.max(0, Math.min(node.scrollHeight - node.clientHeight, before + distance));
        if (node.scrollTop !== before) { scrolled = true; break; }
    }
    if (!scrolled) {
        const distance = edgeScrollSpeed(y, 0, window.innerHeight) * seconds;
        if (distance) window.scrollBy({ top: distance, behavior: 'instant' });
    }
    if (venueDrag?.moving) highlightVenueTarget(document.elementFromPoint(x, y)?.closest('[data-venue-post]'));
    dragScrollFrame = requestAnimationFrame(scrollDraggedTeam);
}
function initializeDragScrolling() {
    let nativeTeamDragging = false;
    const stopNativeDrag = () => { nativeTeamDragging = false; stopDragScroll(); };
    document.addEventListener('dragstart', event => {
        if (event.target.closest('.team-badge, [data-move-team]')) {
            nativeTeamDragging = true;
            startDragScroll(event);
        }
    });
    document.addEventListener('dragover', event => {
        if (nativeTeamDragging && !dragScroll) startDragScroll(event);
        else updateDragScroll(event);
    }, true);
    for (const type of ['drop', 'dragend', 'pointercancel']) document.addEventListener(type, stopNativeDrag, true);
    document.addEventListener('dragleave', event => {
        if (event.target === document.documentElement && !event.relatedTarget) stopDragScroll();
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') stopNativeDrag(); });
    window.addEventListener('blur', stopNativeDrag);
}
function canonicalLocation(id) {
    return ['venue-b-polk', 'venue-b-larkin', 'venue-b-grove'].includes(id) ? 'venue-b-basement' : id;
}
function validPitSide(side) { return typeof side === 'string' && Object.hasOwn(pitSides, side); }
function readBoard(saved) {
    if (!saved || !Array.isArray(saved.teams) || !Array.isArray(saved.locations)) {
        throw new Error('Invalid board');
    }
    const locationIds = new Set([...builtInLocations, ...venuePosts].map(location => location.id));
    const teamIds = new Set();
    const locations = saved.locations.map(location => {
        if (!location || typeof location.id !== 'string' || !/^loc_[a-z0-9_]+$/i.test(location.id)
            || locationIds.has(location.id) || typeof location.name !== 'string' || !location.name.trim()) {
            throw new Error('Invalid location');
        }
        locationIds.add(location.id);
        return { id: location.id, name: location.name };
    });
    const now = Date.now();
    const teams = saved.teams.map(team => {
        if (!team || typeof team.id !== 'string' || !/^t[a-z0-9_]+$/i.test(team.id)
            || teamIds.has(team.id) || typeof team.name !== 'string' || !team.name.trim()
            || !Object.hasOwn(statusNames, team.status)) {
            throw new Error('Invalid team');
        }
        teamIds.add(team.id);
        const { startedAt, returnedAt } = team.mealBreak ?? {};
        const validBreakStart = Number.isSafeInteger(startedAt) && startedAt > 0 && startedAt <= now;
        const location = canonicalLocation(team.location);
        return {
            id: team.id, name: team.name, status: team.status,
            zone: team.status === 'atclinic' ? 'clinic-zone' : 'field-zone',
            location: locationIds.has(location) ? location : 'unassigned',
            statusSince: Number.isFinite(team.statusSince) && team.statusSince > 0 && team.statusSince <= now
                ? team.statusSince : now,
            mealBreak: validBreakStart ? {
                startedAt,
                returnedAt: Number.isSafeInteger(returnedAt) && returnedAt >= startedAt && returnedAt <= now
                    ? returnedAt : null
            } : null
        };
    });
    const handoffLog = Array.isArray(saved.handoffLog) ? saved.handoffLog.filter(entry =>
        entry && Number.isSafeInteger(entry.at) && entry.at > 0 && entry.at <= 8.64e15
        && typeof entry.team === 'string' && typeof entry.message === 'string'
    ).map(({ at, team, message }) => ({ at, team, message: message.replace(/\bon scene\b/gi, 'On call') })) : [];
    const venue = saved.venue === 'bill-graham' ? 'bill-graham' : '';
    const venueBoardPosts = Array.isArray(saved.venueBoardPosts)
        ? [...new Set(saved.venueBoardPosts.map(canonicalLocation).filter(id => venuePosts.some(post => post.id === id && !post.fixed)))]
        : [...defaultVenueBoardPosts];
    const pitSide = validPitSide(saved.pitSide) ? saved.pitSide : 'stage-left';
    const additionalVenueLocations = Array.isArray(saved.additionalVenueLocations)
        ? [...new Set(saved.additionalVenueLocations.filter(id => optionalVenueLocations.some(location => location.id === id)))] : [];
    return { teams, locations, notes: typeof saved.notes === 'string' ? saved.notes : '', handoffLog, venue, venueBoardPosts, pitSide, additionalVenueLocations };
}

try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== null) {
        const saved = readBoard(JSON.parse(raw));
        teams = saved.teams;
        locations = saved.locations;
        savedNotes = saved.notes;
        handoffLog = saved.handoffLog;
        selectedVenue = saved.venue;
        venueBoardPosts = saved.venueBoardPosts;
        pitSide = saved.pitSide;
        additionalVenueLocations = saved.additionalVenueLocations;
    }
} catch {
    // Storage is checked again on the first save so the operator sees any error.
}

function validLocation(id) { return fieldLocations().some(location => location.id === id); }
function saveBoard() {
    const indicator = document.getElementById('save-indicator');
    try {
        localStorage.setItem(storageKey, serializeBoard());
        indicator.dataset.error = 'false';
        indicator.textContent = 'Saved';
    } catch {
        indicator.dataset.error = 'true';
        indicator.textContent = 'Changes could not be saved. Download a backup before closing.';
    }
}
function newId(prefix) { return prefix + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9); }
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
}
function fieldLocations() { return [...locations, ...builtInLocations, ...venuePosts]; }
function visibleFieldLocations() {
    const visible = fieldLocations().filter(location => !location.fixed && (!venuePosts.some(post => post.id === location.id)
        || (selectedVenue === 'bill-graham' && venueBoardPosts.includes(location.id))
        || teams.some(team => team.zone === 'field-zone' && team.location === location.id)));
    return [...visible.filter(location => !builtInLocations.some(post => post.id === location.id)), ...builtInLocations];
}
function isFixedPost(team) {
    return team.zone === 'field-zone' && (team.location === 'pit-table-service'
        || venuePosts.some(post => post.id === team.location && post.fixed));
}
function boardLocationForTeam(team) { return isFixedPost(team) ? 'pit-table-service' : team.location; }
function venuePostForTeam(team) {
    return team.zone === 'clinic-zone' ? mainMedicalPost : venuePosts.find(post => post.id === team.location);
}
function boardState(notes = document.getElementById('shift-notes').value) {
    return { teams, locations, notes, venue: selectedVenue, venueBoardPosts, pitSide, additionalVenueLocations };
}
function serializeBoard() {
    return JSON.stringify({ ...boardState(), handoffLog });
}
function rememberChange(snapshot = JSON.stringify(boardState())) {
    undoHistory.push({ snapshot, log: handoffLog, logLength: handoffLog.length });
    if (undoHistory.length > 100) undoHistory.shift();
    notesCheckpoint = null;
    document.getElementById('undo-button').disabled = false;
}
function undoChange() {
    if (!undoHistory.length) return;
    const { snapshot, log, logLength } = undoHistory.pop();
    const previous = JSON.parse(snapshot);
    teams = previous.teams; locations = previous.locations;
    selectedVenue = previous.venue || '';
    venueBoardPosts = previous.venueBoardPosts || [...defaultVenueBoardPosts];
    pitSide = validPitSide(previous.pitSide) ? previous.pitSide : 'stage-left';
    additionalVenueLocations = previous.additionalVenueLocations || [];
    handoffLog = log;
    handoffLog.length = logLength;
    document.getElementById('shift-notes').value = previous.notes;
    savedNotes = previous.notes;
    notesCheckpoint = null;
    refresh();
}
function elapsedStatus(since, now = Date.now()) {
    const seconds = Math.max(0, Math.floor((now - since) / 1000));
    return `${Math.floor(seconds / 60)}min ${String(seconds % 60).padStart(2, '0')}sec`;
}
function updateTimers() {
    const now = Date.now();
    document.querySelectorAll('.team-timer').forEach(timer => {
        timer.textContent = elapsedStatus(Number(timer.dataset.since), now);
    });
    updateMealBreakTimers(now);
}
function cycleTeamStatus(id, view = 'dispatch', focus = false) {
    const team = teams.find(item => item.id === id);
    if (!team) return;
    if (team.status === 'onscene') {
        if (view === 'venue') renderVenue();
        showCallActions(id, view);
        return;
    }
    const next = { roaming: 'onscene', transporting: 'atclinic', atclinic: 'roaming' };
    updateStatus(id, next[team.status]);
    if (focus) focusTeamStatus(id, view);
}

function focusTeamStatus(id, view) {
    const target = view === 'venue'
        ? document.querySelector(`[data-map-team="${id}"]`) || document.getElementById('venue-selected-status')
        : document.getElementById(id);
    target?.focus({ preventScroll: true });
}
function callActionAnchor() {
    return callActionView === 'venue'
        ? document.querySelector(`[data-map-team="${callActionTeam}"] .venue-unit-ball`)
        : document.getElementById(callActionTeam);
}
function hideCallActions(focus = false) {
    if (!callActionTeam) return;
    const id = callActionTeam;
    const view = callActionView;
    const trigger = view === 'venue' ? document.querySelector(`[data-map-team="${id}"]`) : document.getElementById(id);
    trigger?.setAttribute('aria-expanded', 'false');
    callActionTeam = null;
    document.getElementById('call-actions').hidden = true;
    if (focus) focusTeamStatus(id, view);
}
function positionCallActions() {
    if (!callActionTeam) return;
    const anchor = callActionAnchor();
    if (!anchor || activeView !== callActionView) { hideCallActions(); return; }
    const popup = document.getElementById('call-actions');
    const rect = anchor.getBoundingClientRect();
    const size = popup.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const left = Math.max(8, Math.min(center - size.width / 2, window.innerWidth - size.width - 8));
    popup.style.left = `${left}px`;
    popup.style.top = `${rect.top - size.height - 16}px`;
    popup.style.setProperty('--call-arrow-left', `${Math.max(12, Math.min(size.width - 12, center - left))}px`);
}
function showCallActions(id, view) {
    hideCallActions();
    const team = teams.find(item => item.id === id);
    if (!team || team.status !== 'onscene') return;
    callActionTeam = id;
    callActionView = view;
    const popup = document.getElementById('call-actions');
    popup.setAttribute('aria-label', `On call actions for ${team.name}`);
    document.getElementById('call-actions-name').textContent = team.name;
    const trigger = view === 'venue' ? document.querySelector(`[data-map-team="${id}"]`) : document.getElementById(id);
    trigger?.setAttribute('aria-expanded', 'true');
    popup.hidden = false;
    const anchor = callActionAnchor();
    if (!anchor) { hideCallActions(); return; }
    const space = popup.getBoundingClientRect().height + 24;
    if (anchor.getBoundingClientRect().top < space) anchor.scrollIntoView({ block: 'center', behavior: 'instant' });
    positionCallActions();
    popup.querySelector('button').focus({ preventScroll: true });
}
function initializeCallActions() {
    const popup = document.getElementById('call-actions');
    popup.addEventListener('click', event => {
        const button = event.target.closest('[data-call-status]');
        const id = callActionTeam;
        const view = callActionView;
        if (!button || !id || !teams.some(team => team.id === id && team.status === 'onscene')) return;
        updateStatus(id, button.dataset.callStatus);
        if (view === 'venue') venueMessage(`${teams.find(team => team.id === id).name}: ${statusNames[button.dataset.callStatus]}.`);
        focusTeamStatus(id, view);
    });
    const dismissOutside = event => {
        if (!callActionTeam || popup.contains(event.target)) return;
        const triggerId = callActionView === 'venue'
            ? event.target.closest('[data-map-team]')?.dataset.mapTeam : event.target.closest('.team-badge')?.id;
        if (triggerId !== callActionTeam) hideCallActions();
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('click', dismissOutside);
    window.addEventListener('scroll', positionCallActions, true);
    window.addEventListener('resize', positionCallActions);
}

function isOnMealBreak(team) {
    return team.mealBreak != null && team.mealBreak.returnedAt === null;
}

function recordTimestamp(team, message, at) {
    handoffLog.push({ at, team: team.name, message });
}

function teamLocationName(team) {
    return team.zone === 'clinic-zone'
        ? 'Main Medical'
        : fieldLocations().find(item => item.id === team.location)?.name || 'No post assigned';
}

function recordTeamChange(team, previous, at) {
    const changes = [];
    if (team.zone !== previous.zone || (team.zone === 'field-zone' && team.location !== previous.location)) {
        changes.push(`Reassigned from ${teamLocationName(previous)} to ${teamLocationName(team)}`);
    }
    if (team.status !== previous.status) {
        changes.push(`${statusNames[previous.status]} → ${statusNames[team.status]}`);
    }
    if (changes.length) recordTimestamp(team, changes.join(' · '), at);
}

function renderTimestamps() {
    const empty = handoffLog.length === 0;
    document.getElementById('timestamp-empty').hidden = !empty;
    document.getElementById('timestamp-scroll').hidden = empty;
    document.getElementById('timestamp-list').innerHTML = handoffLog.slice().reverse().map(({ at, team, message }) => {
        const timestamp = `${timestampDateFormatter.format(at)} · ${pacificFormatter.format(at)}`;
        return `<li><time datetime="${new Date(at).toISOString()}">${timestamp}</time><span><strong>${escapeHTML(team)}</strong> · ${escapeHTML(message)}</span></li>`;
    }).join('');
}

function updateMealBreakTimers(now) {
    document.querySelectorAll('.meal-break-row[data-deadline]').forEach(row => {
        const remaining = Number(row.dataset.deadline) - now;
        const seconds = remaining > 0 ? Math.ceil(remaining / 1000) : Math.floor(-remaining / 1000);
        const timer = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        row.dataset.overdue = String(remaining <= 0);
        row.querySelector('.meal-break-time').textContent = remaining > 0 ? `${timer} left` : `Overdue · ${timer}`;
    });
}

function renderMealBreaks(sortedTeams) {
    const list = document.getElementById('meal-break-list');
    const count = document.getElementById('meal-break-count');
    const returned = sortedTeams.filter(team => team.mealBreak?.returnedAt != null).length;
    count.textContent = `${returned}/${sortedTeams.length} returned`;
    count.hidden = sortedTeams.length === 0;
    document.getElementById('meal-break-empty').hidden = sortedTeams.length > 0;
    list.replaceChildren();

    for (const team of sortedTeams) {
        const row = document.createElement('li');
        row.className = 'meal-break-row';
        row.id = `meal-break-${team.id}`;
        row.tabIndex = -1;
        const onBreak = isOnMealBreak(team);
        row.dataset.active = String(onBreak);

        const info = document.createElement('div');
        const name = document.createElement('strong');
        name.className = 'meal-break-name';
        name.textContent = team.name;
        const detail = document.createElement('span');
        detail.className = 'meal-break-detail';
        info.append(name, detail);
        row.append(info);

        if (onBreak) {
            const deadline = team.mealBreak.startedAt + mealBreakDuration;
            row.dataset.deadline = deadline;
            detail.textContent = `Return ETA ${pacificFormatter.format(deadline)}`;
            const timer = document.createElement('span');
            timer.className = 'meal-break-time';
            timer.setAttribute('role', 'timer');
            info.append(timer);
        } else if (team.mealBreak) {
            const { startedAt, returnedAt } = team.mealBreak;
            const label = returnedAt - startedAt < mealBreakDuration ? 'Back early' : 'Back on assignment';
            detail.textContent = `${label} · ${pacificFormatter.format(returnedAt)}`;
        } else {
            detail.textContent = 'Break pending';
        }

        if (onBreak || !team.mealBreak) {
            const action = document.createElement('button');
            action.type = 'button';
            action.className = 'secondary-btn';
            action.textContent = onBreak ? 'Clear break' : 'Start meal';
            action.setAttribute('aria-label', `${action.textContent} for ${team.name}`);
            action.addEventListener('click', () => {
                toggleMealBreak(team.id);
                const updatedRow = document.getElementById(row.id);
                (updatedRow.querySelector('button') || updatedRow).focus({ preventScroll: true });
            });
            row.append(action);
        }
        list.append(row);
    }
    updateMealBreakTimers(Date.now());
}

function toggleMealBreak(id) {
    const team = teams.find(item => item.id === id);
    if (!team || (team.mealBreak && !isOnMealBreak(team))) return;
    rememberChange();
    const now = Date.now();
    if (isOnMealBreak(team)) {
        const returnedAt = Math.max(now, team.mealBreak.startedAt);
        team.mealBreak.returnedAt = returnedAt;
        const early = returnedAt - team.mealBreak.startedAt < mealBreakDuration;
        recordTimestamp(team, early ? 'Returned early from meal break' : 'Returned from meal break', returnedAt);
    } else {
        team.mealBreak = { startedAt: now, returnedAt: null };
        recordTimestamp(team, 'Started meal break', now);
    }
    refresh();
}

function setBadgeLabel(badge, team) {
    const location = teamLocationName(team);
    const mealBreakLabel = isOnMealBreak(team) ? ' · On meal break' : '';
    badge.title = `${team.name}: ${statusNames[team.status]} · ${location}${mealBreakLabel}`;
    badge.setAttribute('aria-label', badge.title);
}

function renderBoard() {
    renderVenueControls();
    const field = document.getElementById('field-locations');
    const clinic = document.getElementById('clinic-grid');
    const details = document.getElementById('team-details');
    details.replaceChildren();
    document.getElementById('roster-empty').hidden = teams.length > 0;
    field.replaceChildren();
    clinic.replaceChildren();
    const grids = new Map();
    visibleFieldLocations().forEach(location => {
        const section = document.createElement('section');
        section.className = 'field-location';
        section.dataset.location = location.id;
        section.setAttribute('aria-label', location.name);
        section.addEventListener('dragover', allowDrop);
        section.addEventListener('dragleave', dragLeave);
        section.addEventListener('drop', e => drop(e, 'field-zone', location.id));
        const header = document.createElement('div');
        header.className = 'location-header';
        const isVenuePost = venuePosts.some(post => post.id === location.id);
        if (isVenuePost && selectedVenue === 'bill-graham') {
            const select = document.createElement('select');
            select.className = 'post-name-select';
            select.setAttribute('aria-label', `Post name for ${location.name}`);
            select.innerHTML = billGrahamPostOptions(location.id);
            select.addEventListener('change', event => changeVenuePost(location.id, event.target.value));
            header.appendChild(select);
            section.classList.add('venue-board-post');
        } else if (builtInLocations.some(l => l.id === location.id) || isVenuePost) {
            const title = document.createElement('h3');
            title.textContent = location.name;
            header.appendChild(title);
        } else {
            const name = document.createElement('input');
            name.type = 'text'; name.value = location.name; name.maxLength = 60;
            name.setAttribute('aria-label', 'Post name');
            name.title = 'Edit post name';
            name.addEventListener('change', () => renameLocation(location.id, name.value));
            name.addEventListener('keydown', e => { if (e.key === 'Enter') name.blur(); });
            header.appendChild(name);
        }
        const count = document.createElement('span');
        count.className = 'location-count';
        const total = teams.filter(t => t.zone === 'field-zone' && boardLocationForTeam(t) === location.id).length;
        count.textContent = `${total} unit${total !== 1 ? 's' : ''}`;
        header.appendChild(count);
        if (!builtInLocations.some(l => l.id === location.id) && (!isVenuePost || selectedVenue === 'bill-graham')) {
            const remove = document.createElement('button');
            remove.className = 'remove-location'; remove.textContent = '×';
            remove.title = 'Remove post';
            remove.setAttribute('aria-label', `Remove post ${location.name}`);
            remove.addEventListener('click', () => removeLocation(location.id));
            header.appendChild(remove);
        }
        const grid = document.createElement('div');
        grid.className = 'badge-grid';
        if (location.id === 'unassigned') grid.id = 'field-grid';
        section.append(header, grid); field.appendChild(section); grids.set(location.id, grid);
        if (location.id === 'pit-table-service') {
            section.classList.add('fixed-posts');
            grid.classList.add('fixed-general-grid');
            for (const post of venuePosts.filter(post => post.fixed && (selectedVenue === 'bill-graham'
                || teams.some(team => team.zone === 'field-zone' && team.location === post.id)))) {
                const subpost = document.createElement('section');
                subpost.className = 'fixed-subpost'; subpost.dataset.location = post.id; subpost.tabIndex = -1;
                subpost.setAttribute('aria-label', `${post.name}, fixed post`);
                const count = teams.filter(team => team.zone === 'field-zone' && team.location === post.id).length;
                subpost.innerHTML = `<div class="location-header"><h4>${escapeHTML(post.name)}</h4>${post.id === 'venue-1-pit' ? `<select id="board-pit-side" class="pit-side-select" aria-label="Pit side">${pitSideOptions()}</select>` : ''}<span class="location-count">${count} unit${count === 1 ? '' : 's'}</span></div>`;
                subpost.querySelector('.pit-side-select')?.addEventListener('change', event => changePitSide(event.target.value, event.target.id));
                const postGrid = document.createElement('div');
                postGrid.className = 'badge-grid';
                subpost.append(postGrid);
                subpost.addEventListener('dragover', allowDrop);
                subpost.addEventListener('dragleave', dragLeave);
                subpost.addEventListener('drop', event => drop(event, 'field-zone', post.id));
                section.append(subpost); grids.set(post.id, postGrid);
            }
        }
    });

    const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }));
    sortedTeams.forEach(team => {
        const onBreak = isOnMealBreak(team);
        const mealBreakFlag = onBreak ? '<span class="meal-break-flag">On meal break</span>' : '';
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'team-badge'; badge.dataset.status = team.status;
        if (isFixedPost(team)) badge.dataset.fixedPost = 'true';
        if (onBreak) badge.dataset.mealBreak = 'true';
        badge.draggable = true; badge.id = team.id;
        if (team.status === 'onscene') {
            badge.setAttribute('aria-haspopup', 'dialog');
            badge.setAttribute('aria-expanded', 'false');
        }
        setBadgeLabel(badge, team);
        badge.innerHTML = `<span class="team-name">${escapeHTML(team.name)}</span><span class="team-status">${statusNames[team.status]}</span><span class="team-timer" data-since="${team.statusSince}" aria-hidden="true">${elapsedStatus(team.statusSince)}</span>${mealBreakFlag}`;
        badge.addEventListener('click', e => {
            if (Date.now() - lastDragEnd < 300) return;
            cycleTeamStatus(team.id, 'dispatch', e.detail === 0);
        });
        badge.addEventListener('dragstart', dragStart);
        badge.addEventListener('dragend', () => {
            lastDragEnd = Date.now();
            badge.classList.remove('dragging');
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });
        (team.zone === 'clinic-zone' ? clinic : grids.get(team.location) || grids.get('unassigned')).appendChild(badge);

        const row = document.createElement('tr');
        row.dataset.teamId = team.id;
        if (isFixedPost(team)) row.dataset.fixedPost = 'true';
        if (onBreak) row.dataset.mealBreak = 'true';
        row.innerHTML = `
            <th scope="row">${escapeHTML(team.name)}${mealBreakFlag}</th>
            <td><select id="status-${team.id}" aria-label="Unit status for ${escapeHTML(team.name)}" class="status-select" data-status="${team.status}">
                ${Object.entries(statusNames).map(([value, label]) => `<option value="${value}" ${team.status === value ? 'selected' : ''}>${label}</option>`).join('')}
            </select></td>
            <td><select id="location-${team.id}" class="location-select" aria-label="Post for ${escapeHTML(team.name)}">
                ${postOptions(team)}
            </select></td>
            <td><button type="button" title="Remove unit" aria-label="Remove ${escapeHTML(team.name)}" class="delete-btn">×</button></td>`;
        row.querySelector('.delete-btn').addEventListener('click', () => deleteTeam(team.id));
        row.querySelector('.status-select').addEventListener('change', e => {
            updateStatus(team.id, e.target.value);
            document.getElementById(`status-${team.id}`)?.focus({ preventScroll: true });
        });
        row.querySelector('.location-select').addEventListener('change', e => {
            moveTeam(team.id, e.target.value);
            document.getElementById(`location-${team.id}`)?.focus({ preventScroll: true });
        });
        details.appendChild(row);
    });
    for (const grid of [clinic, ...grids.values()]) {
        grid.style.setProperty('--unit-count', Math.max(1, grid.children.length));
    }
    renderMealBreaks(sortedTeams);
    renderTimestamps();
    const fieldCount = teams.filter(t => t.zone === 'field-zone').length;
    const clinicCount = teams.length - fieldCount;
    const roamingCount = teams.filter(t => t.status === 'roaming' && t.zone === 'field-zone'
        && !isFixedPost(t) && !isOnMealBreak(t)).length;
    document.querySelectorAll('.level-meter').forEach(meter => {
        meter.dataset.empty = String(roamingCount === 0);
        const value = meter.querySelector('[data-level-value]');
        if (value.textContent !== String(roamingCount)) value.textContent = roamingCount;
    });
    for (const status of ['onscene', 'transporting', 'atclinic']) {
        document.getElementById(`${status}-total`).textContent = teams.filter(team => team.status === status).length;
    }
    document.getElementById('field-count').textContent = `${fieldCount} unit${fieldCount !== 1 ? 's' : ''}`;
    document.getElementById('clinic-count').textContent = `${clinicCount} unit${clinicCount !== 1 ? 's' : ''}`;
    document.getElementById('undo-button').disabled = undoHistory.length === 0;
}
function refresh() { hideCallActions(); renderBoard(); renderVenue(); saveBoard(); }
function addTeam() {
    const input = document.getElementById('newTeamInput');
    const name = input.value.trim();
    if (!name) return;
    const error = document.getElementById('form-error');
    if (teams.some(team => team.name.toLowerCase() === name.toLowerCase())) {
        error.textContent = `Call sign ${name} is already assigned.`;
        error.hidden = false;
        input.focus();
        return;
    }
    error.hidden = true;
    rememberChange();
    teams.push({ id: newId('t_'), name, status: 'roaming', zone: 'field-zone', location: 'unassigned', statusSince: Date.now(), mealBreak: null });
    input.value = ''; refresh(); input.focus();
}
function deleteTeam(id) {
    if (!teams.some(t => t.id === id)) return;
    rememberChange(); teams = teams.filter(t => t.id !== id); refresh();
}
function addLocation() {
    if (selectedVenue === 'bill-graham') {
        const id = document.getElementById('newVenuePostSelect').value;
        const post = venuePosts.find(post => post.id === id);
        if (!post) return;
        if (post.fixed) { document.querySelector(`[data-location="${id}"]`)?.focus({ preventScroll: true }); return; }
        if (!venueBoardPosts.includes(id)) {
            rememberChange();
            venueBoardPosts.push(id);
            refresh();
        }
        document.querySelector(`[data-location="${id}"] .post-name-select`)?.focus({ preventScroll: true });
        return;
    }
    const input = document.getElementById('newLocationInput');
    const name = input.value.trim(); if (!name) return;
    rememberChange();
    locations.push({ id: newId('loc_'), name });
    input.value = ''; refresh(); input.focus();
}
function renameLocation(id, name) {
    const location = locations.find(item => item.id === id);
    const section = document.querySelector(`[data-location="${id}"]`);
    const input = section.querySelector('input');
    input.value = name.trim() || location.name;
    if (input.value === location.name) return;

    rememberChange();
    location.name = input.value;
    section.setAttribute('aria-label', location.name);
    section.querySelector('.remove-location').setAttribute('aria-label', `Remove post ${location.name}`);
    document.querySelectorAll(`.location-select option[value="${id}"]`).forEach(option => {
        option.textContent = location.name;
    });
    teams.filter(team => team.zone === 'field-zone' && team.location === id).forEach(team => {
        setBadgeLabel(document.getElementById(team.id), team);
    });
    renderVenue();
    saveBoard();
}
function removeLocation(id) {
    const isVenuePost = venuePosts.some(post => post.id === id);
    if (!locations.some(l => l.id === id) && !(selectedVenue === 'bill-graham' && isVenuePost)) return;
    rememberChange();
    const now = Date.now();
    teams.filter(team => team.location === id).forEach(team => {
        const previous = { ...team };
        team.location = 'unassigned';
        recordTeamChange(team, previous, now);
    });
    if (isVenuePost) venueBoardPosts = venueBoardPosts.filter(postId => postId !== id);
    else locations = locations.filter(l => l.id !== id);
    refresh();
}
function changeVenuePost(from, destination) {
    if (selectedVenue !== 'bill-graham' || from === destination
        || !venuePosts.some(post => post.id === from) || !venuePosts.some(post => post.id === destination)) return;
    rememberChange();
    venueBoardPosts = [...new Set([...venueBoardPosts.map(id => id === from ? destination : id), destination])]
        .filter(id => !venuePosts.find(post => post.id === id)?.fixed);
    const now = Date.now();
    teams.filter(team => team.zone === 'field-zone' && team.location === from)
        .forEach(team => applyTeamMove(team, destination, now));
    refresh();
    (document.querySelector(`[data-location="${destination}"] .post-name-select`)
        || document.querySelector(`[data-location="${destination}"]`))?.focus({ preventScroll: true });
}
function updateStatus(id, status) {
    const team = teams.find(t => t.id === id);
    if (!team || !Object.prototype.hasOwnProperty.call(statusNames, status) || team.status === status) return;
    rememberChange();
    const previous = { ...team };
    team.status = status;
    team.statusSince = Date.now();
    team.zone = status === 'atclinic' ? 'clinic-zone' : 'field-zone';
    recordTeamChange(team, previous, team.statusSince);
    refresh();
}
function moveTeam(id, location) {
    location = canonicalLocation(location);
    const team = teams.find(t => t.id === id);
    if (!team) return;
    if (location !== 'clinic-zone' && !validLocation(location)) return;
    if (location === 'clinic-zone' ? team.zone === 'clinic-zone' : team.zone === 'field-zone' && team.location === location) return;
    rememberChange();
    applyTeamMove(team, location);
    refresh();
}
function applyTeamMove(team, location, now = Date.now()) {
    const previous = { ...team };
    if (location === 'clinic-zone') {
        team.zone = 'clinic-zone'; team.status = 'atclinic';
    } else {
        team.zone = 'field-zone'; team.location = location;
        if (team.status === 'atclinic') team.status = 'roaming';
    }
    if (team.status !== previous.status) team.statusSince = now;
    recordTeamChange(team, previous, now);
}
function dragStart(e) {
    hideCallActions();
    e.dataTransfer.setData('text/plain', e.currentTarget.id);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
}
function allowDrop(e) { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('drag-over'); }
function dragLeave(e) { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('drag-over'); }
function drop(e, zoneId, location = 'unassigned') {
    e.preventDefault(); e.stopPropagation();
    stopDragScroll();
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    moveTeam(e.dataTransfer.getData('text/plain'), zoneId === 'clinic-zone' ? 'clinic-zone' : location);
}

// Both views use team.location and moveTeam. The map never keeps a second unit list.
function pitSideOptions() {
    return Object.entries(pitSides).map(([value, side]) => `<option value="${value}"${value === pitSide ? ' selected' : ''}>${side.label}</option>`).join('');
}
function changePitSide(side, sourceId) {
    if (!validPitSide(side) || side === pitSide) return;
    rememberChange();
    pitSide = side;
    refresh();
    if (sourceId) document.getElementById(sourceId)?.focus({ preventScroll: true });
}
function billGrahamPostOptions(current) {
    const option = post => `<option value="${post.id}"${current === post.id ? ' selected' : ''}>${escapeHTML(post.name)}</option>`;
    return `<optgroup label="Bill Graham posts">${defaultVenueBoardPosts.map(id => venuePosts.find(post => post.id === id)).map(option).join('')}</optgroup>`
        + `<optgroup label="Fixed posts">${venuePosts.filter(post => post.fixed).map(option).join('')}</optgroup>`
        + `<optgroup label="Additional locations">${venuePosts.filter(post => post.level === 'outside').map(option).join('')}</optgroup>`
        + venueLevels.map(level => {
            const additional = venuePosts.filter(post => post.level === level.id && !post.fixed && !defaultVenueBoardPosts.includes(post.id));
            return additional.length ? `<optgroup label="${level.name}">${additional.map(option).join('')}</optgroup>` : '';
        }).join('');
}
function renderVenueControls() {
    const billGraham = selectedVenue === 'bill-graham';
    document.body.dataset.venue = selectedVenue;
    document.getElementById('venue-select').value = selectedVenue;
    document.getElementById('map-pit-side').value = pitSide;
    document.getElementById('custom-post-field').hidden = billGraham;
    document.getElementById('venue-post-field').hidden = !billGraham;
    document.getElementById('newLocationInput').required = !billGraham;
    const select = document.getElementById('newVenuePostSelect');
    const value = select.value;
    select.innerHTML = billGraham ? billGrahamPostOptions(value) : '';
    for (const location of optionalVenueLocations) {
        document.getElementById(location.toggle).checked = additionalVenueLocations.includes(location.id);
        const count = teams.filter(team => venuePostForTeam(team)?.level === location.id).length;
        document.getElementById(location.label).textContent = `${location.name}${count ? ` (${count})` : ''}`;
    }
}
function visibleVenueLevels() {
    return venueLevels.filter(level => !optionalVenueLocations.some(location => location.id === level.id)
        || additionalVenueLocations.includes(level.id));
}
function toggleAdditionalVenueLocation(id, enabled) {
    if (selectedVenue !== 'bill-graham' || !optionalVenueLocations.some(location => location.id === id)
        || additionalVenueLocations.includes(id) === enabled) return;
    rememberChange();
    const posts = venuePosts.filter(post => post.level === id && !post.fixed).map(post => post.id);
    additionalVenueLocations = additionalVenueLocations.filter(location => location !== id);
    if (enabled) {
        additionalVenueLocations.push(id);
        venueBoardPosts = [...new Set([...venueBoardPosts, ...posts])];
    } else {
        venueBoardPosts = venueBoardPosts.filter(post => !posts.includes(post));
        if (venueFloor === id) venueFloor = 'all';
    }
    refresh();
}
function changeVenue(value) {
    const next = value === 'bill-graham' ? value : '';
    if (next === selectedVenue) return;
    rememberChange();
    selectedVenue = next;
    selectedVenueTeam = null;
    venueFloor = 'all';
    finishVenueDrag();
    refresh();
}
function postOptions(team) {
    const current = team.zone === 'clinic-zone' ? 'clinic-zone' : team.location;
    const option = post => `<option value="${post.id}"${current === post.id ? ' selected' : ''}>${escapeHTML(post.name)}</option>`;
    const standard = `<optgroup label="Board posts">${[...locations, ...builtInLocations].map(option).join('')}${option({ id: 'clinic-zone', name: 'Main Medical' })}</optgroup>`;
    if (selectedVenue === 'bill-graham') return standard + billGrahamPostOptions(current);
    const assigned = venuePosts.find(post => post.id === current);
    return standard + (assigned ? `<optgroup label="Current post">${option(assigned)}</optgroup>` : '');
}

function setView(view, focus = false) {
    hideCallActions();
    activeView = view;
    document.body.classList[view === 'venue' ? 'add' : 'remove']('is-venue-view');
    for (const name of ['dispatch', 'venue']) {
        const tab = document.getElementById(`${name}-tab`);
        const active = name === view;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        document.getElementById(`${name}-panel`).hidden = !active;
        if (active && focus) tab.focus();
    }
    if (view === 'venue') renderVenue();
}

function venueMessage(message) { document.getElementById('venue-feedback').textContent = message; }

function selectVenueTeam(id, focus = false) {
    if (selectedVenue !== 'bill-graham') return;
    const team = teams.find(item => item.id === id);
    if (!team) return;
    selectedVenueTeam = id;
    renderVenue();
    venueMessage(`${team.name} selected. Choose a destination on the map or use Move to.`);
    if (focus) document.querySelector(`#venue-unit-list [data-move-team="${id}"]`)?.focus({ preventScroll: true });
}

function cycleVenueTeamStatus(id, focus = false) {
    if (selectedVenue !== 'bill-graham') return;
    const team = teams.find(item => item.id === id);
    if (!team) return;
    selectedVenueTeam = id;
    cycleTeamStatus(id, 'venue', focus);
    venueMessage(callActionTeam === id ? `${team.name}: Choose Clear call or Start transport.` : `${team.name}: ${statusNames[team.status]}.`);
}

function moveVenueTeam(id, destination) {
    if (selectedVenue !== 'bill-graham') return;
    destination = canonicalLocation(destination);
    const team = teams.find(item => item.id === id);
    if (!team || ![...venuePosts, mainMedicalPost].some(post => post.id === destination)) return;
    selectedVenueTeam = id;
    const samePost = venuePostForTeam(team)?.id === destination;
    moveTeam(id, destination);
    if (samePost) renderVenue();
    const post = [...venuePosts, mainMedicalPost].find(item => item.id === destination);
    venueMessage(samePost ? `${team.name} is already at ${post.name}.` : `${team.name} moved to ${post.name}. Both views updated.`);
}

function renderVenue() {
    if (activeView !== 'venue') return;
    const billGraham = selectedVenue === 'bill-graham';
    document.getElementById('venue-content').hidden = !billGraham;
    document.getElementById('venue-no-view').hidden = billGraham;
    if (!billGraham) { document.getElementById('venue-canvas').replaceChildren(); return; }
    if (!teams.some(team => team.id === selectedVenueTeam)) selectedVenueTeam = null;
    const placed = teams.filter(team => venuePostForTeam(team)).length;
    document.getElementById('venue-unit-count').textContent = `${placed}/${teams.length} placed`;
    const visibleLevels = visibleVenueLevels();
    if (venueFloor !== 'all' && !visibleLevels.some(level => level.id === venueFloor)) venueFloor = 'all';
    document.getElementById('venue-levels').innerHTML = [{ id: 'all', short: 'All', name: 'All levels' }, ...visibleLevels].map(level => {
        const count = teams.filter(team => venuePostForTeam(team)?.level === level.id).length;
        return `<button type="button" data-venue-level="${level.id}" aria-label="${level.name}${level.id === 'all' ? '' : `, ${count} units`}" aria-pressed="${venueFloor === level.id}">${level.short}</button>`;
    }).join('');
    document.getElementById('venue-team-picker').innerHTML = '<option value="">Unit</option>' + [...teams].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true })).map(team => `<option value="${team.id}"${team.id === selectedVenueTeam ? ' selected' : ''}>${escapeHTML(team.name)}</option>`).join('');
    renderVenueUnits();
    renderVenueInspector();
    renderVenueMap();
}

function renderVenueUnits() {
    const search = document.getElementById('venue-search').value.trim().toLowerCase();
    const filter = document.getElementById('venue-unit-filter').value;
    const filtered = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }))
        .filter(team => team.name.toLowerCase().includes(search)
            && (filter !== 'unplaced' || !venuePostForTeam(team)) && (filter !== 'meal' || isOnMealBreak(team)));
    const empty = document.getElementById('venue-units-empty');
    empty.hidden = filtered.length > 0;
    empty.textContent = teams.length ? 'No matching units' : 'No units';
    document.getElementById('venue-unit-list').innerHTML = filtered.map(team => {
        const post = venuePostForTeam(team);
        const detail = post ? post.name : `Not placed · ${teamLocationName(team)}`;
        return `<button type="button" class="venue-unit" draggable="true" data-move-team="${team.id}" data-status="${team.status}"${isFixedPost(team) ? ' data-fixed-post="true"' : ''}${isOnMealBreak(team) ? ' data-meal-break="true"' : ''} aria-pressed="${selectedVenueTeam === team.id}" aria-label="Select ${escapeHTML(team.name)}, ${escapeHTML(detail)}, ${statusNames[team.status]}${isOnMealBreak(team) ? ', on meal break' : ''}"><span class="venue-unit-name">${escapeHTML(team.name)}</span><span class="venue-unit-state">${isOnMealBreak(team) ? 'Meal break' : statusNames[team.status]}</span><span class="venue-unit-post">${escapeHTML(detail)}</span></button>`;
    }).join('');
}

function renderVenueInspector() {
    const team = teams.find(item => item.id === selectedVenueTeam);
    document.getElementById('venue-inspector').hidden = !team;
    document.getElementById('venue-selection').hidden = !team;
    document.getElementById('venue-canvas').dataset.selecting = String(Boolean(team));
    if (!team) return;
    document.getElementById('venue-selected-name').textContent = team.name;
    document.getElementById('venue-selected-post').textContent = venuePostForTeam(team)?.name || `Not placed · ${teamLocationName(team)}`;
    const status = document.getElementById('venue-selected-status');
    status.dataset.status = team.status;
    status.innerHTML = Object.entries(statusNames).map(([value, label]) => `<option value="${value}"${value === team.status ? ' selected' : ''}>${label}</option>`).join('');
    document.getElementById('venue-selected-destination').innerHTML = postOptions(team);
    const mealButton = document.getElementById('venue-meal-action');
    mealButton.hidden = Boolean(team.mealBreak && !isOnMealBreak(team));
    mealButton.textContent = isOnMealBreak(team) ? 'Return from meal break' : 'Start meal break';
    document.getElementById('venue-selected-break').textContent = isOnMealBreak(team)
        ? `On meal break · Return ETA ${pacificFormatter.format(team.mealBreak.startedAt + mealBreakDuration)}`
        : team.mealBreak ? `Meal break completed · ${pacificFormatter.format(team.mealBreak.returnedAt)}` : '';
}

function renderVenueMap() {
    if (callActionView === 'venue') hideCallActions();
    if (selectedVenue !== 'bill-graham') return;
    const angle = venueAngle * Math.PI / 180;
    const visible = visibleVenueLevels();
    const focused = venueFloor !== 'all';
    const floors = focused ? visible.filter(level => level.id === venueFloor) : [...visible].reverse();
    const threeFloorView = !focused && additionalVenueLocations.length === 0;
    const slabDepth = (270 * Math.abs(Math.sin(angle)) + 110 * Math.abs(Math.cos(angle))) * .3;
    const mapCenter = threeFloorView ? 425 : 500;
    const mapWidth = threeFloorView ? 760 : 840;
    const atPost = id => teams.filter(team => venuePostForTeam(team)?.id === id)
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
    const rowHeight = 44;
    const columns = (post, count) => post.side === 'Basement' ? Math.min(5, Math.max(1, count))
        : post.fixed ? Math.min(2, Math.max(1, count))
        : post.roaming ? Math.min(3, Math.max(1, count))
        : post.side === 'Grove' && !['1', '2'].includes(post.level) ? Math.min(3, Math.max(1, count)) : 1;
    let cursor = threeFloorView ? 4 : 12;
    const layout = floors.map(level => {
        const rowCounts = venuePosts.filter(post => post.level === level.id).map(post => {
            const count = atPost(post.id).length;
            return Math.ceil(count / columns(post, count));
        });
        if (level.id === '4') rowCounts.push(atPost('clinic-zone').length + atPost('venue-4-polk').length);
        const roamingStretch = Math.max(0, Math.ceil(atPost(`venue-${level.id}-roaming`).length / 3) - 1) * rowHeight;
        const roamingPadding = atPost(`venue-${level.id}-roaming`).length ? 28 + roamingStretch / 4 : 0;
        const band = Math.max((threeFloorView ? slabDepth * 2 + 24 : 154) + roamingStretch + roamingPadding,
            (threeFloorView ? 90 : 110) + Math.max(0, ...rowCounts) * rowHeight);
        const item = { level, y: cursor + (threeFloorView ? slabDepth + 12 : 80), band, roamingStretch, roamingPadding };
        cursor += band;
        return item;
    });
    const outsideMembers = atPost('venue-outside');
    const outsideVisible = additionalVenueLocations.includes('outside');
    const outsideColumns = Math.min(3, Math.max(1, outsideMembers.length));
    const outsideY = cursor + 10;
    const outsideRows = Math.max(1, Math.ceil(outsideMembers.length / outsideColumns));
    const outsideRx = 170;
    const outsideHalfWidth = (outsideColumns - 1) * 44 + 24;
    const outsideRy = Math.max(48, Math.ceil(((outsideRows - 1) * rowHeight / 2 + 30)
        / Math.sqrt(1 - (outsideHalfWidth / outsideRx) ** 2)));
    const outsideCenterY = outsideY + outsideRy;
    const height = Math.max(focused ? 240 : 0, outsideVisible ? outsideY + outsideRy * 2 + 20 : cursor + 12);
    const project = (x, z, y, bottom = 0) => [mapCenter + x * Math.cos(angle) - z * Math.sin(angle), y + (x * Math.sin(angle) + z * Math.cos(angle)) * .3 + bottom];
    const points = (coords, y, bottom = 0, stretch = 0) => coords.map(([x, z]) => {
        const point = project(x, z, y, bottom);
        point[1] += stretch * (z + 110) / 220;
        return point.map(n => n.toFixed(1)).join(',');
    }).join(' ');
    const box = (x1, z1, x2, z2) => [[x1, z1], [x2, z1], [x2, z2], [x1, z2]];
    const outer = box(-270, -110, 270, 110);
    const ballColors = {
        roaming: ['#b5efd1', '#278159', '#145c3e'], onscene: ['#ffbfc9', '#ce405b', '#96273e'],
        transporting: ['#ffe1a8', '#b27a1e', '#805008'], atclinic: ['#b6dcff', '#3b81c9', '#245993'],
        meal: ['#e0e6e2', '#87958c', '#5c6a61'], fixed: ['#eceff0', '#b8c0c4', '#909ba1']
    };
    const gradients = Object.entries(ballColors).map(([status, colors]) => `<radialGradient id="venue-ball-${status}" cx="32%" cy="25%" r="75%"><stop offset="0" stop-color="${colors[0]}"/><stop offset=".55" stop-color="${colors[1]}"/><stop offset="1" stop-color="${colors[2]}"/></radialGradient>`).join('');
    const teamMarker = (team, post, x, markerY) => {
        const label = team.name.length > 14 ? `${team.name.slice(0, 13)}…` : team.name;
        const status = isOnMealBreak(team) ? 'meal' : isFixedPost(team) ? 'fixed' : team.status;
        return `<g class="venue-map-unit${team.id === selectedVenueTeam ? ' is-selected' : ''}" data-map-team="${team.id}" data-status="${team.status}"${isFixedPost(team) ? ' data-fixed-post="true"' : ''}${isOnMealBreak(team) ? ' data-meal-break="true"' : ''}${team.status === 'onscene' ? ' aria-haspopup="dialog" aria-expanded="false"' : ''} role="button" tabindex="0" aria-label="Change status for ${escapeHTML(team.name)}, ${escapeHTML(post.name)}, ${statusNames[team.status]}${isOnMealBreak(team) ? ', on meal break' : ''}"><title>${escapeHTML(team.name)} · ${escapeHTML(post.name)} · ${statusNames[team.status]}${isFixedPost(team) ? ' · Fixed post' : ''}${isOnMealBreak(team) ? ' · On meal break' : ''}</title><circle class="venue-unit-hit" cx="${x}" cy="${markerY - 5}" r="23"/><ellipse class="venue-ball-shadow" cx="${x + 1}" cy="${markerY + 9}" rx="8" ry="2.5"/><circle class="venue-selection-ring" cx="${x}" cy="${markerY}" r="13"/><circle class="venue-unit-ball" cx="${x}" cy="${markerY}" r="8" fill="url(#venue-ball-${status})"/><text x="${x}" y="${markerY - 16}" text-anchor="middle" class="venue-marker-name">${escapeHTML(label)}</text></g>`;
    };
    let drawing = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mapWidth} ${height}" role="group" aria-labelledby="venue-svg-title"><title id="venue-svg-title">Bill Graham Civic Auditorium · ${focused ? floors[0].name : '3D view'}</title><defs>${gradients}</defs>`;
    for (const { level, y, roamingStretch, roamingPadding } of [...layout].reverse()) {
        const count = teams.filter(team => venuePostForTeam(team)?.level === level.id).length;
        const floorStretch = level.id === 'b' ? Math.max(0, Math.ceil(count / 5) - 1) * rowHeight : roamingStretch + roamingPadding;
        const floorPoint = (x, z, bottom = 0) => {
            const point = project(x, z, y, bottom);
            point[1] += floorStretch * (z + 110) / 220;
            return point;
        };
        drawing += `<g class="venue-floor" data-floor="${level.id}"><text x="24" y="${y - 2}" class="venue-floor-name">${level.name}</text><text x="24" y="${y + 18}" class="venue-floor-detail">${count} unit${count === 1 ? '' : 's'}</text>`;
        for (const edge of [[outer[1], outer[2]], [outer[2], outer[3]], [outer[3], outer[0]]]) {
            const face = [...edge.map(([x, z]) => floorPoint(x, z)), ...edge.slice().reverse().map(([x, z]) => floorPoint(x, z, 6))];
            drawing += `<polygon points="${face.map(p => p.join(',')).join(' ')}" class="venue-slab-edge"/>`;
        }
        drawing += `<polygon points="${points(outer, y, 0, floorStretch)}" class="venue-slab"/>`;
        if (level.id === '1') {
            const [sx, sy] = floorPoint(0, -96);
            drawing += `<polygon points="${points(box(-120, -107, 120, -85), y, 0, floorStretch)}" class="venue-stage"/><text x="${sx}" y="${sy + 3}" text-anchor="middle" class="venue-stage-label">STAGE</text>`;
        }
        const hasRoaming = ['1', '2'].includes(level.id);
        const groveHasTableService = level.id === '1';
        const shapes = level.id === 'b' ? [
            { id: 'venue-b-basement', side: 'Basement', coords: outer, x: 0, z: 0 }
        ] : [
            { id: `venue-${level.id}-polk`, side: 'Polk', coords: box(170, level.id === '4' ? 0 : -110, 270, 110), x: 220, z: level.id === '4' ? 65 : 0 },
            { id: `venue-${level.id}-larkin`, side: 'Larkin', coords: box(-270, -110, -170, 110), x: -220, z: 0 },
            { id: `venue-${level.id}-grove`, side: 'Grove', coords: box(groveHasTableService ? -65 : -165, 62, 165, 110), x: groveHasTableService ? 50 : 0, z: 89 }
        ];
        if (hasRoaming) shapes.push({ id: `venue-${level.id}-roaming`, side: 'Roaming', label: 'ROAMING', coords: box(-165, groveHasTableService ? -4 : -70, 165, 58), x: 0, z: 0 });
        if (groveHasTableService) shapes.push({ id: 'venue-1-table-service', side: 'Grove', label: 'TABLE SERVICE', coords: box(-165, 62, -70, 110), x: -120, z: 89 });
        const pitPosition = pitSides[pitSide];
        if (level.id === '1') shapes.push({ id: 'venue-1-pit', side: 'Pit', coords: box(pitPosition.minX, -80, pitPosition.maxX, -5), x: pitPosition.x, z: -65 });
        if (level.id === '4') shapes.push({ id: 'clinic-zone', side: 'Main Medical', coords: box(170, -110, 270, -6), x: 220, z: -70 });
        // Destination surfaces paint before markers, so no neighboring zone can cover a unit.
        const zoneData = shapes.map(shape => {
            const members = atPost(shape.id);
            const medical = shape.id === 'clinic-zone';
            const post = medical ? mainMedicalPost : venuePosts.find(post => post.id === shape.id);
            const description = shape.id === 'venue-1-pit'
                ? `${pitSide === 'stage-left' ? 'stage left' : 'stage right'} inside 1st floor auditorium, near ${pitPosition.street}`
                : post.mapDescription;
            const [cx, projectedY] = project(shape.x, shape.z, y);
            const cy = projectedY + (roamingStretch + roamingPadding) * (shape.z + 110) / 220;
            const selected = members.some(team => team.id === selectedVenueTeam);
            const cls = `venue-destination${medical ? ' venue-medical' : ''}${post.fixed ? ' venue-fixed-post' : ''}${post.roaming ? ' venue-roaming' : ''}${selected ? ' venue-occupied-selected' : ''}`;
            drawing += `<g class="${cls}" data-venue-post="${shape.id}" data-venue-side="${shape.side}"><polygon points="${points(shape.coords, y, 0, floorStretch)}" class="venue-zone-surface" tabindex="0" role="button" aria-label="${escapeHTML(post.name)}${post.fixed ? `, fixed post, ${escapeHTML(description)}` : ''}, ${members.length} units"/></g>`;
            return { shape, members, cx, cy, post };
        });
        for (const { shape, members, cx, cy, post } of zoneData) {
            // Marker groups retain their destination for drag hit testing and keyboard moves.
            drawing += `<g class="venue-team-layer" data-venue-post="${shape.id}">`;
            const cols = columns(post, members.length);
            const medicalOffset = level.id === '4' && shape.side === 'Polk' ? Math.max(0, atPost('clinic-zone').length - 1) * rowHeight : 0;
            const labelY = post.roaming ? (members.length ? cy + roamingStretch / 2 + 25 : cy + 4)
                : shape.id === 'clinic-zone' || shape.side === 'Pit' ? cy - 37
                : cy + (members.length ? (Math.ceil(members.length / cols) - 1) * rowHeight + 25 + medicalOffset : 4);
            drawing += `<text x="${cx}" y="${labelY}" text-anchor="middle" class="venue-side-label${shape.id === 'clinic-zone' ? ' venue-medical-label' : ''}">${shape.id === 'clinic-zone' ? '+ MEDICAL' : shape.label || shape.side.toUpperCase()}</text>`;
            for (let slot = 0; slot < members.length; slot++) {
                const team = members[slot];
                const row = Math.floor(slot / cols);
                const rowSize = Math.min(cols, members.length - row * cols);
                const column = slot % cols - (rowSize - 1) / 2;
                const pitMarker = shape.side === 'Pit' ? floorPoint(shape.x + column * 80, shape.z) : null;
                const x = pitMarker ? pitMarker[0] : cx + column * (post.fixed ? 72 : 104);
                const markerY = (pitMarker ? pitMarker[1] : cy) + row * rowHeight + medicalOffset - (post.roaming ? roamingStretch / 2 : 0);
                drawing += teamMarker(team, post, x, markerY);
            }
            drawing += '</g>';
        }
        drawing += '</g>';
    }
    if (outsideVisible) {
        const post = venuePosts.find(post => post.id === 'venue-outside');
        drawing += `<g class="venue-outside-area" data-venue-post="${post.id}"><ellipse cx="${mapCenter}" cy="${outsideCenterY + 7}" rx="${outsideRx}" ry="${outsideRy}" class="venue-slab-edge"/><g class="venue-destination" data-venue-post="${post.id}"><ellipse cx="${mapCenter}" cy="${outsideCenterY}" rx="${outsideRx}" ry="${outsideRy}" class="venue-zone-surface" tabindex="0" role="button" aria-label="Outside of Venue, ${outsideMembers.length} units"/></g><text x="24" y="${outsideCenterY - 2}" class="venue-floor-name">Outside of Venue</text><text x="24" y="${outsideCenterY + 18}" class="venue-floor-detail">${outsideMembers.length} unit${outsideMembers.length === 1 ? '' : 's'}</text><g class="venue-team-layer" data-venue-post="${post.id}">`;
        for (let slot = 0; slot < outsideMembers.length; slot++) {
            const row = Math.floor(slot / outsideColumns);
            const rowSize = Math.min(outsideColumns, outsideMembers.length - row * outsideColumns);
            const x = mapCenter + (slot % outsideColumns - (rowSize - 1) / 2) * 88;
            drawing += teamMarker(outsideMembers[slot], post, x, outsideCenterY + (row - (outsideRows - 1) / 2) * rowHeight);
        }
        drawing += '</g></g>';
    }
    drawing += '</svg>';
    document.getElementById('venue-canvas').innerHTML = drawing;
    document.getElementById('venue-rotate-left').disabled = venueAngle <= -30;
    document.getElementById('venue-rotate-right').disabled = venueAngle >= 42;
}

function highlightVenueTarget(target) {
    document.querySelectorAll('.venue-destination.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
    if (target) document.querySelector(`.venue-destination[data-venue-post="${target.dataset.venuePost}"]`)?.classList.add('is-drop-target');
}

function finishVenueDrag() {
    stopDragScroll();
    document.querySelector('.venue-drag-ghost')?.remove();
    document.querySelectorAll('.venue-unit.dragging').forEach(el => el.classList.remove('dragging'));
    document.getElementById('venue-canvas').classList.remove('is-dragging');
    highlightVenueTarget(null);
    venueDrag = null;
}

function initializeVenue() {
    document.getElementById('map-pit-side').addEventListener('change', event => changePitSide(event.target.value, event.target.id));
    document.getElementById('venue-select').addEventListener('change', event => changeVenue(event.target.value));
    for (const location of optionalVenueLocations) document.getElementById(location.toggle).addEventListener('change', event => {
        toggleAdditionalVenueLocation(location.id, event.target.checked);
    });
    const additionalMenu = document.getElementById('venue-additional-locations');
    document.addEventListener('click', event => { if (!additionalMenu.contains(event.target)) additionalMenu.open = false; });
    additionalMenu.addEventListener('keydown', event => {
        if (event.key === 'Escape') { additionalMenu.open = false; additionalMenu.querySelector('summary').focus(); event.stopPropagation(); }
    });
    document.getElementById('venue-team-picker').addEventListener('change', event => {
        if (event.target.value) selectVenueTeam(event.target.value);
        else { selectedVenueTeam = null; renderVenue(); }
    });
    for (const name of ['dispatch', 'venue']) document.getElementById(`${name}-tab`).addEventListener('click', () => setView(name));
    document.querySelector('.view-tabs').addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        setView(event.key === 'Home' ? 'dispatch' : event.key === 'End' ? 'venue' : activeView === 'dispatch' ? 'venue' : 'dispatch', true);
    });
    document.getElementById('venue-levels').addEventListener('click', event => {
        const button = event.target.closest('[data-venue-level]');
        if (!button) return;
        venueFloor = button.dataset.venueLevel;
        renderVenue();
        document.querySelector(`[data-venue-level="${venueFloor}"]`).focus({ preventScroll: true });
    });
    document.getElementById('venue-rotate-left').addEventListener('click', () => { venueAngle = Math.max(-30, venueAngle - 12); renderVenueMap(); });
    document.getElementById('venue-rotate-right').addEventListener('click', () => { venueAngle = Math.min(42, venueAngle + 12); renderVenueMap(); });
    document.getElementById('venue-reset').addEventListener('click', () => { venueAngle = 18; venueFloor = 'all'; renderVenue(); });
    document.getElementById('venue-search').addEventListener('input', renderVenueUnits);
    document.getElementById('venue-unit-filter').addEventListener('change', renderVenueUnits);
    document.getElementById('venue-deselect').addEventListener('click', () => {
        selectedVenueTeam = null; renderVenue();
        venueMessage('Selection cleared.');
        document.getElementById('venue-search').focus({ preventScroll: true });
    });
    document.getElementById('venue-selected-status').addEventListener('change', event => updateStatus(selectedVenueTeam, event.target.value));
    document.getElementById('venue-selected-destination').addEventListener('change', event => {
        const id = selectedVenueTeam;
        moveTeam(id, event.target.value);
        const team = teams.find(item => item.id === id);
        if (team) venueMessage(`${team.name} moved to ${teamLocationName(team)}. Both views updated.`);
    });
    document.getElementById('venue-meal-action').addEventListener('click', () => {
        toggleMealBreak(selectedVenueTeam);
        const button = document.getElementById('venue-meal-action');
        (button.hidden ? document.getElementById('venue-selected-status') : button).focus({ preventScroll: true });
    });
    const list = document.getElementById('venue-unit-list');
    list.addEventListener('click', event => {
        const button = event.target.closest('[data-move-team]');
        if (button && Date.now() >= suppressVenueClickUntil) selectVenueTeam(button.dataset.moveTeam, event.detail === 0);
    });
    list.addEventListener('dragstart', event => {
        const button = event.target.closest('[data-move-team]');
        if (!button) return;
        selectedVenueTeam = button.dataset.moveTeam;
        event.dataTransfer.setData('text/plain', selectedVenueTeam);
        event.dataTransfer.effectAllowed = 'move';
        button.classList.add('dragging');
        document.getElementById('venue-canvas').classList.add('is-dragging');
        renderVenueInspector();
    });
    list.addEventListener('dragend', () => {
        suppressVenueClickUntil = Date.now() + 350;
        finishVenueDrag();
        renderVenue();
    });
    const canvas = document.getElementById('venue-canvas');
    canvas.addEventListener('dragover', event => {
        const target = event.target.closest('[data-venue-post]');
        if (target) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }
        highlightVenueTarget(target);
    });
    canvas.addEventListener('dragleave', event => { if (!canvas.contains(event.relatedTarget)) highlightVenueTarget(null); });
    canvas.addEventListener('drop', event => {
        event.preventDefault();
        const target = event.target.closest('[data-venue-post]');
        const id = event.dataTransfer.getData('text/plain');
        finishVenueDrag();
        suppressVenueClickUntil = Date.now() + 350;
        if (target) moveVenueTeam(id, target.dataset.venuePost);
    });
    const activateMap = event => {
        if (Date.now() < suppressVenueClickUntil) return;
        const unit = event.target.closest('[data-map-team]');
        if (unit) {
            cycleVenueTeamStatus(unit.dataset.mapTeam, event.type === 'keydown');
            return;
        }
        const target = event.target.closest('[data-venue-post]');
        if (!target) return;
        if (selectedVenueTeam) {
            const destination = target.dataset.venuePost;
            moveVenueTeam(selectedVenueTeam, destination);
            if (event.type === 'keydown') document.querySelector(`[data-venue-post="${destination}"] .venue-zone-surface`)?.focus({ preventScroll: true });
        } else venueMessage('Select a unit in the unit list first, then choose its destination.');
    };
    canvas.addEventListener('click', activateMap);
    canvas.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activateMap(event); }
    });
    canvas.addEventListener('pointerdown', event => {
        const unit = event.target.closest('[data-map-team]');
        if (unit && event.button === 0) venueDrag = { id: unit.dataset.mapTeam, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moving: false };
    });
    document.addEventListener('pointermove', event => {
        if (!venueDrag || event.pointerId !== venueDrag.pointerId) return;
        if (!venueDrag.moving && Math.hypot(event.clientX - venueDrag.x, event.clientY - venueDrag.y) < 6) return;
        event.preventDefault();
        if (!venueDrag.moving) {
            hideCallActions();
            venueDrag.moving = true;
            startDragScroll(event);
            const ghost = document.createElement('div');
            ghost.className = 'venue-drag-ghost';
            ghost.textContent = teams.find(team => team.id === venueDrag.id)?.name || '';
            document.body.append(ghost);
            canvas.classList.add('is-dragging');
        }
        const ghost = document.querySelector('.venue-drag-ghost');
        ghost.style.left = `${event.clientX + 14}px`;
        ghost.style.top = `${event.clientY - 18}px`;
        updateDragScroll(event);
        highlightVenueTarget(document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-venue-post]'));
    }, { passive: false });
    document.addEventListener('pointerup', event => {
        if (!venueDrag || event.pointerId !== venueDrag.pointerId) return;
        if (!venueDrag.moving) { venueDrag = null; return; }
        const id = venueDrag.id;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-venue-post]');
        suppressVenueClickUntil = Date.now() + 350;
        finishVenueDrag();
        if (target) moveVenueTeam(id, target.dataset.venuePost);
        else venueMessage('Move cancelled. The unit kept its post.');
    });
    document.addEventListener('pointercancel', finishVenueDrag);
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (callActionTeam) { event.preventDefault(); hideCallActions(true); return; }
        if (venueDrag) { suppressVenueClickUntil = Date.now() + 350; finishVenueDrag(); }
        else if (activeView === 'venue' && selectedVenueTeam) { selectedVenueTeam = null; renderVenue(); venueMessage('Selection cleared.'); }
    });
}
const pacificFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit',
    second: '2-digit', hourCycle: 'h23', timeZoneName: 'short'
});
const timestampDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: 'short', day: 'numeric'
});
function updateClock(now = new Date()) {
    const parts = pacificFormatter.formatToParts(now);
    const part = type => parts.find(p => p.type === type).value;
    const clock = document.getElementById('pacific-time');
    clock.textContent = `${part('hour')}:${part('minute')}:${part('second')}`;
    clock.dateTime = now.toISOString();
    document.getElementById('pacific-zone').textContent = part('timeZoneName');
}
updateClock();
setInterval(() => { updateClock(); updateTimers(); }, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { updateClock(); updateTimers(); } });
document.getElementById('team-form').addEventListener('submit', event => {
    event.preventDefault();
    addTeam();
});
document.getElementById('newTeamInput').addEventListener('input', () => {
    document.getElementById('form-error').hidden = true;
});
for (const zoneId of ['field-zone', 'clinic-zone']) {
    const zone = document.getElementById(zoneId);
    zone.addEventListener('dragover', allowDrop);
    zone.addEventListener('dragleave', dragLeave);
    zone.addEventListener('drop', event => drop(event, zoneId));
}
document.getElementById('location-form').addEventListener('submit', e => { e.preventDefault(); addLocation(); });
document.getElementById('shift-notes').value = savedNotes;
const notes = document.getElementById('shift-notes');
notes.addEventListener('beforeinput', () => { if (notesCheckpoint === null) notesCheckpoint = JSON.stringify(boardState()); });
notes.addEventListener('input', () => {
    if (notesCheckpoint !== 'recorded') {
        const snapshot = notesCheckpoint || JSON.stringify(boardState(savedNotes));
        rememberChange(snapshot);
        notesCheckpoint = 'recorded';
    }
    savedNotes = notes.value;
    saveBoard();
});
notes.addEventListener('blur', () => { notesCheckpoint = null; });
document.getElementById('undo-button').addEventListener('click', undoChange);
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z' && !e.target.closest('input, textarea, select, [contenteditable="true"]')) {
        e.preventDefault(); undoChange();
    }
});
initializeVenue();
initializeCallActions();
initializeDragScrolling();
refresh();

function replaceBoard(board) {
    rememberChange();
    teams = board.teams;
    locations = board.locations;
    handoffLog = board.handoffLog;
    selectedVenue = board.venue || '';
    venueBoardPosts = board.venueBoardPosts || [...defaultVenueBoardPosts];
    pitSide = validPitSide(board.pitSide) ? board.pitSide : 'stage-left';
    additionalVenueLocations = board.additionalVenueLocations || [];
    notes.value = savedNotes = board.notes;
    document.getElementById('form-error').hidden = true;
    refresh();
}

function showToolMessage(text) {
    const message = document.getElementById('tool-message');
    message.textContent = text;
    message.hidden = false;
}

document.getElementById('export-board').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([serializeBoard()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `dispatch-board-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});

const backupFile = document.getElementById('backup-file');
document.getElementById('import-board').addEventListener('click', () => backupFile.click());
backupFile.addEventListener('change', async () => {
    const file = backupFile.files[0];
    backupFile.value = '';
    if (!file) return;
    let backup;
    try {
        backup = readBoard(JSON.parse(await file.text()));
    } catch {
        showToolMessage('This file could not be read as a dispatch board backup.');
        return;
    }
    if (!confirm('Replace the current board with this backup?')) return;
    replaceBoard(backup);
    showToolMessage('Backup restored.');
});

document.getElementById('demo-board').addEventListener('click', () => {
    if ((teams.length || locations.length || notes.value || handoffLog.length) && !confirm('Replace this board with sample units?')) return;
    replaceBoard(readBoard({ teams: sampleTeams, locations: [], notes: '', venue: selectedVenue, venueBoardPosts, pitSide, additionalVenueLocations }));
    showToolMessage('Sample units loaded.');
});

document.getElementById('clear-board').addEventListener('click', () => {
    if (!confirm('Clear all units, custom posts, shift notes, and time stamp entries?')) return;
    replaceBoard({ teams: [], locations: [], notes: '', handoffLog: [], venue: selectedVenue, venueBoardPosts: [...defaultVenueBoardPosts], pitSide, additionalVenueLocations: [] });
    showToolMessage('Board cleared.');
});

if ('serviceWorker' in navigator && ['http:', 'https:'].includes(location.protocol)) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
        // The dispatch board is usable online if service workers are blocked.
    });
}
