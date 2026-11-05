// localStorage can throw (private mode, blocked storage): never let it break the app.
export function getPref<T extends string>(key: string, fallback: T, allowed?: readonly T[]): T {
  try {
    const v = localStorage.getItem(`kharcha.${key}`) as T | null;
    if (v && (!allowed || allowed.includes(v))) return v;
  } catch { /* ignore */ }
  return fallback;
}
export function setPref(key: string, value: string) {
  try { localStorage.setItem(`kharcha.${key}`, value); } catch { /* ignore */ }
}
