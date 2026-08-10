import { useEffect, useRef, useState } from "react";
import { cancelAgentAction, confirmAgentAction, fetchContacts, sendAgentMessage } from "../api/client";
import type { AgentMessage } from "../types";
import { Kbd } from "../components/Kbd";
import { Mic } from "lucide-react";
import { normalizeVoiceTranscript, type KnownContact } from "../utils/voiceNormalize";

interface PendingActionItem {
  actionId: string;
  tool: string;
  args: any;
}

interface ConfirmationCardProps {
  actionId: string;
  tool: string;
  args: any;
  onResolved: (actionId: string) => void;
}

function ConfirmationCard({ actionId, tool, args, onResolved }: ConfirmationCardProps) {
  const [loading, setLoading] = useState(false);
  const [resultStatus, setResultStatus] = useState<"pending" | "confirmed" | "cancelled" | "error">("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await confirmAgentAction(actionId);
      setResultStatus("confirmed");
      setTimeout(() => onResolved(actionId), 2000);
    } catch (err: any) {
      setResultStatus("error");
      setErrorMessage(err?.message || "Failed to confirm action");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await cancelAgentAction(actionId);
      setResultStatus("cancelled");
      setTimeout(() => onResolved(actionId), 2000);
    } catch (err: any) {
      setResultStatus("error");
      setErrorMessage(err?.message || "Failed to cancel action");
    } finally {
      setLoading(false);
    }
  };

  if (resultStatus === "confirmed") {
    return (
      <div className="rounded-lg border border-moss-400/40 bg-ink-900/80 p-3 text-xs text-moss-400 font-medium">
        ✅ Action confirmed and executed successfully!
      </div>
    );
  }

  if (resultStatus === "cancelled") {
    return (
      <div className="rounded-lg border border-mist-600/40 bg-ink-900/80 p-3 text-xs text-mist-400 font-medium">
        🚫 Action cancelled.
      </div>
    );
  }

  return (
    <div className="my-2 rounded-xl border border-ink-600 bg-ink-900/90 p-4 shadow-md space-y-3">
      <div className="flex items-center justify-between border-b border-ink-700 pb-2">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-cobalt-400">
          {tool === "send_email" ? "📧 Confirm Email Send" : tool === "create_event" ? "📅 Confirm Calendar Event" : `⚡ Confirm Action: ${tool}`}
        </span>
      </div>

      {tool === "send_email" && (
        <div className="space-y-1 text-xs">
          <p><span className="text-mist-400 font-medium">To: </span><span className="text-mist-50">{args?.to}</span></p>
          <p><span className="text-mist-400 font-medium">Subject: </span><span className="text-mist-50">{args?.subject}</span></p>
          {args?.body && (
            <div className="mt-2 rounded border border-ink-700 bg-ink-950 p-2 text-mist-300 line-clamp-3">
              {args.body}
            </div>
          )}
        </div>
      )}

      {tool === "create_event" && (
        <div className="space-y-1 text-xs">
          <p><span className="text-mist-400 font-medium">Title: </span><span className="text-mist-50">{args?.title}</span></p>
          <p><span className="text-mist-400 font-medium">Start: </span><span className="text-mist-50">{args?.startTime}</span></p>
          <p><span className="text-mist-400 font-medium">End: </span><span className="text-mist-50">{args?.endTime}</span></p>
          {args?.attendees && args.attendees.length > 0 && (
            <p><span className="text-mist-400 font-medium">Attendees: </span><span className="text-mist-50">{args.attendees.join(", ")}</span></p>
          )}
        </div>
      )}

      {errorMessage && <p className="text-xs text-amber-400">{errorMessage}</p>}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          disabled={loading}
          onClick={handleCancel}
          className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs font-medium text-mist-300 hover:bg-ink-700 hover:text-mist-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          disabled={loading}
          onClick={handleConfirm}
          className="rounded-lg bg-cobalt-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-cobalt-500 transition-colors disabled:opacity-50 shadow-sm"
        >
          {loading ? "Executing..." : "Confirm & Send"}
        </button>
      </div>
    </div>
  );
}

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
  const [pendingActionCards, setPendingActionCards] = useState<PendingActionItem[]>([]);

  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const contactsRef = useRef<KnownContact[]>([]);

  // Fetch known contacts once on mount for fuzzy name correction
  useEffect(() => {
    fetchContacts()
      .then((res) => {
        contactsRef.current = res.contacts;
      })
      .catch((err) => console.warn("Could not load contacts for voice correction:", err));
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Web Speech API initialization
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onresult = (event: any) => {
      let fullTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      setPrompt(fullTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Apply normalization on final transcript when recognition ends
      setPrompt((prev) => {
        if (!prev.trim()) return prev;
        return normalizeVoiceTranscript(prev, contactsRef.current);
      });
    };

    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleActionResolved = (actionId: string) => {
    setPendingActionCards((prev) => prev.filter((item) => item.actionId !== actionId));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || sending || pendingActionCards.length > 0) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

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
      const res = await sendAgentMessage(trimmed, userId);
      setMessages((prev) => [...prev, res.reply]);
      if (res.pending_actions && res.pending_actions.length > 0) {
        setPendingActionCards((prev) => [...prev, ...res.pending_actions!]);
      }
    } catch {
      setError("The agent didn't respond. Check the backend and try again.");
    } finally {
      setSending(false);
    }
  }

  const hasUnresolvedActions = pendingActionCards.length > 0;

  return (
    <>
      {open && (
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
                  <div key={m.id} className="space-y-2">
                    <div className={`text-sm ${m.role === "user" ? "text-mist-50" : "text-cobalt-400"}`}>
                      <span className="mr-2 font-mono text-xs text-mist-600">
                        {m.role === "user" ? ">" : "agent"}
                      </span>
                      {m.content}
                    </div>
                  </div>
                ))}

                {pendingActionCards.map((card) => (
                  <ConfirmationCard
                    key={card.actionId}
                    actionId={card.actionId}
                    tool={card.tool}
                    args={card.args}
                    onResolved={handleActionResolved}
                  />
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
                disabled={sending || hasUnresolvedActions}
                placeholder={
                  hasUnresolvedActions
                    ? "Please confirm or cancel the pending action above..."
                    : "Email Aditi confirming and put a 30-min call on my calendar Thursday 10am"
                }
                className="flex-1 bg-transparent font-mono text-sm text-mist-50 placeholder:text-mist-600 focus:outline-none disabled:opacity-50"
              />

              <button
                type="button"
                onClick={toggleListening}
                disabled={!speechSupported || sending || hasUnresolvedActions}
                title={speechSupported ? (isListening ? "Stop listening" : "Start voice input") : "Web Speech API not supported in this browser"}
                className={`relative flex items-center justify-center p-1.5 rounded-lg border transition-colors ${
                  isListening
                    ? "border-red-500 bg-red-500/20 text-red-400"
                    : "border-ink-600 bg-ink-700 text-mist-400 hover:text-mist-50"
                } disabled:opacity-40`}
              >
                <Mic className="h-4 w-4" />
                {isListening && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </span>
                )}
              </button>

              <Kbd keys={["esc"]} />
            </form>
          </div>
        </div>
      )}
    </>
  );
}




