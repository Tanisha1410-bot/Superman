import { useEffect, useRef, useState } from "react";
import { parseSender, type EmailItem } from "../types";
import { PriorityDot } from "../components/PriorityDot";
import { Kbd } from "../components/Kbd";
import { fetchEmails, summarizeEmail } from "../api/client";
import {
  Inbox as InboxIcon,
  Mail,
  Tag,
  Users,
  Bell,
  MessageSquare,
  AlertOctagon,
  Send,
  FileText,
  Trash2,
  type LucideIcon,
} from "lucide-react";

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function snippetFrom(body: string | null, max = 90) {
  if (!body) return "";
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

interface SummaryData {
  decided: string;
  open: string;
  owner: string;
}

interface CategoryConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  key?: string;
}

const CATEGORIES: CategoryConfig[] = [
  { id: "ALL", label: "All Mail", icon: Mail, key: "1" },
  { id: "INBOX", label: "Inbox", icon: InboxIcon, key: "2" },
  { id: "CATEGORY_PROMOTIONS", label: "Promotions", icon: Tag, key: "3" },
  { id: "CATEGORY_SOCIAL", label: "Social", icon: Users, key: "4" },
  { id: "CATEGORY_UPDATES", label: "Updates", icon: Bell, key: "5" },
  { id: "CATEGORY_FORUMS", label: "Forums", icon: MessageSquare, key: "6" },
  { id: "SPAM", label: "Spam", icon: AlertOctagon, key: "7" },
  { id: "SENT", label: "Sent", icon: Send, key: "8" },
  { id: "DRAFT", label: "Drafts", icon: FileText, key: "9" },
  { id: "TRASH", label: "Trash", icon: Trash2 },
];

