import React from 'react';
import { NAV_ITEMS } from '../data/mockData';

/** @typedef {{ id: string, label: string, icon: string, active?: boolean }} NavItem */

/**
 * @param {{ items: NavItem[] }} props
 */
export default function SideNavBar({ items = NAV_ITEMS }) {
  return (
    <nav className="hw-sidebar">
      <div className="hw-sidebar-brand">
        <div className="hw-logo-box">L</div>
        <div>
          <h1 className="hw-brand-title">LingoLab</h1>
          <p className="hw-brand-subtitle">Advanced Learning</p>
        </div>
      </div>
      <div className="hw-sidebar-nav">
        {items.map((item) => (
          <a
            key={item.id}
            href="#"
            className={`hw-nav-item ${item.active ? 'hw-nav-item--active' : ''}`}
          >
            <span className="hw-material-icon">{item.icon}</span>
            <span className="hw-nav-label">{item.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
