<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { Project, WorkTypeNode } from '../../types/timesheet';
import type { AutoFillConfig, AutoFillStatus } from '../../types/auto-fill';

const props = defineProps<{
  status: AutoFillStatus;
  config: AutoFillConfig | null;
  deadlineDisplay: string | null;
  projects: Project[];
  workTypes: WorkTypeNode[];
  isLoading: boolean;
  isSaving: boolean;
  isDisabling: boolean;
}>();

const emit = defineEmits<{
  'load-projects': [];
  'save': [config: Partial<AutoFillConfig> & { userId: string }];
  'disable': [];
}>();

const isExpanded = ref(false);
const showResult = ref(false);
const resultMessage = ref('');
const resultSuccess = ref(false);

const formProjectId = ref('');
const formProjectTitle = ref('');
const formItemId = ref('');
const formItemName = ref('');
const formHours = ref(8);
const formWork = ref('');
const formDeadline = ref('');

const flatWorkTypes = ref<Array<{ node: WorkTypeNode; parent: string }>>([]);

watch(() => props.workTypes, (types) => {
  const result: Array<{ node: WorkTypeNode; parent: string }> = [];
  for (const parent of types) {
    if (parent.children && parent.children.length > 0) {
      for (const child of parent.children) {
        result.push({ node: child, parent: parent.name });
      }
    } else {
      result.push({ node: parent, parent: '' });
    }
  }
  flatWorkTypes.value = result;
}, { immediate: true });

watch(() => props.config, (cfg) => {
  if (cfg) {
    formProjectId.value = cfg.projectId;
    formProjectTitle.value = cfg.projectTitle;
    formItemId.value = cfg.itemId;
    formItemName.value = cfg.itemName;
    formHours.value = cfg.hours;
    formWork.value = cfg.work;
    formDeadline.value = cfg.deadline || '';
  }
}, { immediate: true });

function toggleExpand() {
  if (!isExpanded.value) {
    isExpanded.value = true;
    emit('load-projects');
  } else {
    isExpanded.value = false;
  }
}

function onProjectChange(projectId: string) {
  const project = props.projects.find((p) => p.id === projectId);
  if (project) {
    formProjectId.value = project.id;
    formProjectTitle.value = project.title;
    formItemId.value = '';
    formItemName.value = '';
  }
}

function onWorkTypeChange(itemId: string) {
  const found = flatWorkTypes.value.find((f) => f.node.id === itemId);
  if (found) {
    formItemId.value = found.node.id;
    formItemName.value = found.node.name;
  }
}

function onSave() {
  if (!formProjectId.value || !formItemId.value) return;
  emit('save', {
    userId: props.config?.userId || '',
    enabled: true,
    expired: false,
    projectId: formProjectId.value,
    projectTitle: formProjectTitle.value,
    projectStatus: 20,
    itemId: formItemId.value,
    itemName: formItemName.value,
    hours: formHours.value,
    work: formWork.value,
    deadline: formDeadline.value || null,
  });
}

function onDisable() {
  emit('disable');
}

function showSaveResult(success: boolean, message: string) {
  resultSuccess.value = success;
  resultMessage.value = message;
  showResult.value = true;
}

defineExpose({ showSaveResult });

const statusText = computed((): string => {
  switch (props.status) {
    case 'enabled': return '已开启';
    case 'expired': return '已截止';
    default: return '未开启';
  }
});

const statusType = computed((): string => {
  switch (props.status) {
    case 'enabled': return 'success';
    case 'expired': return 'warning';
    default: return 'default';
  }
});
</script>

<template>
  <section class="auto-fill-form">
    <div class="auto-fill-form__trigger" @click="toggleExpand">
      <div class="auto-fill-form__trigger-left">
        <span class="auto-fill-form__trigger-title">自动填报</span>
        <nut-tag :type="statusType" size="small">{{ statusText }}</nut-tag>
        <span v-if="deadlineDisplay && status === 'expired'" class="auto-fill-form__deadline">
          截止: {{ deadlineDisplay }}
        </span>
      </div>
      <nut-icon :name="isExpanded ? 'up' : 'down'" size="14"></nut-icon>
    </div>

    <div v-if="isExpanded" class="auto-fill-form__body">
      <nut-cell-group>
        <nut-cell title="项目">
          <template #value>
            <select
              class="auto-fill-form__select"
              :value="formProjectId"
              @change="onProjectChange(($event.target as HTMLSelectElement).value)"
            >
              <option value="" disabled>请选择项目</option>
              <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.title }}</option>
            </select>
          </template>
        </nut-cell>

        <nut-cell title="工时类型">
          <template #value>
            <select
              class="auto-fill-form__select"
              :value="formItemId"
              :disabled="!formProjectId || workTypes.length === 0"
              @change="onWorkTypeChange(($event.target as HTMLSelectElement).value)"
            >
              <option value="" disabled>请选择工时类型</option>
              <optgroup v-for="group in workTypes" :key="group.id" :label="group.name">
                <option v-for="child in group.children" :key="child.id" :value="child.id">
                  {{ child.name }}
                </option>
              </optgroup>
              <option v-for="f in flatWorkTypes.filter((f) => !f.parent)" :key="f.node.id" :value="f.node.id">
                {{ f.node.name }}
              </option>
            </select>
          </template>
        </nut-cell>

        <nut-cell title="工时">
          <template #value>
            <nut-input-number
              v-model="formHours"
              :min="1"
              :max="24"
            />
          </template>
        </nut-cell>

        <nut-cell title="工作内容">
          <template #value>
            <input
              class="auto-fill-form__input"
              v-model="formWork"
              placeholder="请输入工作内容"
            />
          </template>
        </nut-cell>

        <nut-cell title="截止日期">
          <template #value>
            <input
              class="auto-fill-form__input"
              type="date"
              v-model="formDeadline"
            />
          </template>
        </nut-cell>
      </nut-cell-group>

      <p class="auto-fill-form__hint">
        不设置截止日期，则会在每个可填报工作日自动填报当天工时
      </p>

      <div class="auto-fill-form__actions">
        <nut-button
          type="primary"
          block
          :loading="isSaving"
          :disabled="!formProjectId || !formItemId"
          @click="onSave"
        >
          保存
        </nut-button>
        <nut-button
          v-if="status === 'enabled'"
          type="default"
          block
          :loading="isDisabling"
          @click="onDisable"
        >
          关闭自动填报
        </nut-button>
      </div>
    </div>

    <nut-dialog
      v-model:visible="showResult"
      :title="resultSuccess ? '操作成功' : '操作失败'"
      :close-on-click-overlay="true"
      @ok="showResult = false"
    >
      <p>{{ resultMessage }}</p>
    </nut-dialog>
  </section>
</template>

<style scoped>
.auto-fill-form {
  background: #fff;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.auto-fill-form__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
}

.auto-fill-form__trigger-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.auto-fill-form__trigger-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1a1a2e;
}

.auto-fill-form__deadline {
  font-size: 0.75rem;
  color: #d48806;
}

.auto-fill-form__body {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.auto-fill-form__select {
  width: 100%;
  max-width: 200px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.85rem;
  background: #fff;
  appearance: auto;
}

.auto-fill-form__input {
  width: 100%;
  max-width: 200px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.85rem;
}

.auto-fill-form__hint {
  margin: 0;
  font-size: 0.8rem;
  color: #999;
  line-height: 1.5;
}

.auto-fill-form__actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
