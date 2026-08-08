interface KbdProps {
  keys: string[]; // e.g. ["cmd", "K"] or ["E"]
}

/**
 * Renders a keyboard shortcut as physical-looking keycaps. This is the
 * app's signature device: since every core action is keyboard-first,
 * showing the real key (not a generic icon) teaches the shortcut every
 * time it's seen.
 */
export function Kbd({ keys }: KbdProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k) => (
        <kbd
          key={k}
          className="min-w-[1.4rem] rounded-md border border-ink-500 bg-ink-700 px-1.5 py-0.5
                     text-center font-mono text-[11px] leading-tight text-mist-400 shadow-keycap"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
