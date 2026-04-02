<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Project } from '../../api/timesheet';

interface Props {
  projects: Project[];
  modelValue: string | null;
}

interface Emits {
  (event: 'update:modelValue', value: string | null): void;
  (event: 'change', project: Project): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const searchQuery = ref<string>('');
const isDropdownOpen = ref<boolean>(false);

const filteredProjects = computed(() => {
  if (!searchQuery.value) {
    return props.projects;
  }
  const query = searchQuery.value.toLowerCase();
  return props.projects.filter(project =>
    project.title.toLowerCase().includes(query)
  );
});

const selectedProject = computed(() => {
  if (!props.modelValue) return null;
  return props.projects.find(p => p.id === props.modelValue) || null;
});

const displayText = computed(() => {
  return selectedProject.value?.title || '请选择项目';
});

const handleSelect = (project: Project) => {
  emit('update:modelValue', project.id);
  emit('change', project);
  searchQuery.value = '';
  isDropdownOpen.value = false;
};

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  searchQuery.value = target.value;
  isDropdownOpen.value = true;
};

const handleFocus = () => {
  isDropdownOpen.value = true;
};

const handleBlur = () => {
  setTimeout(() => {
    isDropdownOpen.value = false;
    searchQuery.value = '';
  }, 200);
};

const clearSelection = () => {
  emit('update:modelValue', null);
  searchQuery.value = '';
};
</script>

<template>
  <div class="project-select">
    <div class="select-input-wrapper">
      <input
        :value="isDropdownOpen ? searchQuery : displayText"
        class="select-input"
        type="text"
        placeholder="搜索项目..."
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
      />
      <button
        v-if="selectedProject"
        class="clear-button"
        type="button"
        @click="clearSelection"
      >
        ×
      </button>
      <span class="dropdown-icon">▼</span>
    </div>

    <ul v-if="isDropdownOpen && filteredProjects.length > 0" class="dropdown-list">
      <li
        v-for="project in filteredProjects"
        :key="project.id"
        :class="['dropdown-item', { selected: project.id === modelValue }]"
        @click="handleSelect(project)"
      >
        {{ project.title }}
      </li>
    </ul>

    <div v-if="isDropdownOpen && filteredProjects.length === 0" class="dropdown-empty">
      未找到匹配的项目
    </div>
  </div>
</template>

<style scoped>
.project-select {
  position: relative;
  width: 100%;
}

.select-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.select-input {
  width: 100%;
  border: 1px solid #c9d8d2;
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.92);
  color: #163932;
  padding: 0.9rem 2.5rem 0.9rem 1rem;
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  cursor: pointer;
}

.select-input:focus {
  border-color: #2d7d67;
  box-shadow: 0 0 0 4px rgba(45, 125, 103, 0.12);
}

.select-input::placeholder {
  color: #8a9f98;
}

.clear-button {
  position: absolute;
  right: 2.2rem;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: #8a9f98;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.2s ease;
}

.clear-button:hover {
  color: #163932;
}

.dropdown-icon {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #8a9f98;
  font-size: 0.7rem;
  pointer-events: none;
}

.dropdown-list {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  max-height: 20rem;
  overflow-y: auto;
  border: 1px solid #c9d8d2;
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 8px 24px rgba(39, 78, 70, 0.12);
  list-style: none;
  margin: 0;
  padding: 0.5rem 0;
  z-index: 10;
}

.dropdown-item {
  padding: 0.75rem 1rem;
  color: #163932;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.dropdown-item:hover {
  background: rgba(45, 125, 103, 0.08);
}

.dropdown-item.selected {
  background: rgba(45, 125, 103, 0.15);
  font-weight: 600;
}

.dropdown-empty {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  border: 1px solid #c9d8d2;
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 8px 24px rgba(39, 78, 70, 0.12);
  padding: 1rem;
  color: #8a9f98;
  text-align: center;
  z-index: 10;
}
</style>