interface InboxProps {
  emails: EmailItem[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  replyingId?: string | null;
  replyBody?: string;
  onReplyBodyChange?: (val: string) => void;
  onSendReply?: () => void;
  onCancelReply?: () => void;
  replySending?: boolean;
}

export function Inbox({
  emails: initialEmails,
  loading: initialLoading,
  error: initialError,
  selectedId,
  onSelect,
  replyingId,
  replyBody = "",
  onReplyBodyChange,
  onSendReply,
  onCancelReply,
  replySending = false,
}: InboxProps) {
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [emails, setEmails] = useState<EmailItem[]>(initialEmails);
  const [loading, setLoading] = useState(initialLoading);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(initialError);

  const [summaries, setSummaries] = useState<Record<string, SummaryData | null>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync when initial props change
  useEffect(() => {
    if (activeCategory === "ALL" && !nextCursor) {
      setEmails(initialEmails);
      setLoading(initialLoading);
      setError(initialError);
    }
  }, [initialEmails, initialLoading, initialError, activeCategory, nextCursor]);

  // Load emails whenever category changes
  const loadCategoryEmails = async (cat: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchEmails(cat, undefined, 50);
      setEmails(res.emails);
      setHasMore(res.hasMore);
      setNextCursor(res.nextCursor);
      if (res.counts) setCategoryCounts(res.counts);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (cat: string) => {
    setActiveCategory(cat);
    loadCategoryEmails(cat);
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await fetchEmails(activeCategory, nextCursor, 50);
      setEmails((prev) => [...prev, ...res.emails]);
      setHasMore(res.hasMore);
      setNextCursor(res.nextCursor);
      if (res.counts) setCategoryCounts(res.counts);
    } catch (err) {
      console.error("Failed to load more emails:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      handleLoadMore();
    }
  };

  const handleSummarizeClick = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (summaries[id]) {
      setSummaries((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    if (loadingIds.has(id)) return;

    setLoadingIds((prev) => new Set(prev).add(id));
    setErrorIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    try {
      const res = await summarizeEmail(id);
      setSummaries((prev) => ({ ...prev, [id]: res.summary }));
    } catch (err) {
      console.error("Failed to summarize email:", err);
      setErrorIds((prev) => new Set(prev).add(id));
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const getTotalCount = (catId: string) => {
    if (catId === "ALL") {
      return Object.values(categoryCounts).reduce((a, b) => a + b, 0);
    }
    return categoryCounts[catId] || 0;
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Category Sidebar */}
      <aside className="w-56 shrink-0 border-r border-ink-700 bg-ink-900/40 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-mist-600">
          Categories
        </div>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          const count = getTotalCount(cat.id);

          return (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-cobalt-500/15 text-cobalt-400 border border-cobalt-500/30"
                  : "text-mist-400 hover:bg-ink-800 hover:text-mist-50"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{cat.label}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {count > 0 && (
                  <span className="rounded-full bg-ink-800 px-2 py-0.5 font-mono text-[10px] text-mist-400">
                    {count}
                  </span>
                )}
                {cat.key && <Kbd keys={[cat.key]} />}
              </div>
            </button>
          );
        })}
      </aside>

      {/* Main Email Feed */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0"
      >
        {loading && emails.length === 0 ? (
          <div className="flex h-full items-center justify-center text-mist-600 font-mono text-sm">
            Loading inbox…
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center p-6">
            <p className="text-mist-50 font-medium">Couldn't load your inbox</p>
            <p className="text-mist-400 text-sm max-w-xs">{error}</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center p-6">
            <p className="text-mist-50 font-medium">No emails in this category</p>
            <p className="text-mist-400 text-sm">Select another category or wait for new mail.</p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-ink-700">
              {emails.map((email, idx) => {
                const isSelected = email.id === selectedId;
                const isReplying = email.id === replyingId;
                const { name } = parseSender(email.sender);
                const isLoadingSummary = loadingIds.has(email.id);
                const summary = summaries[email.id];
                const isSummaryError = errorIds.has(email.id);

                const currentPriority = email.priority || "low";
                const prevPriority = idx > 0 ? emails[idx - 1].priority || "low" : null;
                const showHeader = idx === 0 || currentPriority !== prevPriority;

                const getPriorityHeaderLabel = (pri: string) => {
                  if (pri === "high") return "High Priority";
                  if (pri === "medium") return "Medium Priority";
                  return "Low Priority";
                };

                return (
                  <li key={email.id}>
                    {showHeader && (
                      <div className="bg-ink-900/90 border-y border-ink-700/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-mist-400 flex items-center gap-2">
                        <PriorityDot priority={currentPriority as any} />
                        <span>{getPriorityHeaderLabel(currentPriority)}</span>
                      </div>
                    )}
                    <div
                      onClick={() => onSelect(email.id)}
                      className={`group flex flex-col w-full px-4 py-3 text-left transition-colors cursor-pointer
                        ${isSelected ? "bg-ink-700" : "hover:bg-ink-800"}`}
                    >
                      <div className="flex items-start gap-3">
                        <PriorityDot priority={email.priority} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate font-body text-sm font-semibold text-mist-50">
                              {name}
                            </span>
                            <span className="shrink-0 font-mono text-xs text-mist-600">
                              {formatTime(email.received_at)}
                            </span>
                          </div>
                          <p className="truncate text-sm text-mist-50">{email.subject || "(no subject)"}</p>
                          <p className="truncate text-xs text-mist-600">{snippetFrom(email.body)}</p>
                        </div>
                        <div className="hidden shrink-0 items-center gap-2 self-start group-hover:flex">
                          {isLoadingSummary ? (
                            <span className="text-xs font-mono text-cobalt-400 animate-pulse px-2 py-1">
                              Summarizing...
                            </span>
                          ) : (
                            <button
                              onClick={(e) => handleSummarizeClick(e, email.id)}
                              className="text-xs text-cobalt-400 hover:text-cobalt-300 bg-ink-800 border border-ink-700 rounded-md px-2 py-1 transition-colors"
                            >
                              ✦ Summarize
                            </button>
                          )}
                          <Kbd keys={["E"]} />
                          <Kbd keys={["R"]} />
                        </div>
                      </div>

                      {isSummaryError && (
                        <p className="mt-2 text-xs text-red-400 px-4">Failed to summarize</p>
                      )}

                      {summary && (
                        <div
                          className="mt-2 mx-4 mb-2 rounded-r-lg border-l-2 border-cobalt-500 bg-ink-800 p-3 space-y-1 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className="leading-relaxed">
                            <span className="text-mist-400 font-medium">✅ Decided: </span>
                            <span className="text-mist-50">{summary.decided}</span>
                          </p>
                          <p className="leading-relaxed">
                            <span className="text-mist-400 font-medium">⏳ Open: </span>
                            <span className="text-mist-50">{summary.open}</span>
                          </p>
                          <p className="leading-relaxed">
                            <span className="text-mist-400 font-medium">👤 Next action: </span>
                            <span className="text-mist-50">{summary.owner}</span>
                          </p>
                        </div>
                      )}

                      {isReplying && (
                        <div
                          className="mt-3 flex flex-col gap-2 rounded-lg border border-ink-600 bg-ink-900 p-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-xs font-mono text-cobalt-400">Replying to {name}...</span>
                          <textarea
                            autoFocus
                            value={replyBody}
                            onChange={(e) => onReplyBodyChange?.(e.target.value)}
                            placeholder="Write your reply..."
                            className="h-20 w-full resize-none bg-transparent font-sans text-sm text-mist-50 placeholder:text-mist-600 focus:outline-none"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={onCancelReply}
                              className="rounded px-2.5 py-1 text-xs text-mist-400 hover:text-mist-50"
                            >
                              Cancel (Esc)
                            </button>
                            <button
                              disabled={replySending || !replyBody.trim()}
                              onClick={onSendReply}
                              className="rounded bg-cobalt-600 px-3 py-1 text-xs font-medium text-white hover:bg-cobalt-500 disabled:opacity-50"
                            >
                              {replySending ? "Sending..." : "Send"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {loadingMore && (
              <div className="p-4 text-center text-xs text-mist-400 font-mono animate-pulse">
                Loading more emails...
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}



