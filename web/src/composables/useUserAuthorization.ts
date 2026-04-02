import { shallowRef } from 'vue';

import {
  type AuthorizedUserProfile,
  saveAuthorizationToken,
} from '../api/user';

type SubmitStatus = 'idle' | 'success' | 'error';

export function useUserAuthorization() {
  const token = shallowRef('');
  const isSubmitting = shallowRef(false);
  const tutorialVisible = shallowRef(true);
  const submitStatus = shallowRef<SubmitStatus>('idle');
  const statusMessage = shallowRef('填写 Token 后，系统会自动验证授权并保存用户信息。');
  const authorizedUser = shallowRef<AuthorizedUserProfile | null>(null);

  const submitToken = async () => {
    const trimmedToken = token.value.trim();

    if (!trimmedToken) {
      submitStatus.value = 'error';
      statusMessage.value = '请输入授权 Token。';
      return;
    }

    isSubmitting.value = true;

    try {
      const response = await saveAuthorizationToken(trimmedToken);

      if (!response.success || !response.data) {
        submitStatus.value = 'error';
        statusMessage.value = response.message || '授权失败。';
        return;
      }

      submitStatus.value = 'success';
      statusMessage.value = response.message || '授权成功';
      authorizedUser.value = response.data;
    } catch (error) {
      submitStatus.value = 'error';
      statusMessage.value = error instanceof Error ? error.message : '授权失败。';
    } finally {
      isSubmitting.value = false;
    }
  };

  const toggleTutorial = () => {
    tutorialVisible.value = !tutorialVisible.value;
  };

  return {
    token,
    isSubmitting,
    tutorialVisible,
    submitStatus,
    statusMessage,
    authorizedUser,
    submitToken,
    toggleTutorial,
  };
}
