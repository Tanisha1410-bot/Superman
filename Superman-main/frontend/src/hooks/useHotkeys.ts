import { useEffect } from "react";

export interface HotkeyBinding {
  key: string; // e.g. "e", "r", "/", "Escape"
  meta?: boolean; // Cmd on Mac / Ctrl on Windows, checked via metaKey||ctrlKey
  handler: () => void;
  // Set true to fire even while an input/textarea has focus (e.g. Escape)
  allowInFormFields?: boolean;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/**
 * Registers a flat list of global shortcuts. Bindings are matched by key
 * plus an optional meta/ctrl modifier. Typing into inputs is ignored
 * unless the binding opts in with allowInFormFields.
 */
export function useHotkeys(bindings: HotkeyBinding[]) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      for (const binding of bindings) {
        const metaMatches = binding.meta ? e.metaKey || e.ctrlKey : !e.metaKey && !e.ctrlKey;
        if (e.key.toLowerCase() !== binding.key.toLowerCase() || !metaMatches) continue;
        if (isTypingTarget(e.target) && !binding.allowInFormFields) continue;

        e.preventDefault();
        binding.handler();
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bindings]);
}
