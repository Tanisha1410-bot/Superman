import type { Priority } from "../types";

const COLORS: Record<Priority, string> = {
  high: "bg-amber-400",
  medium: "bg-cobalt-400",
  low: "bg-mist-600",
};

const LABELS: Record<Priority, string> = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
};

export function PriorityDot({ priority }: { priority: Priority }) {
  const key = COLORS[priority] ? priority : "medium"; // fallback for unseen values
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${COLORS[key]}`}
      title={LABELS[key]}
      aria-label={LABELS[key]}
    />
  );
}
