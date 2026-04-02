<script setup lang="ts">
import { computed, ref } from 'vue';
import type { WorkType } from '../../api/timesheet';

interface Props {
  workTypes: WorkType[];
  modelValue: string | null;
}

interface Emits {
  (event: 'update:modelValue', value: string | null): void;
  (event: 'change', workType: WorkType): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isDropdownOpen = ref<boolean>(false);

const flattenedWorkTypes = computed(() => {
  const result: Array<WorkType & { indent: number }> = [];
  
  function flatten(items: WorkType[], indent: number = 0) {
    for (const item of items) {
      result.push({ ...item, indent });
      if (item.children && item.children.length > 0) {
        flatten(item.children, indent + 1);
      }
    }
  }
  
  flatten(props.workTypes);
  return result;
});

const selectedWorkType = computed(() => {
  if (!props.modelValue) return null;
  return flattenedWorkTypes.value.find(w => w.id === props.modelValue) || null;
});

const displayText = computed(() => {
  return selectedWorkType.value?.name || '请选择工时类型';
});

const handleSelect = (workType: WorkType) => {
  emit('update:modelValue', workType.id);
  emit('change', workType);
  isDropdownOpen.value = false;
};

const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value;
};

const handleBlur = () => {
  setTimeout(() => {
    isDropdownOpen.value = false;
  }, 200);
};

const clearSelection = () => {
  emit('update:modelValue', null);
};

const getIndentStyle = (indent: number) => {
  return {
    paddingLeft: `${indent * 1.5 + 1}rem`,
  };
};
</script>

<template>
  <div class="work-type-select">
    <div class="select-input-wrapper">
      <div
        class="select-display"
        tabindex="0"
        @click="toggleDropdown"
        @blur="handleBlur"
        @keydown.enter="toggleDropdown"
        @keydown.space.prevent="toggleDropdown"
      >
        <span :class="['display-text', { placeholder: !selectedWorkType }]">
          {{ displayText }}
        </span>
        <button
          v-if="selectedWorkType"
          class="clear-button"
          type="button"
          @click.stop="clearSelection"
        >
          ×
        </button>
        <span class="dropdown-icon">▼</span>
      </div>
    </div>

    <ul v-if="isDropdownOpen && flattenedWorkTypes.length > 0" class="dropdown-list">
      <li
        v-for="workType in flattenedWorkTypes"
        :key="workType.id"
        :class="['dropdown-item', { selected: workType.id === modelValue }]"
        :style="getIndentStyle(workType.indent)"
        @click="handleSelect(workType)"
      >
        {{ workType.name }}
      </li>
    </ul>

    <div v-if="isDropdownOpen && flattenedWorkTypes.length === 0" class="dropdown-empty">
      暂无工时类型
    </div>
  </div>
</template>

<style scoped>
.work-type-select {
  position: relative;
  width: 100%;
}

.select-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.select-display {
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 2.8rem;
}

.select-display:focus {
  border-color: #2d7d67;
  box-shadow: 0 0 0 4px rgba(45, 125, 103, 0.12);
}

.display-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.display-text.placeholder {
  color: #8a9f98;
}

.clear-button {
  border: none;
  background: transparent;
  color: #8a9f98;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0;
  margin-right: 0.5rem;
  line-height: 1;
  transition: color 0.2s ease;
}

.clear-button:hover {
  color: #163932;
}

.dropdown-icon {
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
