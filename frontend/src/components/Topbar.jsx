import { IconMenu, IconMoon, IconSearch, IconSun } from "./Icons.jsx";

export default function Topbar({ search, onSearch, dark, onToggleDark, onMenu }) {
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Open menu">
        <IconMenu />
      </button>
      <label className="search">
        <IconSearch />
        <input
          type="search"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          aria-label="Search tasks"
        />
      </label>
      <div className="topbar-right">
        <button
          className="icon-btn"
          onClick={onToggleDark}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          title={dark ? "Light mode" : "Dark mode"}
        >
          {dark ? <IconSun /> : <IconMoon />}
        </button>
        <div className="user">
          <span className="avatar">DU</span>
          <span className="user-name">Demo User</span>
        </div>
      </div>
    </header>
  );
}
