<template>
  <div class="entity-picker-wrap">
    <!-- Выбор преподавателя -->
    <template v-if="role === 'teacher'">
      <div class="picker-header">
        <h2 class="picker-title">Преподаватели колледжа</h2>
        <p class="picker-subtitle">Выберите преподавателя для просмотра расписания</p>
      </div>

      <!-- Быстрый алфавитный фильтр -->
      <div class="alphabet-bar">
        <button
          v-for="letter in availableLetters"
          :key="letter"
          type="button"
          :class="['letter-btn', { active: activeLetter === letter }]"
          @click="activeLetter = activeLetter === letter ? '' : letter"
        >
          {{ letter }}
        </button>
      </div>

      <div class="teachers-grid">
        <div
          v-for="t in filteredTeachers"
          :key="t.id"
          class="teacher-card"
          @click="$emit('select', t.id)"
        >
          <span class="teacher-card-name">{{ t.name }}</span>
        </div>
      </div>
    </template>

    <!-- Выбор аудитории -->
    <template v-else-if="role === 'room'">
      <div class="picker-header">
        <h2 class="picker-title">Аудиторный фонд</h2>
        <p class="picker-subtitle">Выберите корпус и кабинет колледжа</p>
      </div>

      <div class="campuses-list">
        <div 
          v-for="campus in campusGroups" 
          :key="campus.title" 
          class="campus-block"
        >
          <div class="campus-header">
            <span class="campus-badge">{{ campus.badge }}</span>
            <h3 class="campus-title">{{ campus.title }}</h3>
          </div>
          <div class="rooms-chips-grid">
            <button
              v-for="r in campus.rooms"
              :key="r.id"
              type="button"
              class="room-pick-btn"
              @click="$emit('select', r.id)"
            >
              {{ r.name }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  role: { type: String, default: 'teacher' },
  items: { type: Array, default: () => [] }
});

defineEmits(['select']);

const activeLetter = ref('');

// 1. Алфавитный указатель преподавателей
const availableLetters = computed(() => {
  if (props.role !== 'teacher') return [];
  const set = new Set();
  props.items.forEach(t => {
    const first = (t.name || '').trim().charAt(0).toUpperCase();
    if (first && /[А-ЯЁ]/.test(first)) set.add(first);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
});

// 2. Отфильтрованные преподаватели
const filteredTeachers = computed(() => {
  if (props.role !== 'teacher') return [];
  const list = [...props.items].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
  if (!activeLetter.value) return list;
  return list.filter(t => (t.name || '').trim().toUpperCase().startsWith(activeLetter.value));
});

// 3. Группировка аудиторий по корпусам
const campusGroups = computed(() => {
  if (props.role !== 'room') return [];
  const mainRooms = [];
  const voznesenskyRooms = [];
  const sadovayaRooms = [];

  props.items.forEach(r => {
    const name = String(r.name || '');
    if (r.isExternal || name.startsWith('В-') || name.startsWith('Возн')) {
      voznesenskyRooms.push(r);
    } else if (name.startsWith('С-') || name.startsWith('Сад')) {
      sadovayaRooms.push(r);
    } else {
      mainRooms.push(r);
    }
  });

  const sortFn = (a, b) => String(a.name).localeCompare(String(b.name), 'ru', { numeric: true });

  return [
    { title: 'ул. Цветочная, 8 (Главный корпус)', badge: 'ЦВЕТОЧНАЯ', rooms: mainRooms.sort(sortFn) },
    { title: 'Вознесенский пр., 44', badge: 'ВОЗНЕСЕНСКИЙ', rooms: voznesenskyRooms.sort(sortFn) },
    { title: 'ул. Садовая, 54', badge: 'САДОВАЯ', rooms: sadovayaRooms.sort(sortFn) }
  ].filter(c => c.rooms.length > 0);
});
</script>

<style scoped>
.entity-picker-wrap {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.picker-header {
  margin-bottom: 20px;
}

.picker-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--ink-primary);
  margin-bottom: 4px;
}

.picker-subtitle {
  font-size: 14px;
  color: var(--ink-muted);
}

.alphabet-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 20px;
}

.letter-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: #ffffff;
  font-weight: 700;
  font-size: 13px;
  color: var(--ink-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.letter-btn:hover {
  border-color: var(--blue-500);
  color: var(--blue-700);
  background: var(--blue-50);
}

.letter-btn.active {
  background: var(--blue-600);
  color: #ffffff;
  border-color: var(--blue-600);
}

.teachers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.teacher-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #ffffff;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  transition: all 0.2s ease;
}

.teacher-card:hover {
  border-color: var(--blue-500);
  box-shadow: 0 8px 18px -4px rgba(2, 132, 199, 0.14);
  transform: translateY(-2px);
}

.teacher-avatar {
  font-size: 20px;
}

.teacher-card-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-primary);
}

.campuses-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.campus-block {
  background: #ffffff;
  border: 1px solid var(--border-light);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
}

.campus-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.campus-badge {
  font-size: 10px;
  font-weight: 800;
  color: var(--blue-700);
  background: var(--blue-50);
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--blue-200);
}

.campus-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--ink-primary);
  margin: 0;
}

.rooms-chips-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.room-pick-btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-light);
  background: #f8fafc;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--blue-800);
  cursor: pointer;
  transition: all 0.18s ease;
}

.room-pick-btn:hover {
  background: var(--blue-600);
  color: #ffffff;
  border-color: var(--blue-600);
  transform: translateY(-1px);
}
</style>
