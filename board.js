const storageKey = 'charlotte-dispatch-board-v1';
const mealBreakDuration = 30 * 60 * 1000;
const statusNames = { roaming: 'Roaming', onscene: 'On scene', transporting: 'Transporting', atclinic: 'At Medical' };
const builtInLocations = [{ id: 'pit-table-service', name: 'Fixed posts' }, { id: 'unassigned', name: 'No post assigned' }];
let locations = [];
const sampleTeams = [
    { id: 't1', name: 'DEMO-1', status: 'roaming', zone: 'field-zone', location: 'unassigned' },
    { id: 't2', name: 'DEMO-2', status: 'onscene', zone: 'field-zone', location: 'unassigned' },
    { id: 't3', name: 'DEMO-3', status: 'transporting', zone: 'field-zone', location: 'unassigned' },
    { id: 't4', name: 'DEMO-4', status: 'atclinic', zone: 'clinic-zone', location: 'unassigned' }
];
let teams = [];
let savedNotes = '';
let handoffLog = [];
const undoHistory = [];
let notesCheckpoint = null;
let lastDragEnd = 0;
function readBoard(saved) {
    if (!saved || !Array.isArray(saved.teams) || !Array.isArray(saved.locations)) {
        throw new Error('Invalid board');
    }
    const locationIds = new Set(builtInLocations.map(location => location.id));
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
        return {
            id: team.id, name: team.name, status: team.status,
            zone: team.status === 'atclinic' ? 'clinic-zone' : 'field-zone',
            location: locationIds.has(team.location) ? team.location : 'unassigned',
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
    ).map(({ at, team, message }) => ({ at, team, message })) : [];
    return { teams, locations, notes: typeof saved.notes === 'string' ? saved.notes : '', handoffLog };
}

try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== null) {
        const saved = readBoard(JSON.parse(raw));
        teams = saved.teams;
        locations = saved.locations;
        savedNotes = saved.notes;
        handoffLog = saved.handoffLog;
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
        indicator.textContent = 'Saved on this browser';
    } catch {
        indicator.dataset.error = 'true';
        indicator.textContent = 'Changes could not be saved. Download a backup before closing.';
    }
}
function newId(prefix) { return prefix + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9); }
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
}
function fieldLocations() { return [...locations, ...builtInLocations]; }
function boardState(notes = document.getElementById('shift-notes').value) {
    return { teams, locations, notes };
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
function nextStatus(status) {
    const order = Object.keys(statusNames);
    return order[(order.indexOf(status) + 1) % order.length];
}

function isOnMealBreak(team) {
    return team.mealBreak != null && team.mealBreak.returnedAt === null;
}

function recordHandoff(team, message, at) {
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
    if (changes.length) recordHandoff(team, changes.join(' · '), at);
}

function renderHandoffLog() {
    const empty = handoffLog.length === 0;
    document.getElementById('handoff-empty').hidden = !empty;
    document.getElementById('handoff-scroll').hidden = empty;
    document.getElementById('handoff-list').innerHTML = handoffLog.slice().reverse().map(({ at, team, message }) => {
        const timestamp = `${handoffDateFormatter.format(at)} · ${pacificFormatter.format(at)}`;
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
                rememberChange();
                const now = Date.now();
                if (onBreak) {
                    const returnedAt = Math.max(now, team.mealBreak.startedAt);
                    team.mealBreak.returnedAt = returnedAt;
                    const early = returnedAt - team.mealBreak.startedAt < mealBreakDuration;
                    recordHandoff(team, early ? 'Returned early from meal break' : 'Returned from meal break', returnedAt);
                } else {
                    team.mealBreak = { startedAt: now, returnedAt: null };
                    recordHandoff(team, 'Started meal break', now);
                }
                refresh();
                const updatedRow = document.getElementById(row.id);
                (updatedRow.querySelector('button') || updatedRow).focus({ preventScroll: true });
            });
            row.append(action);
        }
        list.append(row);
    }
    updateMealBreakTimers(Date.now());
}

function setBadgeLabel(badge, team) {
    const location = teamLocationName(team);
    const mealBreakLabel = isOnMealBreak(team) ? ' · On meal break' : '';
    badge.title = `${team.name}: ${statusNames[team.status]} · ${location}${mealBreakLabel}. Tap to change to ${statusNames[nextStatus(team.status)]}.`;
    badge.setAttribute('aria-label', badge.title);
}

