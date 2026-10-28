// The API URL is injected at build time (see scripts/deploy-frontend.sh).
const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      ...options,
      headers: { "content-type": "application/json" },
    });
  } catch {
    throw new Error("Can't reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

/** Local YYYY-MM-DD (not UTC) so "today" matches the user's calendar. */
export function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const isOverdue = (t) => !t.done && !!t.dueDate && t.dueDate < todayStr();

export function listTasks(filters = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filters))
    if (v !== undefined && v !== null && v !== "") q.set(k, v);
  const s = q.toString();
  return request("/tasks" + (s ? `?${s}` : ""));
}
export const createTask = (fields) =>
  request("/tasks", { method: "POST", body: JSON.stringify(fields) });
export const updateTask = (taskId, patch) =>
  request(`/tasks/${encodeURIComponent(taskId)}`, { method: "PUT", body: JSON.stringify(patch) });
export const deleteTask = (taskId) =>
  request(`/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
export const getCategories = () => request("/categories");
export const getStats = () => request(`/stats?today=${todayStr()}`);
