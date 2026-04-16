import { computed, shallowRef } from 'vue';

import { disableAutoFill, getAutoFillConfig, runAutoFillNow, saveAutoFillConfig } from '../api/timesheet-client';
import type { AutoFillConfig, AutoFillStatus } from '../types/auto-fill';
import { getTodayKey } from '../utils/date';

export function useAutoFillManager() {
  const config = shallowRef<AutoFillConfig | null>(null);
  const isLoading = shallowRef(false);
  const isSaving = shallowRef(false);
  const isDisabling = shallowRef(false);
  const isTriggering = shallowRef(false);

  const status = computed<AutoFillStatus>(() => {
    if (!config.value?.enabled) {
      return 'disabled';
    }

    if (config.value.expired || (config.value.deadline && config.value.deadline < getTodayKey())) {
      return 'expired';
    }

    return 'enabled';
  });

  async function load(userId: string): Promise<void> {
    isLoading.value = true;
    try {
      config.value = await getAutoFillConfig(userId);
    } catch {
      config.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  async function save(payload: Partial<AutoFillConfig> & { userId: string }) {
    isSaving.value = true;
    try {
      const result = await saveAutoFillConfig(payload);
      if (result.code === 200) {
        await load(payload.userId);
      }
      return result;
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '保存自动填报失败',
      };
    } finally {
      isSaving.value = false;
    }
  }

  async function disable(userId: string) {
    isDisabling.value = true;
    try {
      const result = await disableAutoFill(userId);
      if (result.code === 200) {
        await load(userId);
      }
      return result;
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : '关闭自动填报失败',
      };
    } finally {
      isDisabling.value = false;
    }
  }

  async function trigger(userId: string) {
    isTriggering.value = true;
    try {
      const result = await runAutoFillNow(userId);
      await load(userId);
      return result;
    } catch (error) {
      return {
        code: 500,
        msg: error instanceof Error ? error.message : 'Trigger auto-fill failed',
      };
    } finally {
      isTriggering.value = false;
    }
  }

  return {
    config,
    status,
    isLoading,
    isSaving,
    isDisabling,
    isTriggering,
    load,
    save,
    disable,
    trigger,
  };
}
