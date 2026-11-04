'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { api } from '@/lib/api';
import { faNumber } from '@/lib/format';
import { jalaliDateTimeLabel } from '@/lib/jalali';
import { Badge, Card, ConfirmDialog, EmptyState, Field, Loader, Pagination, StatCard } from '@/components/ui';

export default function SecurityPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [filters, setFilters] = useState({ active: 'true', page: 1, limit: 25 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [manualIp, setManualIp] = useState('');
  const [unbanTarget, setUnbanTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/security/bans', filters);
      setData(response);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const unban = async () => {
    if (!unbanTarget) return;
    setBusy(true);
    try {
      const response = await api.delete(`/security/bans/${encodeURIComponent(unbanTarget.ip)}`);
      toast.success(response.message || 'مسدودی برداشته شد.');
      setUnbanTarget(null);
      load();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const addManualBan = async (event) => {
    event.preventDefault();
    if (!manualIp.trim()) return;
    setBusy(true);
    try {
      const response = await api.post('/security/bans', { ip: manualIp.trim() });
      toast.success(response.message || 'IP مسدود شد.');
      setManualIp('');
      load();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return <div className="banner danger">⛔ این بخش فقط برای مدیر سیستم قابل دسترسی است.</div>;
  }

  const items = data?.items || [];
  const summary = data?.summary;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">🛡️ امنیت و IPهای مسدود</h1>
          <p className="page-description">
            هر کسی که با «حساب تله‌ی صفحه‌ی ورود» تلاش کند یا رمزها را مکرر اشتباه بزند، IP او
            خودکار مسدود می‌شود و اینجا ثبت می‌شود.
          </p>
        </div>
        <div className="page-actions">
          <div className="btn-group">
            <button
              type="button"
              className={filters.active === 'true' ? 'active' : ''}
              onClick={() => setFilters((current) => ({ ...current, active: 'true', page: 1 }))}
            >
              مسدودهای فعال
            </button>
            <button
              type="button"
              className={filters.active === 'false' ? 'active' : ''}
              onClick={() => setFilters((current) => ({ ...current, active: 'false', page: 1 }))}
            >
              همه (شامل رفع‌شده‌ها)
            </button>
          </div>
          <button type="button" className="btn btn-outline" onClick={load}>
            🔄 بازخوانی
          </button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <StatCard
          label="IPهای مسدود فعال"
          value={summary?.active ?? 0}
          icon="🚫"
          tone="danger"
          foot={`از مجموع ${faNumber(summary?.total ?? 0)} رخداد ثبت‌شده`}
        />
        <StatCard
          label="تلاش با حساب تله"
          value={summary?.decoy ?? 0}
          icon="🪤"
          tone="warning"
          foot="ورود با نام کاربری/رمز ادمین فیک"
        />
        <StatCard
          label="مسدودی خودکار بروت‌فورس"
          value={summary?.bruteForce ?? 0}
          icon="🔨"
          tone="purple"
          foot="پس از تلاش‌های ناموفق مکرر"
        />
        <StatCard
          label="مجموع تلاش‌ها"
          value={summary?.attempts ?? 0}
          icon="📊"
          tone="brand"
          foot="تعداد کل درخواست‌های مشکوک"
        />
      </div>

      <Card bodyClassName="tight">
        <form className="toolbar" onSubmit={addManualBan}>
          <div className="field" style={{ minWidth: 240 }}>
            <label htmlFor="manual-ip">مسدودسازی دستی یک IP</label>
            <input
              id="manual-ip"
              type="text"
              dir="ltr"
              placeholder="مثلاً 203.0.113.10"
              value={manualIp}
              onChange={(event) => setManualIp(event.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !manualIp.trim()}>
            🚫 مسدود کن
          </button>
        </form>

        {error ? (
          <div className="banner danger" style={{ margin: 14 }}>
            {error}
          </div>
        ) : null}

        {loading && !data ? (
          <Loader text="در حال دریافت فهرست…" />
        ) : items.length ? (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>IP</th>
                    <th>دلیل مسدودی</th>
                    <th>نام کاربری تلاش‌شده</th>
                    <th>تعداد تلاش</th>
                    <th>اولین رخداد</th>
                    <th>آخرین رخداد</th>
                    <th>وضعیت</th>
                    <th style={{ textAlign: 'left' }}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.ip}>
                      <td className="strong" dir="ltr">
                        {item.ip}
                      </td>
                      <td>
                        <Badge tone={item.reason === 'decoy_credentials' ? 'warning' : 'danger'}>
                          {item.reasonLabel}
                        </Badge>
                        {item.userAgent ? (
                          <span className="sub" dir="ltr" style={{ maxWidth: 220, display: 'block' }}>
                            {String(item.userAgent).slice(0, 60)}
                          </span>
                        ) : null}
                      </td>
                      <td dir="ltr" className="text-xs">
                        {item.username || '—'}
                      </td>
                      <td className="num">{faNumber(item.attempts)}</td>
                      <td className="text-xs nowrap">{jalaliDateTimeLabel(item.firstSeenAt)}</td>
                      <td className="text-xs nowrap">{jalaliDateTimeLabel(item.lastSeenAt)}</td>
                      <td>
                        <Badge tone={item.isActive ? 'danger' : 'neutral'}>
                          {item.isActive ? 'مسدود' : 'رفع مسدودی'}
                        </Badge>
                      </td>
                      <td style={{ textAlign: 'left' }}>
                        {item.isActive ? (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setUnbanTarget(item)}
                          >
                            🔓 رفع مسدودی
                          </button>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              pagination={data.pagination}
              onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
            />
          </>
        ) : (
          <EmptyState
            icon="🛡️"
            title="هیچ IP مسدودی وجود ندارد"
            description="اگر کسی با حساب تله وارد شود یا حمله‌ی بروت‌فورس انجام دهد، همین‌جا نمایش داده می‌شود."
          />
        )}
      </Card>

      <div className="banner info mt-18">
        <strong>حساب تله چیست؟</strong> روی صفحه‌ی ورود یک نام کاربری و رمز «ادمین» نمایش داده می‌شود
        که حساب واقعی نیست. هر کسی با آن وارد شود، IP او فوراً مسدود می‌شود تا فرصت امتحان کردن
        رمزهای واقعی را نداشته باشد. مشخصات آن با متغیرهای <code dir="ltr">DECOY_USERNAME</code> و{' '}
        <code dir="ltr">DECOY_PASSWORD</code> قابل تغییر است.
      </div>

      <ConfirmDialog
        open={Boolean(unbanTarget)}
        title="رفع مسدودی IP"
        description={
          unbanTarget
            ? `آیا مسدودی ${unbanTarget.ip} برداشته شود؟ تنها در صورتی که مطمئن هستید کاربر واقعی بوده است.`
            : ''
        }
        confirmText="رفع مسدودی"
        tone="brand"
        busy={busy}
        onConfirm={unban}
        onClose={() => setUnbanTarget(null)}
      />
    </>
  );
}
