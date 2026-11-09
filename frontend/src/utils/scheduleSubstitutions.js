/**
 * Утилиты для работы с заменами, переносами занятий (moved substitutions),
 * свободными парами и расширенными характеристиками аудиторий.
 */

export function canonicalId(val) {
  let id = String(val || '');
  const rx = /__(?:PUBW\d+|EXACT_W\d+|TRANSFER_[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*|CANONICAL_RECOVER_[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*|REMOTE_ONE_[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*)$/i;
  while (rx.test(id)) {
    id = id.replace(rx, '');
  }
  return id;
}

export function subMatchesInstance(sub, inst) {
  const subIds = [sub?.instId, sub?.sourceInstId, sub?.originalInstId]
    .map(canonicalId)
    .filter(Boolean);
  if (!subIds.length) return false;
  const instIds = [inst?.instId, inst?._publishedSourceInstId]
    .map(canonicalId)
    .filter(Boolean);
  return instIds.some(id => subIds.includes(id));
}

export function subMatchesView(sub, inst, kind, viewId) {
  const vid = String(viewId || '');
  if (!vid) return false;
  if (kind === 'group') {
    const gids = [inst?.groupId, ...(inst?.groupIds || []), ...(inst?.streamGroupIds || []), sub?.groupId, sub?.importGroupId].filter(Boolean).map(String);
    return gids.includes(vid);
  }
  if (kind === 'teacher') {
    const tids = [sub?.newTeacherId, sub?.teacherId, inst?.teacherId, sub?.importOldTeacherId].filter(Boolean).map(String);
    return tids.includes(vid);
  }
  if (kind === 'room') {
    const rids = [sub?.newRoomId, inst?.roomId, inst?.dedicatedRoomId, sub?.importOldRoom].filter(Boolean).map(String);
    return rids.includes(vid);
  }
  return true;
}

export function formatDateDM(isoDate) {
  if (!isoDate) return '';
  const parts = String(isoDate).split('-');
  if (parts.length < 3) return String(isoDate);
  return `${parts[2]}.${parts[1]}`;
}

function resolveSubject(sub, rawInst, subjects) {
  const subjName = sub.importSubject || '';
  const found = subjects.find(s => String(s.name || '').trim().toLowerCase() === subjName.trim().toLowerCase());
  return {
    subjectId: rawInst?.subjectId || found?.id || '',
    subjectName: rawInst?.subjectName || subjName
  };
}

function resolveMovedSlot(sub, rawInst) {
  const period = Number.isFinite(Number(sub.targetPeriod)) ? Number(sub.targetPeriod) + 1 : Number(rawInst?.period || 1);
  const roomId = sub.newFormat === 'remote' ? '' : (sub.newRoomId || rawInst?.roomId || '');
  const sourcePeriod = rawInst?.period ? Number(rawInst.period) - 1 : Math.max(0, (Number(sub.importOldPeriod) || 1) - 1);
  return { period, roomId, sourcePeriod };
}

function createMovedSubOverride(sub, slot) {
  return {
    ...sub,
    type: 'moved',
    isMovedTarget: true,
    moved: true,
    sourceDate: sub.date,
    sourcePeriod: slot.sourcePeriod,
    note: sub.note || 'Перенос занятия'
  };
}

export function buildMovedInstance(sub, rawInst, dayIdx, dateISO, subjects = []) {
  const subj = resolveSubject(sub, rawInst, subjects);
  const slot = resolveMovedSlot(sub, rawInst);
  const teacherId = sub.newTeacherId || rawInst?.teacherId || sub.importOldTeacherId || '';
  const groupId = rawInst?.groupId || sub.importGroupId || sub.groupId || '';
  return {
    ...(rawInst || {}),
    instId: `moved-${sub.id || sub.instId || Math.random()}`,
    _isMovedSynthetic: true,
    day: dayIdx,
    period: slot.period,
    subjectId: subj.subjectId,
    subjectName: subj.subjectName,
    teacherId,
    groupId,
    groupIds: rawInst?.groupIds || (sub.importGroupId ? [sub.importGroupId] : []),
    streamGroupIds: rawInst?.streamGroupIds || [],
    subgroup: Number(rawInst?.subgroup || sub.subgroup || 0),
    format: sub.newFormat || rawInst?.format || 'inperson',
    roomId: slot.roomId,
    sourceDate: sub.date,
    sourcePeriod: slot.sourcePeriod,
    targetDate: sub.targetDate,
    targetPeriod: sub.targetPeriod,
    note: sub.note || 'Перенос занятия',
    substitution: createMovedSubOverride(sub, slot)
  };
}

export function collectMovedLessonsForDate(substitutions, instances, kind, viewId, targetDate, dayIdx, subjects = []) {
  if (!targetDate || !Array.isArray(substitutions)) return [];
  const list = [];
  for (const sub of substitutions) {
    if (sub?.type !== 'moved' || String(sub.targetDate) !== String(targetDate)) continue;
    const rawInst = (instances || []).find(i => subMatchesInstance(sub, i));
    if (!subMatchesView(sub, rawInst, kind, viewId)) continue;
    list.push(buildMovedInstance(sub, rawInst, dayIdx, targetDate, subjects));
  }
  return list;
}

export function calculateFreePeriods(occupiedPeriods, periodsPerDay = 7) {
  const maxP = Math.max(1, Number(periodsPerDay) || 7);
  const occupiedSet = new Set((occupiedPeriods || []).map(Number));
  const free = [];
  for (let p = 1; p <= maxP; p += 1) {
    if (!occupiedSet.has(p)) free.push(p);
  }
  return free;
}

export function calculateDayGaps(occupiedPeriods) {
  const nums = [...new Set((occupiedPeriods || []).map(Number))].sort((a, b) => a - b);
  if (nums.length < 2) return [];
  const gaps = [];
  for (let p = nums[0] + 1; p < nums[nums.length - 1]; p += 1) {
    if (!nums.includes(p)) gaps.push(p);
  }
  return gaps;
}

function resolveRoomTypeCategory(room, typeObj) {
  const typeName = String(typeObj?.name || '').toLowerCase();
  const roomName = String(room?.name || '').toLowerCase();
  const isComputer = Boolean(room?.hasComputers || typeName.includes('комп') || roomName.includes('комп'));
  const isArt = Boolean(room?.isArtRoom || typeName.includes('худож') || roomName.includes('худож'));
  const isLab = Boolean(typeName.includes('лабор'));
  const isGym = Boolean(typeName.includes('спорт') || roomName.includes('спорт') || typeName.includes('зал'));
  return { isComputer, isArt, isLab, isGym };
}

function resolveRoomSizeLabel(sizeObj) {
  const sizeName = String(sizeObj?.name || '').toLowerCase();
  if (sizeName.includes('бол')) return 'большая';
  if (sizeName.includes('сред')) return 'средняя';
  if (sizeName.includes('мал')) return 'малая';
  return '';
}

export function getRoomCategoryDetails(room, roomTypes = [], roomSizes = []) {
  if (!room) return { tagLabel: '', description: '', isArt: false, isComputer: false, isLab: false };
  const typeObj = (roomTypes || []).find(t => String(t.id) === String(room.typeId));
  const sizeObj = (roomSizes || []).find(s => String(s.id) === String(room.sizeId));
  const cats = resolveRoomTypeCategory(room, typeObj);
  const sizeLabel = resolveRoomSizeLabel(sizeObj);
  const typeLabel = cats.isArt ? 'художественная' : (cats.isComputer ? 'компьютерная' : (cats.isLab ? 'лаборатория' : (cats.isGym ? 'спортзал' : (typeObj?.name || ''))));
  const tagParts = [sizeLabel, typeLabel].filter(Boolean);
  const tagLabel = tagParts.join(' · ') || (room.capacity ? `${room.capacity} мест` : '');
  const mainTypeTitle = typeObj?.name || (cats.isArt ? 'Художественный кабинет' : (cats.isComputer ? 'Компьютерный класс' : 'Аудитория'));
  const sizeDesc = sizeLabel ? `${sizeLabel} (${room.capacity || 0} мест)` : (room.capacity ? `${room.capacity} мест` : '');
  const descParts = [mainTypeTitle, sizeDesc, room.equipment].filter(Boolean);
  return { tagLabel, description: descParts.join(' · '), ...cats, sizeLabel, capacity: room.capacity || 0 };
}
