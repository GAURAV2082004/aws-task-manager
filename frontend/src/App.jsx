import { useEffect, useMemo, useState } from "react";
import { listTasks, createTask, updateTask, deleteTask } from "./api.js";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "To do" },
  { id: "done", label: "Done" },
];

const EMPTY = {
  all: "No tasks yet. Add your first one above.",
  open: "Nothing left to do.",
  done: "No finished tasks yet.",
};

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    listTasks()
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const openCount = tasks.filter((t) => !t.done).length;

  // The API returns oldest first; show newest first.
  const visible = useMemo(
    () =>
      [...tasks]
        .reverse()
        .filter((t) => (filter === "all" ? true : filter === "done" ? t.done : !t.done)),
    [tasks, filter]
  );

  async function run(action) {
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e.message);
    }
  }

  const replace = (updated) =>
    setTasks((prev) => prev.map((t) => (t.taskId === updated.taskId ? updated : t)));

  const add = (e) => {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    run(async () => {
      const task = await createTask(value);
      setTasks((prev) => [...prev, task]);
      setTitle("");
    });
  };

  const toggle = (task) =>
    run(async () => replace(await updateTask(task.taskId, { done: !task.done })));

  const saveEdit = (task) =>
    run(async () => {
      const value = draft.trim();
      if (value && value !== task.title) replace(await updateTask(task.taskId, { title: value }));
      setEditingId(null);
    });

  const remove = (task) =>
    run(async () => {
      await deleteTask(task.taskId);
      setTasks((prev) => prev.filter((t) => t.taskId !== task.taskId));
    });

  return (
    <main className="shell">
      <header className="head">
        <h1>Tasks</h1>
        <p className="count">
          {loading ? "Loading…" : openCount === 0 ? "All done" : `${openCount} left to do`}
        </p>
      </header>

      <form className="add" onSubmit={add}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          maxLength={200}
          aria-label="New task"
        />
        <button type="submit" disabled={!title.trim()}>
          Add task
        </button>
      </form>

      <div role="alert" className={error ? "error" : "error hidden"}>
        {error}
      </div>

      <div className="filters" role="tablist" aria-label="Filter tasks">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            className={filter === f.id ? "tab on" : "tab"}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!loading && visible.length === 0 && <p className="empty">{EMPTY[filter]}</p>}

      <ul className="list">
        {visible.map((task) => (
          <li key={task.taskId} className={task.done ? "item done" : "item"}>
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => toggle(task)}
              aria-label={`Mark "${task.title}" as ${task.done ? "to do" : "done"}`}
            />

            {editingId === task.taskId ? (
              <input
                className="edit"
                autoFocus
                value={draft}
                maxLength={200}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(task);
                  if (e.key === "Escape") setEditingId(null);
                }}
                onBlur={() => saveEdit(task)}
                aria-label="Edit task title"
              />
            ) : (
              <span className="title">{task.title}</span>
            )}

            <div className="actions">
              {editingId !== task.taskId && (
                <button
                  className="ghost"
                  onClick={() => {
                    setEditingId(task.taskId);
                    setDraft(task.title);
                  }}
                >
                  Edit
                </button>
              )}
              <button className="ghost danger" onClick={() => remove(task)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