function renderBoard() {
    const field = document.getElementById('field-locations');
    const clinic = document.getElementById('clinic-grid');
    const details = document.getElementById('team-details');
    details.replaceChildren();
    document.getElementById('roster-empty').hidden = teams.length > 0;
    field.replaceChildren();
    clinic.replaceChildren();
    const grids = new Map();
    fieldLocations().forEach(location => {
        const section = document.createElement('section');
        section.className = 'field-location';
        section.dataset.location = location.id;
        section.setAttribute('aria-label', location.name);
        section.addEventListener('dragover', allowDrop);
        section.addEventListener('dragleave', dragLeave);
        section.addEventListener('drop', e => drop(e, 'field-zone', location.id));
        const header = document.createElement('div');
        header.className = 'location-header';
        if (builtInLocations.some(l => l.id === location.id)) {
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
        const total = teams.filter(t => t.zone === 'field-zone' && t.location === location.id).length;
        count.textContent = `${total} unit${total !== 1 ? 's' : ''}`;
        if (location.id === 'pit-table-service') count.title = 'Fixed-post units do not count toward Level';
        header.appendChild(count);
        if (!builtInLocations.some(l => l.id === location.id)) {
            const remove = document.createElement('button');
            remove.className = 'remove-location'; remove.textContent = '×';
            remove.title = 'Remove post; units will have no post assigned';
            remove.setAttribute('aria-label', `Remove post ${location.name}`);
            remove.addEventListener('click', () => removeLocation(location.id));
            header.appendChild(remove);
        }
        const grid = document.createElement('div');
        grid.className = 'badge-grid';
        if (location.id === 'unassigned') grid.id = 'field-grid';
        section.append(header, grid); field.appendChild(section); grids.set(location.id, grid);
    });

    const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }));
    sortedTeams.forEach(team => {
        const onBreak = isOnMealBreak(team);
        const mealBreakFlag = onBreak ? '<span class="meal-break-flag">On meal break</span>' : '';
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'team-badge'; badge.dataset.status = team.status;
        if (onBreak) badge.dataset.mealBreak = 'true';
        badge.draggable = true; badge.id = team.id;
        setBadgeLabel(badge, team);
        badge.innerHTML = `<span class="team-name">${escapeHTML(team.name)}</span><span class="team-status">${statusNames[team.status]}</span><span class="team-timer" data-since="${team.statusSince}" aria-hidden="true">${elapsedStatus(team.statusSince)}</span>${mealBreakFlag}`;
        badge.addEventListener('click', e => {
            if (Date.now() - lastDragEnd < 300) return;
            updateStatus(team.id, nextStatus(team.status));
            if (e.detail === 0) document.getElementById(team.id)?.focus({ preventScroll: true });
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
        if (onBreak) row.dataset.mealBreak = 'true';
        row.innerHTML = `
            <th scope="row">${escapeHTML(team.name)}${mealBreakFlag}</th>
            <td><select id="status-${team.id}" aria-label="Unit status for ${escapeHTML(team.name)}" class="status-select" data-status="${team.status}">
                ${Object.entries(statusNames).map(([value, label]) => `<option value="${value}" ${team.status === value ? 'selected' : ''}>${label}</option>`).join('')}
            </select></td>
            <td><select id="location-${team.id}" class="location-select" aria-label="Post for ${escapeHTML(team.name)}">
                ${fieldLocations().map(l => `<option value="${l.id}" ${team.zone === 'field-zone' && team.location === l.id ? 'selected' : ''}>${escapeHTML(l.name)}</option>`).join('')}
                <option value="clinic-zone" ${team.zone === 'clinic-zone' ? 'selected' : ''}>Main medical clinic</option>
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
    renderMealBreaks(sortedTeams);
    renderHandoffLog();
    const fieldCount = teams.filter(t => t.zone === 'field-zone').length;
    const clinicCount = teams.length - fieldCount;
    const roamingCount = teams.filter(t => t.status === 'roaming' && t.zone === 'field-zone'
        && t.location !== 'pit-table-service' && !isOnMealBreak(t)).length;
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
function refresh() { renderBoard(); saveBoard(); }
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
    teams.push({ id: newId('t_'), name, status: 'roaming', zone: 'field-zone', location: 'unassigned', statusSince: Date.now() });
    input.value = ''; refresh(); input.focus();
}
function deleteTeam(id) {
    if (!teams.some(t => t.id === id)) return;
    rememberChange(); teams = teams.filter(t => t.id !== id); refresh();
}
function addLocation() {
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
    saveBoard();
}
function removeLocation(id) {
    if (!locations.some(l => l.id === id)) return;
    rememberChange();
    const now = Date.now();
    teams.filter(team => team.location === id).forEach(team => {
        const previous = { ...team };
        team.location = 'unassigned';
        recordTeamChange(team, previous, now);
    });
    locations = locations.filter(l => l.id !== id);
    refresh();
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
    const team = teams.find(t => t.id === id);
    if (!team) return;
    if (location !== 'clinic-zone' && !validLocation(location)) return;
    if (location === 'clinic-zone' ? team.zone === 'clinic-zone' : team.zone === 'field-zone' && team.location === location) return;
    rememberChange();
    const previous = { ...team };
    if (location === 'clinic-zone') {
        team.zone = 'clinic-zone'; team.status = 'atclinic';
    } else {
        team.zone = 'field-zone'; team.location = location;
        if (team.status === 'atclinic') team.status = 'roaming';
    }
    const now = Date.now();
    if (team.status !== previous.status) team.statusSince = now;
    recordTeamChange(team, previous, now);
    refresh();
}
function dragStart(e) {
    e.dataTransfer.setData('text/plain', e.currentTarget.id);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
}
function allowDrop(e) { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('drag-over'); }
function dragLeave(e) { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('drag-over'); }
function drop(e, zoneId, location = 'unassigned') {
    e.preventDefault(); e.stopPropagation();
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    moveTeam(e.dataTransfer.getData('text/plain'), zoneId === 'clinic-zone' ? 'clinic-zone' : location);
}
const pacificFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit',
    second: '2-digit', hourCycle: 'h23', timeZoneName: 'short'
});
const handoffDateFormatter = new Intl.DateTimeFormat('en-US', {
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
refresh();

function replaceBoard(board) {
    rememberChange();
    teams = board.teams;
    locations = board.locations;
    handoffLog = board.handoffLog;
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
    replaceBoard(readBoard({ teams: sampleTeams, locations: [], notes: '' }));
    showToolMessage('Sample units loaded. Use Clear board before starting a live shift.');
});

document.getElementById('clear-board').addEventListener('click', () => {
    if (!confirm('Clear all units, custom posts, shift notes, and the handoff log?')) return;
    replaceBoard({ teams: [], locations: [], notes: '', handoffLog: [] });
    showToolMessage('Board cleared. You can undo this change.');
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
        // The dispatch board is usable online if service workers are blocked.
    });
}
