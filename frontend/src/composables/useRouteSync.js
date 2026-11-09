/**
 * Синхронизация маршрутов и сохранения состояния расписания:
 * чтение URL-параметров (path, search, hash), localStorage,
 * поддержка формата /specialty/:specId/year/:year/group/:groupId
 * и управление историей браузера (pushState vs replaceState).
 */

const STORAGE_KEY = 'timetable_public_selection';

function safeDecode(val) {
  try {
    return decodeURIComponent(String(val || ''));
  } catch {
    return String(val || '');
  }
}

function findEntityInParts(parts) {
  const groupIdx = parts.indexOf('group');
  if (groupIdx !== -1 && parts[groupIdx + 1]) {
    return { kind: 'group', id: safeDecode(parts[groupIdx + 1]) };
  }
  const teacherIdx = parts.indexOf('teacher');
  if (teacherIdx !== -1 && parts[teacherIdx + 1]) {
    return { kind: 'teacher', id: safeDecode(parts[teacherIdx + 1]) };
  }
  const roomIdx = parts.indexOf('room');
  if (roomIdx !== -1 && parts[roomIdx + 1]) {
    return { kind: 'room', id: safeDecode(parts[roomIdx + 1]) };
  }
  return null;
}

export function parseUrlPath(pathname) {
  const parts = (pathname || '').split('/').filter(Boolean);
  return findEntityInParts(parts);
}

export function parseUrlHash(hash) {
  if (!hash) return null;
  const [cleanHash] = hash.replace(/^#\/?/, '').split('?');
  const hyphenMatch = cleanHash.match(/^(group|teacher|room)-([a-zA-Z0-9_-]+)$/);
  if (hyphenMatch) {
    return { kind: hyphenMatch[1], id: safeDecode(hyphenMatch[2]) };
  }
  const parts = cleanHash.split('/').filter(Boolean);
  return findEntityInParts(parts);
}

export function parseUrlSearch(search) {
  const params = new URLSearchParams(search || '');
  const week = params.get('week') ? Number(params.get('week')) : null;
  if (params.get('group')) return { kind: 'group', id: safeDecode(params.get('group')), week };
  if (params.get('teacher')) return { kind: 'teacher', id: safeDecode(params.get('teacher')), week };
  if (params.get('room')) return { kind: 'room', id: safeDecode(params.get('room')), week };
  if (params.get('kind') && params.get('id')) {
    return { kind: params.get('kind'), id: safeDecode(params.get('id')), week };
  }
  return { week };
}

function extractHashWeek() {
  if (typeof window === 'undefined' || !window.location.hash?.includes('?')) return null;
  const qs = window.location.hash.split('?')[1];
  const w = new URLSearchParams(qs).get('week');
  return w ? Number(w) : null;
}

export function parseCurrentRoute() {
  if (typeof window === 'undefined') return { kind: 'group', id: '', week: null };
  const fromPath = parseUrlPath(window.location.pathname);
  const fromHash = parseUrlHash(window.location.hash);
  const fromSearch = parseUrlSearch(window.location.search);
  const entity = fromPath || fromHash || (fromSearch.id ? fromSearch : null);
  return {
    kind: entity?.kind || 'group',
    id: entity?.id || '',
    week: fromSearch.week || extractHashWeek()
  };
}

export function readSavedSelection() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSelection(kind, id, week) {
  try {
    if (!id) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ kind, id, week }));
  } catch (err) {
    console.warn('Не удалось сохранить выбор расписания:', err);
  }
}

export function clearSavedSelection() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function entityExists(data, kind, id) {
  if (!id || !data) return false;
  const list = kind === 'teacher' ? data.teachers : (kind === 'room' ? data.rooms : data.groups);
  return Array.isArray(list) && list.some(item => String(item.id) === String(id));
}

function resolveFallbackWeek(data, requestedWeek) {
  if (requestedWeek && Array.isArray(data.publishedWeeks) && data.publishedWeeks.includes(requestedWeek)) {
    return requestedWeek;
  }
  if (Array.isArray(data.publishedWeeks) && data.publishedWeeks.length) {
    return data.publishedWeeks[data.publishedWeeks.length - 1];
  }
  return 10;
}

export function resolveInitialSelection(data) {
  const route = parseCurrentRoute();
  const saved = readSavedSelection();
  let targetKind = route.id ? route.kind : (saved?.id ? saved.kind : 'group');
  let targetId = route.id || saved?.id || '';
  let targetWeek = route.week || saved?.week || null;

  if (route.id && !entityExists(data, route.kind, route.id)) {
    targetId = saved?.id && entityExists(data, saved.kind, saved.id) ? saved.id : '';
    targetKind = targetId ? (saved?.kind || 'group') : 'group';
  } else if (targetId && !entityExists(data, targetKind, targetId)) {
    targetId = '';
  }

  const finalWeek = resolveFallbackWeek(data, targetWeek);
  return { kind: targetKind, id: targetId, week: finalWeek };
}

function buildGroupUrl(group) {
  if (group && group.admissionYear) {
    const spec = group.specialtyId ? encodeURIComponent(String(group.specialtyId)) : 'none';
    const yr = encodeURIComponent(String(group.admissionYear));
    const gid = encodeURIComponent(String(group.id));
    return `/specialty/${spec}/year/${yr}/group/${gid}`;
  }
  return `/group/${encodeURIComponent(String(group?.id || ''))}`;
}

export function syncBrowserUrl(kind, id, week, groupsList = [], opts = {}) {
  if (typeof window === 'undefined' || window.location.pathname.startsWith('/admin')) return;
  const mode = opts.mode || 'replace';
  if (!id) {
    if (window.location.pathname !== '/') {
      const fn = mode === 'push' ? window.history.pushState : window.history.replaceState;
      fn.call(window.history, null, '', '/');
    }
    return;
  }
  let basePath = `/${kind}/${encodeURIComponent(String(id))}`;
  if (kind === 'group' && Array.isArray(groupsList)) {
    const found = groupsList.find(g => String(g.id) === String(id));
    if (found) basePath = buildGroupUrl(found);
  }
  const newUrl = `${basePath}${week ? `?week=${week}` : ''}`;
  if (window.location.pathname + window.location.search !== newUrl) {
    const fn = mode === 'push' ? window.history.pushState : window.history.replaceState;
    fn.call(window.history, null, '', newUrl);
  }
}
