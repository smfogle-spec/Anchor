import { lazy, Suspense, ComponentType } from "react";

export function lazyWithPreload<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  const LazyComponent = lazy(importFn);
  
  return Object.assign(LazyComponent, {
    preload: importFn,
  });
}

export { Suspense };
