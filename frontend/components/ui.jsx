'use client';

import { useEffect, useMemo } from 'react';
import { faNumber, faPercent } from '@/lib/format';

export function Card({ title, hint, action, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          <div>
            <h3 className="card-title">
              {title && <span className="dot" />}
              {title}
            </h3>
            {hint && <div className="card-hint">{hint}</div>}
          </div>
          {action}
        </header>
      )}
      <div className={`card-body ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, icon, tone = 'brand', foot, suffix }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-head">
        <span className="stat-label">{label}</span>
        <span className="stat-icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="stat-value">
        {typeof value === 'number' ? faNumber(value) : value}
        {suffix ? <span className="text-sm text-muted"> {suffix}</span> : null}
      </div>
      {foot ? <div className="stat-foot">{foot}</div> : null}
    </article>
  );
}

export function Badge({ tone = 'neutral', children, icon }) {
  return (
    <span className={`badge badge-${tone}`}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}

export function EmptyState({ icon = '📭', title = 'داده‌ای یافت نشد', description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="empty-title">{title}</span>
      {description ? <span className="empty-desc">{description}</span> : null}
      {action}
    </div>
  );
}

export function Loader({ text = 'در حال دریافت اطلاعات…' }) {
  return (
    <div className="loading-block">
      <span className="spinner" />
      <span>{text}</span>
    </div>
  );
}

export function Field({ label, required, error, hint, children, className = '' }) {
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`}>
      {label ? (
        <label>
          {label}
          {required ? <span className="req">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <span className="error-text">{error}</span> : null}
      {!error && hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'جست‌وجو…', onClear }) {
  return (
    <div className="search-box">
      <span className="search-icon" aria-hidden="true">
        🔍
      </span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-label={placeholder}
      />
      {value ? (
        <button
          type="button"
          className="btn-ghost btn-icon"
          style={{ position: 'absolute', insetInlineStart: 6, top: 5, background: 'transparent', border: 0 }}
          onClick={() => (onClear ? onClear() : onChange(''))}
          aria-label="پاک کردن جست‌وجو"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

export function Pagination({ pagination, onPageChange }) {
  if (!pagination) return null;
  const { page, totalPages, total, limit } = pagination;
  const pages = useMemo(() => {
    const list = [];
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    for (let index = start; index <= end; index += 1) list.push(index);
    return list;
  }, [page, totalPages]);

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  return (
    <div className="pagination">
      <span>
        نمایش {faNumber(from)} تا {faNumber(to)} از {faNumber(total)} مورد
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="page-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          قبلی
        </button>
        {pages[0] > 1 ? <span className="text-muted">…</span> : null}
        {pages.map((item) => (
          <button
            key={item}
            type="button"
            className={`page-btn ${item === page ? 'active' : ''}`}
            onClick={() => onPageChange(item)}
          >
            {faNumber(item)}
          </button>
        ))}
        {pages[pages.length - 1] < totalPages ? <span className="text-muted">…</span> : null}
        <button
          type="button"
          className="page-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          بعدی
        </button>
      </div>
    </div>
  );
}

export function BarList({ items, tone = 'brand', valueLabel = 'بار', emptyText = 'داده‌ای ثبت نشده است.' }) {
  if (!items?.length) {
    return <div className="text-sm text-muted">{emptyText}</div>;
  }

  const max = Math.max(...items.map((item) => Number(item.value) || 0), 1);

  return (
    <div className="bar-list">
      {items.map((item) => {
        const percent = Math.max(4, Math.round(((Number(item.value) || 0) / max) * 100));
        return (
          <div className="bar-row" key={item.key ?? item.label}>
            <div className="bar-label">
              <span className="name" title={item.label}>
                {item.label}
                {item.tag ? <span className="badge badge-neutral" style={{ marginInlineStart: 6 }}>{item.tag}</span> : null}
              </span>
              <span className="value">
                {faNumber(item.value)} {valueLabel && <span className="text-xs">{valueLabel}</span>}
                {item.suffix ? <span className="text-xs"> {item.suffix}</span> : null}
              </span>
            </div>
            <div className="bar-track">
              <div className={`bar-fill ${tone}`} style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TrendChart({ data, showLegend = true }) {
  if (!data?.length) return <div className="text-sm text-muted">داده‌ای برای نمایش نیست.</div>;

  const max = Math.max(...data.map((item) => item.total || 0), 1);
  const first = data[0]?.date?.slice(5) || '';
  const last = data[data.length - 1]?.date?.slice(5) || '';

  return (
    <>
      <div className="trend-chart" role="img" aria-label="نمودار روند روزانه بارها">
        {data.map((item) => {
          const height = Math.max(6, Math.round(((item.total || 0) / max) * 100));
          const confirmedShare = item.total ? (item.confirmed / item.total) * 100 : 0;
          const cancelledShare = item.total ? (item.cancelled / item.total) * 100 : 0;
          return (
            <div
              className="trend-col"
              key={item.date}
              title={`${item.date} — کل: ${item.total} | تایید: ${item.confirmed} | کنسل: ${item.cancelled} | در انتظار: ${item.pending}`}
            >
              <div className="trend-stack" style={{ height: `${height}%` }}>
                <div className="trend-seg confirmed" style={{ height: `${confirmedShare}%` }} />
                <div className="trend-seg cancelled" style={{ height: `${cancelledShare}%` }} />
                <div className="trend-seg pending" style={{ flex: 1 }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="trend-axis">
        <span>{first}</span>
        <span>{last}</span>
      </div>
      {showLegend ? (
        <div className="legend mt-12">
          <span className="legend-item">
            <span className="legend-dot confirmed" /> تایید شده
          </span>
          <span className="legend-item">
            <span className="legend-dot cancelled" /> کنسل شده
          </span>
          <span className="legend-item">
            <span className="legend-dot pending" /> در انتظار
          </span>
        </div>
      ) : null}
    </>
  );
}

export function RankList({ items, valueKey = 'confirmed', label, emptyText = 'داده‌ای یافت نشد.' }) {
  if (!items?.length) return <div className="text-sm text-muted">{emptyText}</div>;

  return (
    <div className="rank-list">
      {items.map((item, index) => (
        <div className={`rank-item ${index === 0 ? 'top-1' : ''}`} key={item.id}>
          <span className="rank-index">{faNumber(index + 1)}</span>
          <div className="rank-body">
            <div className="rank-name">{item.fullName}</div>
            <div className="rank-meta">
              {[item.cityName, item.zoneName].filter(Boolean).join(' • ') || 'نامشخص'}
            </div>
          </div>
          <span className="rank-value">
            {faNumber(item[valueKey] ?? 0)} <span className="text-xs text-muted">{label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function Modal({ open, title, subtitle, onClose, children, footer, size = '' }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <div className={`modal ${size}`}>
        <header className="modal-head">
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle ? <div className="modal-subtitle">{subtitle}</div> : null}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="بستن">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, description, confirmText = 'تایید', tone = 'danger', onConfirm, onClose, busy }) {
  return (
    <Modal
      open={open}
      size="sm"
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
            انصراف
          </button>
          <button type="button" className={`btn btn-${tone}`} onClick={onConfirm} disabled={busy}>
            {busy ? <span className="spinner light" /> : null}
            {confirmText}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted">{description}</p>
    </Modal>
  );
}

export function RateBar({ value, tone = 'brand' }) {
  const safe = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className="flex-center gap-8">
      <div className="bar-track" style={{ flex: 1, minWidth: 60 }}>
        <div className={`bar-fill ${tone}`} style={{ width: `${safe}%` }} />
      </div>
      <span className="text-xs num" style={{ minWidth: 38, textAlign: 'left' }}>
        {faPercent(safe)}
      </span>
    </div>
  );
}
