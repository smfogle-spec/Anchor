import { useState, useEffect, useCallback } from "react";

const UNDO_STORAGE_KEY = "anchor_undo_stack";
const MAX_UNDO_ITEMS = 20;

export function useUndoPersistence<T>(key: string = UNDO_STORAGE_KEY) {
  const [stack, setStack] = useState<T[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setStack(parsed.slice(0, MAX_UNDO_ITEMS));
        }
      }
    } catch (e) {
      console.warn("Failed to load undo stack:", e);
    }
    setIsLoaded(true);
  }, [key]);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(key, JSON.stringify(stack.slice(0, MAX_UNDO_ITEMS)));
      } catch (e) {
        console.warn("Failed to save undo stack:", e);
      }
    }
  }, [stack, key, isLoaded]);

  const push = useCallback((item: T) => {
    setStack((prev) => [item, ...prev].slice(0, MAX_UNDO_ITEMS));
  }, []);

  const pop = useCallback((): T | undefined => {
    let popped: T | undefined;
    setStack((prev) => {
      if (prev.length === 0) return prev;
      [popped] = prev;
      return prev.slice(1);
    });
    return popped;
  }, []);

  const clear = useCallback(() => {
    setStack([]);
  }, []);

  const peek = useCallback((): T | undefined => {
    return stack[0];
  }, [stack]);

  return {
    stack,
    push,
    pop,
    clear,
    peek,
    isEmpty: stack.length === 0,
    size: stack.length,
    isLoaded,
  };
}
