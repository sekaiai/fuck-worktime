const QUICK_TEMPLATES = [
  '日常需求处理与沟通协作',
  '项目开发与联调测试',
  '缺陷修复与质量保障',
] as const;

export function useTemplatePrefill() {
  function getQuickTemplates(): readonly string[] {
    return QUICK_TEMPLATES;
  }

  function prefillIfEmpty(value: string, apply: (nextValue: string) => void): boolean {
    if (value.trim()) {
      return false;
    }

    apply(QUICK_TEMPLATES[0]);
    return true;
  }

  return {
    getQuickTemplates,
    prefillIfEmpty,
  };
}
