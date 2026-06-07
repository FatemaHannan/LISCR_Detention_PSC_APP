import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import './Layout.css';

const NAV = [
  { path: '/dashboard', label: 'Dashboard',   icon: '▦' },
  { path: '/chat',      label: 'AI Analyst',  icon: '◈' },
  { path: '/tasks',     label: 'PDAIP Tasks', icon: '☰' },
  { path: '/vessels',   label: 'Vessels',     icon: '⬡' },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={`layout ${collapsed ? 'layout--collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-mark">LIS</div>
            {!collapsed && (
              <div className="logo-text">
                <div className="logo-title">PSC Intelligence</div>
                <div className="logo-sub">LISCR · Jun 2026</div>
              </div>
            )}
          </div>
          <button className="collapse-btn" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>
        <nav className="nav">
          {NAV.map(({ path, label, icon }) => (
            <NavLink key={path} to={path} className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}>
              <span className="nav-icon">{icon}</span>
              {!collapsed && <span className="nav-label">{label}</span>}
            </NavLink>
          ))}
        </nav>
        {!collapsed && (
          <div className="sidebar-footer">
            <div className="sidebar-metric">
              <div className="sm-label">Detentions YTD</div>
              <div className="sm-value red">107</div>
            </div>
            <div className="sidebar-metric">
              <div className="sm-label">Open PDAIP</div>
              <div className="sm-value amber">28</div>
            </div>
            <div className="sidebar-metric">
              <div className="sm-label">Active cases</div>
              <div className="sm-value accent">6</div>
            </div>
          </div>
        )}
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
