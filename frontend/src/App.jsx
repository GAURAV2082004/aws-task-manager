import { useCallback, useEffect, useState } from "react";
import {
  createTask,
  deleteTask,
  getCategories,
  getStats,
  listTasks,
  updateTask,
  isOverdue,
} from "./api.js";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import Dashboard from "./components/Dashboard.jsx";
import TasksPage from "./components/TasksPage.jsx";
import CategoriesPage from "./components/CategoriesPage.jsx";
import TaskPanel from "./components/TaskPanel.jsx";

const safeGet = (k) => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const safeSet = (k, v) => {
  try { localStorage.setItem(k, v); } catch { /* storage unavailable */ }
};

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [dark, setDark] = useState(() => safeGet("tm-theme") === "dark");
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ status: "all", priority: "", category: "" });

  // Unfiltered data for the dashboard, categories page and dropdowns.
  const [allTasks, setAllTasks] = useState(null);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [version, setVersion] = useState(0); // bumps after every change so the table refetches

  const [panel, setPanel] = useState({ open: false, task: null });
  const [toast, setToast] = useState(null); // { kind, text }

  const showError = useCallback((text) => setToast({ kind: "error", text }), []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    safeSet("tm-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === "error" ? 6000 : 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(async () => {
    try {
      const [tasks, s, c] = await Promise.all([listTasks(), getStats(), getCategories()]);
      setAllTasks(tasks);
      setStats(s);
      setCategories(c);
      setVersion((v) => v + 1);
    } catch (e) {
      showError(e.message);
      setAllTasks((prev) => prev ?? []);
    }
  }, [showError]);

  useEffect(() => { refresh(); }, [refresh]);

  const navigate = (p) => {
    setPage(p);
    setMenuOpen(false);
  };

  const onSearch = (value) => {
    setSearch(value);
    if (value && page !== "tasks") setPage("tasks");
  };

  const openAdd = () => setPanel({ open: true, task: null });
  const openEdit = (task) => setPanel({ open: true, task });
  const closePanel = useCallback(() => setPanel((p) => ({ ...p, open: false })), []);

  async function save(fields) {
    if (panel.task) {
      await updateTask(panel.task.taskId, fields);
      setToast({ kind: "ok", text: "Task updated" });
    } else {
      await createTask(fields);
      setToast({ kind: "ok", text: "Task created" });
    }
    closePanel();
    await refresh();
  }

  async function toggle(task) {
    try {
      await updateTask(task.taskId, { done: !task.done });
      await refresh();
    } catch (e) {
      showError(e.message);
    }
  }

  async function remove(task) {
    if (!window.confirm(`Delete "${task.title}"? This can't be undone.`)) return;
    try {
      await deleteTask(task.taskId);
      setToast({ kind: "ok", text: "Task deleted" });
      await refresh();
    } catch (e) {
      showError(e.message);
    }
  }

  const openCategory = (name) => {
    setFilters({ status: "all", priority: "", category: name });
    setSearch("");
    navigate("tasks");
  };

  const overdueCount = stats?.overdue ?? (allTasks ?? []).filter(isOverdue).length;

  return (
    <div className="shell">
      <Sidebar
        page={page}
        onNavigate={navigate}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        overdueCount={overdueCount}
      />
      <div className="main">
        <Topbar
          search={search}
          onSearch={onSearch}
          dark={dark}
          onToggleDark={() => setDark((d) => !d)}
          onMenu={() => setMenuOpen(true)}
        />
        <main className="content">
          {page === "dashboard" && (
            <Dashboard
              stats={stats}
              tasks={allTasks ?? []}
              onToggle={toggle}
              onViewAll={() => navigate("tasks")}
              onAdd={openAdd}
            />
          )}
          {page === "tasks" && (
            <TasksPage
              search={search}
              version={version}
              categories={categories}
              filters={filters}
              onFilters={setFilters}
              onToggle={toggle}
              onEdit={openEdit}
              onDelete={remove}
              onAdd={openAdd}
              onError={showError}
            />
          )}
          {page === "categories" && (
            <CategoriesPage tasks={allTasks ?? []} onOpen={openCategory} onAdd={openAdd} />
          )}
        </main>
      </div>

      <TaskPanel
        open={panel.open}
        task={panel.task}
        categories={categories}
        onClose={closePanel}
        onSave={save}
      />

      {toast && (
        <div className={`toast ${toast.kind}`} role="status" onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
