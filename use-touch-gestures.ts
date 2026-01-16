import { useRef, useCallback, useEffect } from "react";

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  currentX: number;
  currentY: number;
}

interface UseTouchGesturesOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: (x: number, y: number) => void;
  onLongPress?: (x: number, y: number) => void;
  swipeThreshold?: number;
  longPressDelay?: number;
}

export function useTouchGestures<T extends HTMLElement>(
  options: UseTouchGesturesOptions = {}
) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onLongPress,
    swipeThreshold = 50,
    longPressDelay = 500,
  } = options;

  const ref = useRef<T>(null);
  const touchState = useRef<TouchState | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      touchState.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        currentX: touch.clientX,
        currentY: touch.clientY,
      };

      if (onLongPress) {
        longPressTimer.current = setTimeout(() => {
          if (touchState.current) {
            const { startX, startY, currentX, currentY } = touchState.current;
            const moved = Math.abs(currentX - startX) + Math.abs(currentY - startY);
            if (moved < 10) {
              onLongPress(currentX, currentY);
            }
          }
        }, longPressDelay);
      }
    },
    [onLongPress, longPressDelay]
  );

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchState.current) return;
    
    const touch = e.touches[0];
    touchState.current.currentX = touch.clientX;
    touchState.current.currentY = touch.clientY;

    if (longPressTimer.current) {
      const moved = 
        Math.abs(touch.clientX - touchState.current.startX) +
        Math.abs(touch.clientY - touchState.current.startY);
      if (moved > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      if (!touchState.current) return;

      const { startX, startY, startTime, currentX, currentY } = touchState.current;
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const duration = Date.now() - startTime;

      if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      } else if (Math.abs(deltaY) > swipeThreshold && Math.abs(deltaY) > Math.abs(deltaX)) {
        if (deltaY > 0) {
          onSwipeDown?.();
        } else {
          onSwipeUp?.();
        }
      } else if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && duration < 300) {
        onTap?.(currentX, currentY);
      }

      touchState.current = null;
    },
    [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap, swipeThreshold]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: true });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return ref;
}

export function isTouchDevice(): boolean {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
}
