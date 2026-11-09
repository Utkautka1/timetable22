<template>
  <div class="substitutions-feed">
    <div v-if="!substitutions.length" class="empty-subs">
      <svg class="empty-icon-svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <p>Активных замен нет — занятия проводятся по основному расписанию.</p>
    </div>

    <div v-else class="subs-grid">
      <div 
        v-for="sub in substitutions" 
        :key="sub.id || `${sub.groupId}-${sub.day}-${sub.period}`"
        class="sub-card"
      >
        <div class="sub-header">
          <span class="group-tag">{{ getGroupName(sub.groupId) }}</span>
          <span class="period-tag">Пара {{ sub.period }}</span>
        </div>

        <div class="sub-change-body">
          <div v-if="sub.newTeacherId" class="change-row">
            <span class="change-label">Преподаватель:</span>
            <span class="change-value">{{ getTeacherName(sub.newTeacherId) }}</span>
          </div>

          <div v-if="sub.newRoomId" class="change-row">
            <span class="change-label">Аудитория:</span>
            <span class="change-value">{{ getRoomName(sub.newRoomId) }}</span>
          </div>

          <div v-if="sub.newSubjectId" class="change-row">
            <span class="change-label">Предмет:</span>
            <span class="change-value">{{ getSubjectName(sub.newSubjectId) }}</span>
          </div>

          <div v-if="sub.note" class="sub-note-text">
            {{ sub.note }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  substitutions: { type: Array, default: () => [] },
  getGroupName: { type: Function, required: true },
  getTeacherName: { type: Function, required: true },
  getRoomName: { type: Function, required: true },
  getSubjectName: { type: Function, required: true }
});
</script>

<style scoped>
.substitutions-feed {
  display: flex;
  flex-direction: column;
}

.empty-subs {
  text-align: center;
  padding: 30px 16px;
  background: var(--blue-50);
  border-radius: var(--radius-md);
  border: 1px dashed var(--blue-200);
  color: var(--blue-700);
  font-size: 13px;
}

.empty-icon {
  font-size: 24px;
  display: block;
  margin-bottom: 6px;
}

.subs-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sub-card {
  background: #ffffff;
  border-left: 4px solid var(--orange-500);
  border: 1px solid var(--border-light);
  border-left-width: 4px;
  border-radius: var(--radius-md);
  padding: 14px 16px;
  box-shadow: var(--shadow-subtle);
}

.sub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.group-tag {
  font-size: 13px;
  font-weight: 800;
  color: var(--orange-700);
  background: var(--orange-100);
  padding: 3px 8px;
  border-radius: 6px;
}

.period-tag {
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-secondary);
}

.sub-change-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.change-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.change-label {
  color: var(--ink-muted);
  font-size: 12px;
}

.change-value {
  font-weight: 700;
  color: var(--ink-primary);
}

.sub-note-text {
  margin-top: 4px;
  font-size: 11px;
  color: var(--ink-muted);
  background: var(--bg-app);
  padding: 6px 10px;
  border-radius: 6px;
}
</style>
