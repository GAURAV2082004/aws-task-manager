import { EmptyState } from "./ui.jsx";

export default function CategoriesPage({ tasks, onOpen, onAdd }) {
  const stats = new Map();
  for (const t of tasks) {
    const s = stats.get(t.category) ?? { total: 0, done: 0 };
    s.total += 1;
    if (t.done) s.done += 1;
    stats.set(t.category, s);
  }
  const rows = [...stats.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Categories</h1>
          <p className="muted">{rows.length} {rows.length === 1 ? "category" : "categories"}</p>
        </div>
        <button className="btn primary" onClick={onAdd}>+ New task</button>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <EmptyState title="No categories yet" hint="Categories appear as you add tasks." />
        ) : (
          <ul className="cat-list">
            {rows.map(([name, s]) => (
              <li key={name}>
                <button className="cat-row" onClick={() => onOpen(name)} title={`Show ${name} tasks`}>
                  <span className="cat-name">{name}</span>
                  <span className="cat-progress" aria-hidden="true">
                    <span style={{ width: `${(s.done / s.total) * 100}%` }} />
                  </span>
                  <span className="muted cat-done">{s.done}/{s.total} done</span>
                  <span className="cat-count">{s.total} {s.total === 1 ? "task" : "tasks"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
