import { useEffect, useCallback } from "react";

type ShortcutHandler = () => void;

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: ShortcutHandler;
  description: string;
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  enabled: boolean = true
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;
      
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [handleKeyDown, enabled]);

  return shortcuts.map(s => ({
    key: s.key,
    modifiers: [
      s.ctrl && (navigator.platform.includes("Mac") ? "⌘" : "Ctrl"),
      s.shift && "Shift",
      s.alt && "Alt",
    ].filter(Boolean).join("+"),
    description: s.description,
  }));
}

export const SCHEDULE_SHORTCUTS = {
  UNDO: { key: "z", ctrl: true, description: "Undo last change" },
  REFRESH: { key: "r", ctrl: true, shift: true, description: "Refresh schedule" },
  CAPTURE: { key: "s", ctrl: true, shift: true, description: "Capture schedule as image" },
  ESCAPE: { key: "Escape", description: "Close editor/dialog" },
  HELP: { key: "?", shift: true, description: "Show keyboard shortcuts" },
};
