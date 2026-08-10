import { Kbd } from "../components/Kbd";

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_LIST = [
  { keys: ["⌘", "K"], description: "Ask the AI agent" },
  { keys: ["/"], description: "Search emails & calendar" },
  { keys: ["1-9"], description: "Jump to email category" },
  { keys: ["E"], description: "Archive selected email" },
  { keys: ["R"], description: "Reply to selected email" },
  { keys: ["⌘", "Z"], description: "Undo pending action" },
  { keys: ["?"], description: "Open keyboard shortcuts guide" },
  { keys: ["Esc"], description: "Close modal / cancel reply" },
];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/70 pt-20"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-ink-600 bg-ink-800 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-semibold text-mist-50">
              Keyboard Shortcuts
            </h2>
          </div>
          <Kbd keys={["esc"]} />
        </div>

        <div className="p-5">
          <div className="divide-y divide-ink-700">
            {SHORTCUT_LIST.map((item) => (
              <div
                key={item.description}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <span className="text-mist-300">{item.description}</span>
                <Kbd keys={item.keys} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
