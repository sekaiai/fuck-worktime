import { ref, computed, type Ref } from 'vue';
import { getAutoFillConfig, saveAutoFillConfig, disableAutoFill } from '../api/timesheet';
import type { AutoFillConfig, AutoFillStatus } from '../types/auto-fill';

export function useAutoFill(userId: Ref<string | null>) {
  const config = ref<AutoFillConfig | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const isDisabling = ref(false);

  const status = computed<AutoFillStatus>(() => {
    if (!config.value || !config.value.enabled) return 'disabled';
    if (config.value.expired) return 'expired';
    if (config.value.deadline && new Date(config.value.deadline) < new Date()) {
      return 'expired';
    }
    return 'enabled';
  });

  const deadlineDisplay = computed<string | null>(() => {
    if (!config.value?.deadline) return null;
    return config.value.deadline;
  });

  async function loadConfig(): Promise<void> {
    if (!userId.value) return;
    isLoading.value = true;
    try {
      config.value = await getAutoFillConfig(userId.value);
    } catch {
      config.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  async function save(newConfig: Partial<AutoFillConfig> & { userId: string }): Promise<{ success: boolean; message: string }> {
    isSaving.value = true;
    try {
      const result = await saveAutoFillConfig(newConfig);
      if (result.code === 200) {
        await loadConfig();
        return { success: true, message: result.msg };
      }
      return { success: false, message: result.msg };
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败';
      return { success: false, message };
    } finally {
      isSaving.value = false;
    }
  }

  async function disable(): Promise<{ success: boolean; message: string }> {
    if (!userId.value) return { success: false, message: '未登录' };
    isDisabling.value = true;
    try {
      const result = await disableAutoFill(userId.value);
      if (result.code === 200) {
        await loadConfig();
        return { success: true, message: result.msg };
      }
      return { success: false, message: result.msg };
    } catch (err) {
      const message = err instanceof Error ? err.message : '操作失败';
      return { success: false, message };
    } finally {
      isDisabling.value = false;
    }
  }

  return {
    config,
    status,
    deadlineDisplay,
    isLoading,
    isSaving,
    isDisabling,
    loadConfig,
    save,
    disable,
  };
}
