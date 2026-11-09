const storageKey = 'charlotte-dispatch-board-v1';
const statusNames = { roaming: 'Roaming', onscene: 'On scene', transporting: 'Transporting', atclinic: 'At clinic' };
const builtInLocations = [{ id: 'pit-table-service', name: 'Fixed posts' }, { id: 'unassigned', name: 'Unassigned' }];
let locations = [];
const sampleTeams = [
    { id: 't1', name: 'DEMO-1', status: 'roaming', zone: 'field-zone', location: 'unassigned' },
    { id: 't2', name: 'DEMO-2', status: 'onscene', zone: 'field-zone', location: 'unassigned' },
    { id: 't3', name: 'DEMO-3', status: 'transporting', zone: 'field-zone', location: 'unassigned' },
    { id: 't4', name: 'DEMO-4', status: 'atclinic', zone: 'clinic-zone', location: 'unassigned' }
];
let teams = [];
let savedNotes = '';
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
        return {
            id: team.id, name: team.name, status: team.status,
            zone: team.status === 'atclinic' ? 'clinic-zone' : 'field-zone',
            location: locationIds.has(team.location) ? team.location : 'unassigned',
            statusSince: Number.isFinite(team.statusSince) && team.statusSince > 0 && team.statusSince <= now
                ? team.statusSince : now
        };
    });
    return { teams, locations, notes: typeof saved.notes === 'string' ? saved.notes : '' };
}

try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== null) {
        const saved = readBoard(JSON.parse(raw));
        teams = saved.teams;
        locations = saved.locations;
        savedNotes = saved.notes;
    }
} catch {
    // Storage is checked again on the first save so the operator sees any error.
}

