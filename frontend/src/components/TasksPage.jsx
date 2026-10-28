import { useEffect, useMemo, useState } from "react";
import { isOverdue, listTasks } from "../api.js";
import { IconEdit, IconTrash } from "./Icons.jsx";
import { CategoryBadge, Checkbox, DueDate, EmptyState, PriorityBadge } from "./ui.jsx";

const STATUS = [
  { id: "all", label: "All" },
  { id: "todo", label: "To Do" },
  { id: "done", label: "Done" },
  { id: "overdue", label: "Overdue" },
];

export default function TasksPage({
  search,
  version,
  categories,
  filters,
  onFilters,
  onToggle,
  onEdit,
  onDelete,
  onAdd,
  onError,
}) {
  const { status, priority, category } = filters;
  const [rows, setRows] = useState(null);
  const [debounced, setDebounced] = useState(search);

  // Debounce the search so we don't call the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Filtering happens on the server (GET /tasks?done=&priority=&category=&search=).
  // "Overdue" has no query param, so it is narrowed client-side below.
  useEffect(() => {
    let cancelled = false;
    listTasks({
      done: status === "done" ? "true" : status === "todo" || status === "overdue" ? "false" : "",
      priority,
      category,
      search: debounced.trim(),
    })
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && onError(e.message));
    return () => {
      cancelled = true;
    };
  }, [status, priority, category, debounced, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    if (!rows) return null;
    const list = status === "overdue" ? rows.filter(isOverdue) : rows;
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [rows, status]);

  const filtered = status !== "all" || priority || category || debounced.trim();
  const set = (patch) => onFilters({ ...filters, ...patch });

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Tasks</h1>
          <p className="muted">{visible ? `${visible.length} shown` : "Loading…"}</p>
        </div>
        <button className="btn primary" onClick={onAdd}>+ New task</button>
      </div>

      <div className="filter-bar">
        <div className="seg" role="tablist" aria-label="Status">
          {STATUS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={status === s.id}
              className={status === s.id ? "seg-btn active" : "seg-btn"}
              onClick={() => set({ status: s.id })}
            >
              {s.label}
            </button>
          ))}
        </div>
        <select value={priority} onChange={(e) => set({ priority: e.target.value })} aria-label="Filter by priority">
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={category} onChange={(e) => set({ category: e.target.value })} aria-label="Filter by category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {filtered && (
          <button className="link" onClick={() => onFilters({ status: "all", priority: "", category: "" })}>
            Clear filters
          </button>
        )}
      </div>

      <div className="card table-card">
        {visible === null ? (
          <div className="loading">Loading tasks…</div>
        ) : visible.length === 0 ? (
          <EmptyState
            title={filtered ? "No tasks match these filters" : "No tasks yet"}
            hint={filtered ? "Try clearing a filter or changing the search." : "Add your first task to get started."}
          >
            {!filtered && <button className="btn primary" onClick={onAdd}>+ New task</button>}
          </EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="tasks">
              <thead>
                <tr>
                  <th className="col-check"><span className="sr-only">Done</span></th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Due date</th>
                  <th className="col-actions"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.taskId} className={t.done ? "is-done" : ""}>
                    <td className="col-check">
                      <Checkbox
                        checked={t.done}
                        onChange={() => onToggle(t)}
                        label={`Mark "${t.title}" ${t.done ? "to do" : "done"}`}
                      />
                    </td>
                    <td>
                      <div className="t-title">{t.title}</div>
                      {t.description && <div className="t-desc">{t.description}</div>}
                    </td>
                    <td><CategoryBadge name={t.category} /></td>
                    <td><PriorityBadge priority={t.priority} /></td>
                    <td><DueDate task={t} /></td>
                    <td className="col-actions">
                      <button className="icon-btn" onClick={() => onEdit(t)} aria-label={`Edit "${t.title}"`} title="Edit">
                        <IconEdit />
                      </button>
                      <button className="icon-btn danger" onClick={() => onDelete(t)} aria-label={`Delete "${t.title}"`} title="Delete">
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
