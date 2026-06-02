export type ValidationRule = {
  validate: (value: unknown) => boolean;
  message: string;
};

export type ValidationRules = {
  [key: string]: ValidationRule[];
};

export interface ValidationResult {
  valid: boolean;
  errors: {
    [key: string]: string;
  };
}

export function validate(values: Record<string, unknown>, rules: ValidationRules): ValidationResult {
  const errors: { [key: string]: string } = {};

  for (const field in rules) {
    const fieldRules = rules[field];
    const value = values[field];

    for (const rule of fieldRules) {
      if (!rule.validate(value)) {
        errors[field] = rule.message;
        break;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export const required = (message = '此字段为必填项'): ValidationRule => ({
  validate: (value) => {
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return value !== null && value !== undefined;
  },
  message,
});

export const minLength = (min: number, message?: string): ValidationRule => ({
  validate: (value) => {
    if (typeof value === 'string') {
      return value.trim().length >= min;
    }
    return false;
  },
  message: message || `最少需要 ${min} 个字符`,
});

export const maxLength = (max: number, message?: string): ValidationRule => ({
  validate: (value) => {
    if (typeof value === 'string') {
      return value.length <= max;
    }
    return true;
  },
  message: message || `最多只能输入 ${max} 个字符`,
});

export const minValue = (min: number, message?: string): ValidationRule => ({
  validate: (value) => {
    if (typeof value === 'number') {
      return value >= min;
    }
    return false;
  },
  message: message || `值不能小于 ${min}`,
});

export const maxValue = (max: number, message?: string): ValidationRule => ({
  validate: (value) => {
    if (typeof value === 'number') {
      return value <= max;
    }
    return true;
  },
  message: message || `值不能大于 ${max}`,
});

export const pattern = (regex: RegExp, message = '格式不正确'): ValidationRule => ({
  validate: (value) => {
    if (typeof value === 'string') {
      return regex.test(value);
    }
    return false;
  },
  message,
});

export const email = (message = '请输入有效的邮箱地址'): ValidationRule =>
  pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message);

export const phone = (message = '请输入有效的手机号码'): ValidationRule =>
  pattern(/^1[3-9]\d{9}$/, message);
