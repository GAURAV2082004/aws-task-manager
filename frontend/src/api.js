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

export const listTasks = () => request("/tasks");
export const createTask = (title) =>
  request("/tasks", { method: "POST", body: JSON.stringify({ title }) });
export const updateTask = (taskId, patch) =>
  request(`/tasks/${encodeURIComponent(taskId)}`, { method: "PUT", body: JSON.stringify(patch) });
export const deleteTask = (taskId) =>
  request(`/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
