import { useEffect, useRef, useState } from "react";
import { sendAgentMessage } from "../api/client";
import type { AgentMessage } from "../types";
import { Kbd } from "../components/Kbd";

interface AgentBarProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

export function AgentBar({ open, onClose, userId }: AgentBarProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || sending) return;

    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setPrompt("");
    setSending(true);
    setError(null);

    try {
      const { reply } = await sendAgentMessage(trimmed, userId);
      setMessages((prev) => [...prev, reply]);
    } catch {
      setError("The agent didn't respond. Check the backend and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/70 pt-24"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-ink-600 bg-ink-800 shadow-2xl"
      >
        {messages.length > 0 && (
          <div className="max-h-80 space-y-3 overflow-y-auto border-b border-ink-700 p-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`text-sm ${m.role === "user" ? "text-mist-50" : "text-cobalt-400"}`}
              >
                <span className="mr-2 font-mono text-xs text-mist-600">
                  {m.role === "user" ? ">" : "agent"}
                </span>
                {m.content}
              </div>
            ))}
            {error && <p className="text-sm text-amber-400">{error}</p>}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3">
          <span className="font-mono text-cobalt-400">›</span>
          <input
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={sending}
            placeholder="Email Aditi confirming and put a 30-min call on my calendar Thursday 10am"
            className="flex-1 bg-transparent font-mono text-sm text-mist-50 placeholder:text-mist-600 focus:outline-none"
          />
          <Kbd keys={["esc"]} />
        </form>
      </div>
    </div>
  );
}
