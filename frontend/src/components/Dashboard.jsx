import { CategoryBadge, Checkbox, DueDate, EmptyState, PriorityBadge } from "./ui.jsx";

export default function Dashboard({ stats, tasks, onToggle, onViewAll, onAdd }) {
  const cards = [
    { key: "total", label: "Total tasks", value: stats?.total, tone: "accent" },
    { key: "done", label: "Completed", value: stats?.done, tone: "low" },
    { key: "overdue", label: "Overdue", value: stats?.overdue, tone: "danger" },
    { key: "high", label: "High priority", value: stats?.high, tone: "high" },
  ];
  const recent = [...tasks]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
  const pct = stats?.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Where your work stands today.</p>
        </div>
        <button className="btn primary" onClick={onAdd}>+ New task</button>
      </div>

      <div className="cards">
        {cards.map((c) => (
          <div key={c.key} className={`card metric tone-${c.tone}`}>
            <span className="metric-label">{c.label}</span>
            <span className="metric-value">{c.value ?? "–"}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Recent tasks</h2>
          <button className="link" onClick={onViewAll}>View all</button>
        </div>
        {stats && stats.total > 0 && (
          <div className="progress" title={`${pct}% complete`}>
            <div className="progress-bar" style={{ width: `${pct}%` }} />
          </div>
        )}
        {recent.length === 0 ? (
          <EmptyState title="No tasks yet" hint="Create your first task to see it here.">
            <button className="btn primary" onClick={onAdd}>+ New task</button>
          </EmptyState>
        ) : (
          <ul className="mini-list">
            {recent.map((t) => (
              <li key={t.taskId} className={t.done ? "is-done" : ""}>
                <Checkbox
                  checked={t.done}
                  onChange={() => onToggle(t)}
                  label={`Mark "${t.title}" ${t.done ? "to do" : "done"}`}
                />
                <span className="mini-title">{t.title}</span>
                <CategoryBadge name={t.category} />
                <PriorityBadge priority={t.priority} />
                <DueDate task={t} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
