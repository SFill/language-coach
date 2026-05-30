import React from 'react';
import { NAV_ITEMS } from '../data/mockData';

export default function SideNavBar({ items = NAV_ITEMS, inquiries = [] }) {
  return (
    <nav className="hw-sidebar">
      <div className="hw-sidebar-brand">
        <div className="hw-logo-box">
          <span className="hw-material-icon hw-logo-icon">science</span>
        </div>
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

      {/* Active Inquiries */}
      {inquiries.length > 0 && (
        <div className="hw-inquiries">
          <h3 className="hw-inquiries-title">Active Inquiries</h3>
          <div className="hw-inquiries-list">
            {inquiries.map((inquiry) => (
              <div key={inquiry.id} className={`hw-inquiry-card ${inquiry.status === 'analyzing' ? 'hw-inquiry-card--analyzing' : ''}`}>
                {inquiry.status === 'analyzing' && (
                  <div className="hw-inquiry-progress">
                    <div className="hw-inquiry-progress-bar" />
                  </div>
                )}
                <div className="hw-inquiry-header">
                  <span className="hw-inquiry-name">{inquiry.name}</span>
                  {inquiry.status === 'resolved' && (
                    <span className="hw-material-icon hw-inquiry-icon hw-inquiry-icon--resolved">check_circle</span>
                  )}
                  {inquiry.status === 'analyzing' && (
                    <span className="hw-material-icon hw-inquiry-icon hw-inquiry-icon--analyzing">sync</span>
                  )}
                </div>
                <span className="hw-inquiry-meta">
                  {inquiry.status === 'resolved' ? `Resolved • ${inquiry.time}` : 'Analyzing text...'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}