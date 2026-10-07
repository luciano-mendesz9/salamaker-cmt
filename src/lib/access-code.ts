const ACCESS_CODE_PATTERN = /^(?:AL[A-Z0-9]{7,}|PROF\d{8,})$/;

export function isValidAccessCode(value: string) {
  return ACCESS_CODE_PATTERN.test(value.trim().toUpperCase());
}
