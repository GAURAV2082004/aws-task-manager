import { useEffect, useRef, useState } from "react";
import { IconClose } from "./Icons.jsx";

const EMPTY = {
  title: "",
  description: "",
  priority: "medium",
  dueDate: "",
  category: "General",
  done: false,
};

/** Slide-in panel from the right. `task` null = create, otherwise edit. */
export default function TaskPanel({ open, task, categories, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const titleRef = useRef(null);

  // Reset the form each time the panel opens.
  useEffect(() => {
    if (!open) return;
    setForm(
      task
        ? {
            title: task.title,
            description: task.description ?? "",
            priority: task.priority,
            dueDate: task.dueDate ?? "",
            category: task.category,
            done: task.done,
          }
        : EMPTY
    );
    setError("");
    setSaving(false);
    const t = setTimeout(() => titleRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, [open, task]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e) {
    e.preventDefault();
    const title = form.title.trim();
    const category = form.category.trim();
    if (!title) return setError("Please enter a title.");
    if (title.length > 200) return setError("Title must be 200 characters or fewer.");
    if (!category) return setError("Please enter a category.");
    setSaving(true);
    setError("");
    try {
      await onSave({
        title,
        description: form.description.trim(),
        priority: form.priority,
        dueDate: form.dueDate || null,
        category,
        done: form.done,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <>
      <div className={open ? "scrim show" : "scrim"} onClick={onClose} />
      <aside
        className={open ? "panel open" : "panel"}
        role="dialog"
        aria-modal="true"
        aria-label={task ? "Edit task" : "New task"}
        aria-hidden={!open}
      >
        <form onSubmit={submit} noValidate>
          <div className="panel-head">
            <h2>{task ? "Edit task" : "New task"}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close panel">
              <IconClose />
            </button>
          </div>

          <div className="panel-body">
            <div className="field">
              <label htmlFor="f-title">Title</label>
              <input
                id="f-title"
                ref={titleRef}
                value={form.title}
                maxLength={200}
                placeholder="What needs doing?"
                onChange={(e) => set({ title: e.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="f-desc">Description</label>
              <textarea
                id="f-desc"
                rows={4}
                maxLength={2000}
                placeholder="Optional details"
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            </div>

            <fieldset className="field">
              <legend>Priority</legend>
              <div className="radio-row">
                {["high", "medium", "low"].map((p) => (
                  <label key={p} className={`radio radio-${p}${form.priority === p ? " selected" : ""}`}>
                    <input
                      type="radio"
                      name="priority"
                      value={p}
                      checked={form.priority === p}
                      onChange={() => set({ priority: p })}
                    />
                    <span className="dot" />
                    {p[0].toUpperCase() + p.slice(1)}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="field-row">
              <div className="field">
                <label htmlFor="f-due">Due date</label>
                <input id="f-due" type="date" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="f-cat">Category</label>
                <input
                  id="f-cat"
                  list="category-options"
                  value={form.category}
                  maxLength={50}
                  onChange={(e) => set({ category: e.target.value })}
                />
                <datalist id="category-options">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>

            <label className="toggle">
              <input type="checkbox" checked={form.done} onChange={(e) => set({ done: e.target.checked })} />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
              <span>Mark as done</span>
            </label>

            {error && <div className="form-error" role="alert">{error}</div>}
          </div>

          <div className="panel-foot">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "Saving…" : task ? "Save changes" : "Create task"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