function validLocation(id) { return fieldLocations().some(location => location.id === id); }
function saveBoard() {
    const indicator = document.getElementById('save-indicator');
    try {
        localStorage.setItem(storageKey, boardSnapshot());
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
function boardSnapshot() {
    return JSON.stringify({ teams, locations, notes: document.getElementById('shift-notes').value });
}
function rememberChange(snapshot = boardSnapshot()) {
    undoHistory.push(snapshot);
    if (undoHistory.length > 100) undoHistory.shift();
    notesCheckpoint = null;
    document.getElementById('undo-button').disabled = false;
}
function undoChange() {
    if (!undoHistory.length) return;
    const previous = JSON.parse(undoHistory.pop());
    teams = previous.teams; locations = previous.locations;
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
}
function nextStatus(status) {
    const order = Object.keys(statusNames);
    return order[(order.indexOf(status) + 1) % order.length];
}

function setBadgeLabel(badge, team) {
    const location = team.zone === 'clinic-zone'
        ? 'Main medical clinic'
        : fieldLocations().find(item => item.id === team.location)?.name || 'Unassigned';
    badge.title = `${team.name}: ${statusNames[team.status]} · ${location}. Tap to change to ${statusNames[nextStatus(team.status)]}.`;
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
            name.setAttribute('aria-label', 'Location name');
            name.title = 'Edit location name';
            name.addEventListener('change', () => renameLocation(location.id, name.value));
            name.addEventListener('keydown', e => { if (e.key === 'Enter') name.blur(); });
            header.appendChild(name);
        }
        const count = document.createElement('span');
        count.className = 'location-count';
        const total = teams.filter(t => t.zone === 'field-zone' && t.location === location.id).length;
        count.textContent = `${total} team${total !== 1 ? 's' : ''}`;
        if (location.id === 'pit-table-service') count.title = 'Excluded from the roaming level count';
        header.appendChild(count);
        if (!builtInLocations.some(l => l.id === location.id)) {
            const remove = document.createElement('button');
            remove.className = 'remove-location'; remove.textContent = '×';
            remove.title = 'Remove location; teams move to Unassigned';
            remove.setAttribute('aria-label', `Remove location ${location.name}`);
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
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'team-badge'; badge.dataset.status = team.status;
        badge.draggable = true; badge.id = team.id;
        setBadgeLabel(badge, team);
        badge.innerHTML = `<span class="team-name">${escapeHTML(team.name)}</span><span class="team-status">${statusNames[team.status]}</span><span class="team-timer" data-since="${team.statusSince}" aria-hidden="true">${elapsedStatus(team.statusSince)}</span>`;
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
        row.innerHTML = `
            <th scope="row">${escapeHTML(team.name)}</th>
            <td><select id="status-${team.id}" aria-label="Status for ${escapeHTML(team.name)}" class="status-select" data-status="${team.status}">
                ${Object.entries(statusNames).map(([value, label]) => `<option value="${value}" ${team.status === value ? 'selected' : ''}>${label}</option>`).join('')}
            </select></td>
            <td><select id="location-${team.id}" class="location-select" aria-label="Location for ${escapeHTML(team.name)}">
                ${fieldLocations().map(l => `<option value="${l.id}" ${team.zone === 'field-zone' && team.location === l.id ? 'selected' : ''}>${escapeHTML(l.name)}</option>`).join('')}
                <option value="clinic-zone" ${team.zone === 'clinic-zone' ? 'selected' : ''}>Main medical clinic</option>
            </select></td>
            <td><button type="button" title="Remove team" aria-label="Remove ${escapeHTML(team.name)}" class="delete-btn">×</button></td>`;
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
    const fieldCount = teams.filter(t => t.zone === 'field-zone').length;
    const clinicCount = teams.length - fieldCount;
    const roamingCount = teams.filter(t => t.status === 'roaming' && t.zone === 'field-zone' && t.location !== 'pit-table-service').length;
    document.getElementById('level-number').textContent = roamingCount;
    for (const status of ['onscene', 'transporting', 'atclinic']) {
        document.getElementById(`${status}-total`).textContent = teams.filter(team => team.status === status).length;
    }
    document.querySelector('.level-meter').dataset.empty = String(roamingCount === 0);
    document.getElementById('field-count').textContent = `${fieldCount} team${fieldCount !== 1 ? 's' : ''}`;
    document.getElementById('clinic-count').textContent = `${clinicCount} team${clinicCount !== 1 ? 's' : ''}`;
    document.getElementById('undo-button').disabled = undoHistory.length === 0;
}
function refresh() { renderBoard(); saveBoard(); }
function addTeam() {
    const input = document.getElementById('newTeamInput');
    const name = input.value.trim();
    if (!name) return;
    const error = document.getElementById('form-error');
    if (teams.some(team => team.name.toLowerCase() === name.toLowerCase())) {
        error.textContent = `${name} is already on the board.`;
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
    section.querySelector('.remove-location').setAttribute('aria-label', `Remove location ${location.name}`);
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
    locations = locations.filter(l => l.id !== id);
    teams.forEach(t => { if (t.location === id) t.location = 'unassigned'; });
    refresh();
}
function updateStatus(id, status) {
    const team = teams.find(t => t.id === id);
    if (!team || !Object.prototype.hasOwnProperty.call(statusNames, status) || team.status === status) return;
    rememberChange();
    team.status = status;
    team.statusSince = Date.now();
    team.zone = status === 'atclinic' ? 'clinic-zone' : 'field-zone';
    refresh();
}
function moveTeam(id, location) {
    const team = teams.find(t => t.id === id);
    if (!team) return;
    if (location !== 'clinic-zone' && !validLocation(location)) return;
    if (location === 'clinic-zone' ? team.zone === 'clinic-zone' : team.zone === 'field-zone' && team.location === location) return;
    rememberChange();
    const previousStatus = team.status;
    if (location === 'clinic-zone') {
        team.zone = 'clinic-zone'; team.status = 'atclinic';
    } else {
        team.zone = 'field-zone'; team.location = location;
        if (team.status === 'atclinic') team.status = 'roaming';
    }
    if (team.status !== previousStatus) team.statusSince = Date.now();
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
notes.addEventListener('beforeinput', () => { if (notesCheckpoint === null) notesCheckpoint = boardSnapshot(); });
notes.addEventListener('input', () => {
    if (notesCheckpoint !== 'recorded') {
        const snapshot = notesCheckpoint || JSON.stringify({ teams, locations, notes: savedNotes });
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
    const url = URL.createObjectURL(new Blob([boardSnapshot()], { type: 'application/json' }));
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
    if ((teams.length || locations.length || notes.value) && !confirm('Replace this board with sample teams?')) return;
    replaceBoard(readBoard({ teams: sampleTeams, locations: [], notes: '' }));
    showToolMessage('Sample teams loaded. Use Clear board before starting a live shift.');
});

document.getElementById('clear-board').addEventListener('click', () => {
    if (!confirm('Clear all teams, custom locations, and shift notes?')) return;
    replaceBoard({ teams: [], locations: [], notes: '' });
    showToolMessage('Board cleared. You can undo this change.');
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
        // The dispatch board is usable online if service workers are blocked.
    });
}
