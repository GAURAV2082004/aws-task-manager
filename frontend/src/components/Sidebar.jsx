import { IconDashboard, IconTag, IconTasks, IconCheck } from "./Icons.jsx";

const NAV = [
  { id: "dashboard", label: "Dashboard", Icon: IconDashboard },
  { id: "tasks", label: "Tasks", Icon: IconTasks },
  { id: "categories", label: "Categories", Icon: IconTag },
];

export default function Sidebar({ page, onNavigate, open, onClose, overdueCount }) {
  return (
    <>
      <div className={open ? "scrim nav-scrim show" : "scrim nav-scrim"} onClick={onClose} />
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brand-mark">
            <IconCheck width={16} height={16} strokeWidth={3} />
          </span>
          TaskFlow
        </div>
        <nav aria-label="Main">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={page === id ? "nav-item active" : "nav-item"}
              aria-current={page === id ? "page" : undefined}
              onClick={() => onNavigate(id)}
            >
              <Icon />
              <span>{label}</span>
              {id === "tasks" && overdueCount > 0 && (
                <span className="nav-count" title="Overdue tasks">{overdueCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">Serverless on AWS · v2</div>
      </aside>
    </>
  );
}
