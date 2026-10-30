/** Reject bulk text inserted by mobile context menus and keyboards even when paste events are missing. */
export function isBlockedCodeEditorChange(previous: string, next: string, inputType?: string) {
  const kind = inputType?.toLowerCase() ?? "";
  if (kind.includes("paste") || kind.includes("drop")) return true;
  if (kind.startsWith("history")) return false;

  let prefix = 0;
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < previous.length - prefix && suffix < next.length - prefix && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix += 1;

  const inserted = next.slice(prefix, next.length - suffix);
  return Array.from(inserted).length > 1;
}
