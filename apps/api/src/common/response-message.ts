export function getChineseErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && /[\u3400-\u9fff]/u.test(error.message)) {
    return error.message;
  }

  return fallback;
}
