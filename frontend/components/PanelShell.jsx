'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import { NAV_ITEMS } from '@/lib/constants';
import { faDateWithWeekday, initials, todayISO } from '@/lib/format';

export default function PanelShell({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div className="loading-block">
          <span className="spinner" />
          <span>در حال بارگذاری پنل…</span>
        </div>
      </div>
    );
  }

  const navItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const activeItem = navItems.find((item) => pathname.startsWith(item.href));

  return (
    <div className="app-shell">
      <div
        className={`sidebar-backdrop ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-logo">🚗</div>
          <div>
            <div className="brand-title">امداد خودرو سراسری</div>
            <div className="brand-subtitle">سامانه مدیریت اپراتورها (CRM)</div>
          </div>
        </div>

        <div className="sidebar-section-title">منوی اصلی</div>
        <nav>
          <ul className="nav-list">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`nav-link ${pathname.startsWith(item.href) ? 'active' : ''}`}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="nav-text">
                    <span className="nav-label">{item.label}</span>
                    <span className="nav-desc">{item.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="avatar">{initials(user.fullName)}</span>
            <div>
              <div className="sidebar-user-name">{user.fullName}</div>
              <div className="sidebar-user-role">
                {user.role === 'admin' ? 'مدیر سیستم' : 'اپراتور پاسخگو'}
              </div>
            </div>
          </div>
          {user.role === 'admin' ? (
            <button
              type="button"
              className="sidebar-logout"
              onClick={() => setPasswordOpen(true)}
              style={{ marginBottom: 8 }}
            >
              🔑 تغییر رمز عبور
            </button>
          ) : (
            <div className="sidebar-hint" style={{ marginBottom: 8 }}>
              🔒 رمز عبور و اطلاعات حساب فقط توسط مدیر تغییر می‌کند
            </div>
          )}
          <button type="button" className="sidebar-logout" onClick={logout}>
            خروج از حساب
          </button>
        </div>
      </aside>

      <div className="content-area">
        <header className="topbar">
          <div className="flex-center gap-12">
            <button
              type="button"
              className="menu-toggle"
              onClick={() => setMenuOpen((current) => !current)}
              aria-label="منو"
            >
              ☰
            </button>
            <div>
              <div className="topbar-title">{activeItem?.label || 'پنل مدیریت'}</div>
              <div className="topbar-subtitle">{activeItem?.description || 'سامانه CRM امداد خودرو'}</div>
            </div>
          </div>

          <div className="topbar-actions">
            <span className="topbar-date">{faDateWithWeekday(todayISO())}</span>
            <span className="badge badge-brand">
              {user.role === 'admin' ? '👤 مدیر' : '🎧 اپراتور'}
            </span>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>

      {user.role === 'admin' ? (
        <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      ) : null}
    </div>
  );
}
