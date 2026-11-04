'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { api } from '@/lib/api';
import { faDateTime, faNumber, initials } from '@/lib/format';
import OperatorFormModal from '@/components/OperatorFormModal';
import {
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Loader,
  Modal,
  Pagination,
  SearchInput,
  StatCard,
} from '@/components/ui';

export default function OperatorsPage() {
  const { isAdmin, user } = useAuth();
  const toast = useToast();

  const [filters, setFilters] = useState({ q: '', isActive: '', page: 1, limit: 20 });
  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => (current.q === searchInput ? current : { ...current, q: searchInput, page: 1 }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo(
    () => ({
      q: filters.q || undefined,
      isActive: filters.isActive || undefined,
      page: filters.page,
      limit: filters.limit,
    }),
    [filters]
  );

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/users', query);
      setData(response);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, query]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (operator) => {
    try {
      const response = await api.patch(`/users/${operator.id}`, { isActive: !operator.isActive });
      toast.success(response.message);
      load();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const submitPassword = async () => {
    if (!passwordTarget) return;
    if (newPassword.length < 10) {
      toast.error('رمز عبور باید حداقل ۱۰ کاراکتر باشد.');
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      toast.error('رمز عبور باید شامل حرف انگلیسی و عدد باشد.');
      return;
    }
    setBusy(true);
    try {
      const response = await api.patch(`/users/${passwordTarget.id}/password`, { newPassword });
      toast.success(response.message || 'رمز عبور تغییر کرد.');
      setPasswordTarget(null);
      setNewPassword('');
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const unlockUser = async (operator) => {
    try {
      const response = await api.patch(`/users/${operator.id}/unlock`, {});
      toast.success(response.message || 'قفل حساب برداشته شد.');
      load();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const removeUser = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const response = await api.delete(`/users/${deleteTarget.id}`);
      toast.success(response.message || 'کاربر حذف شد.');
      setDeleteTarget(null);
      load();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="banner danger">
        ⛔ این بخش فقط برای مدیر سیستم قابل دسترسی است.
      </div>
    );
  }

  const items = data?.items || [];
  const totals = items.reduce(
    (acc, item) => ({
      loads: acc.loads + (item.stats?.total || 0),
      confirmed: acc.confirmed + (item.stats?.confirmed || 0),
      cancelled: acc.cancelled + (item.stats?.cancelled || 0),
    }),
    { loads: 0, confirmed: 0, cancelled: 0 }
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">مدیریت اپراتورها</h1>
          <p className="page-description">
            ساخت حساب اپراتور جدید، ویرایش اطلاعات، تغییر رمز عبور و فعال/غیرفعال کردن دسترسی
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            ➕ ساخت اپراتور جدید
          </button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <StatCard label="کل کاربران (همه نقش‌ها)" value={data?.pagination?.total ?? 0} icon="👥" tone="brand" />
        <StatCard
          label="کاربران فعال"
          value={items.filter((item) => item.isActive).length}
          icon="✅"
          tone="success"
          foot="در صفحه‌ی جاری"
        />
        <StatCard
          label="بارهای ثبت‌شده توسط این کاربران"
          value={totals.loads}
          icon="🚗"
          tone="teal"
          foot={`✅ ${faNumber(totals.confirmed)} · ⛔ ${faNumber(totals.cancelled)}`}
        />
        <StatCard
          label="مدیران سیستم"
          value={items.filter((item) => item.role === 'admin').length}
          icon="🛡️"
          tone="purple"
          foot="در صفحه‌ی جاری"
        />
      </div>

      <Card bodyClassName="tight">
        <div className="toolbar">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="جست‌وجو: نام، نام کاربری، شماره تماس…"
          />
          <select
            value={filters.isActive}
            onChange={(event) => setFilters((current) => ({ ...current, isActive: event.target.value, page: 1 }))}
          >
            <option value="">همه وضعیت‌ها</option>
            <option value="true">فقط فعال</option>
            <option value="false">غیرفعال</option>
          </select>
          <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
            🔄 بازخوانی
          </button>
        </div>

        {error ? (
          <div className="banner danger" style={{ margin: 14 }}>
            {error}
          </div>
        ) : null}

        {loading && !data ? (
          <Loader text="در حال دریافت کاربران…" />
        ) : items.length ? (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>کاربر</th>
                    <th>نام کاربری</th>
                    <th>تماس / کد ملی</th>
                    <th>نقش</th>
                    <th>آمار بارها</th>
                    <th>آخرین ورود</th>
                    <th>وضعیت</th>
                    <th style={{ textAlign: 'left' }}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="person">
                          <span className={`avatar ${item.role === 'admin' ? 'purple' : 'green'}`}>
                            {initials(item.fullName)}
                          </span>
                          <div>
                            <div className="person-name">{item.fullName}</div>
                            <div className="person-meta">
                              {item.id === user?.id ? 'حساب شما' : `شناسه ${faNumber(item.id)}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td dir="ltr" className="strong">
                        {item.username}
                      </td>
                      <td>
                        <span dir="ltr">{item.phone || '—'}</span>
                        <span className="sub" dir="ltr">
                          {item.nationalId || 'بدون کد ملی'}
                        </span>
                      </td>
                      <td>
                        <Badge tone={item.role === 'admin' ? 'purple' : 'brand'}>
                          {item.role === 'admin' ? '👤 مدیر' : '🎧 اپراتور'}
                        </Badge>
                      </td>
                      <td>
                        <span className="strong">{faNumber(item.stats?.total || 0)}</span>
                        <span className="sub">
                          ✅ {faNumber(item.stats?.confirmed || 0)} · ⛔ {faNumber(item.stats?.cancelled || 0)}
                        </span>
                      </td>
                      <td className="text-xs nowrap">{item.lastLoginAt ? faDateTime(item.lastLoginAt) : '—'}</td>
                      <td>
                        <Badge tone={item.isActive ? 'success' : 'neutral'}>
                          {item.isActive ? 'فعال' : 'غیرفعال'}
                        </Badge>
                      </td>
                      <td>
                        <div className="cell-actions">
                          <button
                            type="button"
                            className="btn btn-icon"
                            title="ویرایش"
                            onClick={() => {
                              setEditing(item);
                              setFormOpen(true);
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="btn btn-icon"
                            title="تغییر رمز عبور"
                            onClick={() => {
                              setPasswordTarget(item);
                              setNewPassword('');
                            }}
                          >
                            🔑
                          </button>
                          <button
                            type="button"
                            className="btn btn-icon"
                            title="رفع قفل حساب (بعد از چند بار رمز اشتباه)"
                            onClick={() => unlockUser(item)}
                          >
                            🔓
                          </button>
                          <button
                            type="button"
                            className="btn btn-icon"
                            title={item.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
                            onClick={() => toggleActive(item)}
                            disabled={item.id === user?.id}
                          >
                            {item.isActive ? '🚫' : '✅'}
                          </button>
                          {item.id !== user?.id ? (
                            <button
                              type="button"
                              className="btn btn-icon"
                              title="حذف کاربر"
                              onClick={() => setDeleteTarget(item)}
                            >
                              🗑
                            </button>
                          ) : null}
                        </div>
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
            icon="👥"
            title="کاربری یافت نشد"
            description="می‌توانید اولین اپراتور را بسازید."
            action={
              <button type="button" className="btn btn-primary btn-sm mt-12" onClick={() => setFormOpen(true)}>
                ➕ ساخت اپراتور
              </button>
            }
          />
        )}
      </Card>

      <OperatorFormModal
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />

      <Modal
        open={Boolean(passwordTarget)}
        size="sm"
        title="تغییر رمز عبور کاربر"
        subtitle={passwordTarget ? `${passwordTarget.fullName} — ${passwordTarget.username}` : ''}
        onClose={() => setPasswordTarget(null)}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setPasswordTarget(null)}>
              انصراف
            </button>
            <button type="button" className="btn btn-primary" onClick={submitPassword} disabled={busy}>
              {busy ? <span className="spinner light" /> : null}
              ذخیره رمز جدید
            </button>
          </>
        }
      >
        <Field label="رمز عبور جدید" required hint="حداقل ۱۰ کاراکتر، شامل حرف انگلیسی و عدد">
          <input
            type="text"
            dir="ltr"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="newPassword123"
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف کاربر"
        description={
          deleteTarget
            ? `آیا از حذف کاربر «${deleteTarget.fullName}» مطمئن هستید؟ بارهای ثبت‌شده‌ی او حذف نمی‌شوند اما نام ثبت‌کننده خالی می‌شود.`
            : ''
        }
        confirmText="حذف کاربر"
        onConfirm={removeUser}
        onClose={() => setDeleteTarget(null)}
        busy={busy}
      />
    </>
  );
}
