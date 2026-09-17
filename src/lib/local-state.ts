export type LocalPaperState = { deep_read: boolean; favorite: boolean };

export function localStateStorageKey(namespace: string) {
  return `research-library-local-state:${namespace || '/'}`;
}

export function parseLocalState(raw: string | null): Record<string, LocalPaperState> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, LocalPaperState>;
  } catch {
    return {};
  }
}

export function serializeLocalState(value: Record<string, LocalPaperState>) {
  return JSON.stringify(value);
}


