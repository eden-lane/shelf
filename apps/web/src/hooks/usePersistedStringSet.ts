import { useCallback, useEffect, useState } from "react";

export const usePersistedStringSet = (storageKey: string): [ReadonlySet<string>, (id: string) => void] => {
  const [items, setItems] = useState<Set<string>>(() => readStringSet(storageKey));

  useEffect(() => {
    writeStringSet(storageKey, items);
  }, [items, storageKey]);

  const toggleItem = useCallback((id: string) => {
    setItems((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }, []);

  return [items, toggleItem];
};

const readStringSet = (storageKey: string) => {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");

    if (!Array.isArray(parsed)) {
      return new Set<string>();
    }

    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set<string>();
  }
};

const writeStringSet = (storageKey: string, items: ReadonlySet<string>) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify([...items]));
  } catch {
    // Persisting sidebar preferences is best-effort.
  }
};
