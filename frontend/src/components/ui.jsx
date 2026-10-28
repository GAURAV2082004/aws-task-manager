import { isOverdue } from "../api.js";
import { IconCheck } from "./Icons.jsx";

export const PRIORITY_LABEL = { high: "High", medium: "Medium", low: "Low" };

export function PriorityBadge({ priority }) {
  return (
    <span className={`badge badge-${priority}`}>
      <span className="dot" />
      {PRIORITY_LABEL[priority] ?? priority}
    </span>
  );
}

export const CategoryBadge = ({ name }) => <span className="badge badge-cat">{name}</span>;

export function formatDate(s) {
  if (!s) return "—";
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DueDate({ task }) {
  const late = isOverdue(task);
  return (
    <span className={late ? "due overdue" : "due"}>
      {formatDate(task.dueDate)}
      {late && <span className="due-flag">Overdue</span>}
    </span>
  );
}

export function Checkbox({ checked, onChange, label }) {
  return (
    <label className="check" title={label}>
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
      <span className="check-box">
        <IconCheck width={12} height={12} strokeWidth={3.5} />
      </span>
    </label>
  );
}

export function EmptyState({ title, hint, children }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {hint && <p>{hint}</p>}
      {children}
    </div>
  );
}
