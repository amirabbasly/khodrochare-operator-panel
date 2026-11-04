'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { api, downloadExport } from '@/lib/api';
import { CANCEL_REASON_SUGGESTIONS, FOLLOW_UPS, STATUSES, STATUS_MAP } from '@/lib/constants';
import { addDaysISO, faDate, faDateWithWeekday, faNumber, todayISO } from '@/lib/format';
import { jalaliDateTimeLabel } from '@/lib/jalali';
import { LOAD_TYPES, LOAD_TYPE_MAP, formatAmount } from '@/lib/money';
import JalaliDateInput from '@/components/JalaliDateInput';
import Link from 'next/link';
import LoadFormModal from '@/components/LoadFormModal';
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
} from '@/components/ui';

const DATE_MODES = {
  today: { label: 'امروز' },
  yesterday: { label: 'دیروز' },
  week: { label: '۷ روز اخیر' },
  all: { label: 'همه تاریخ‌ها' },
  custom: { label: 'تاریخ دلخواه' },
};

export default function LoadsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [filters, setFilters] = useState({
    mode: 'today',
    date: todayISO(),
    from: '',
    to: '',
    q: '',
    status: '',
    followUp: '',
    loadType: '',
    paid: '',
    cityId: '',
    page: 1,
    limit: 20,
  });

  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zones, setZones] = useState([]);
  const [rescuers, setRescuers] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [busyAction, setBusyAction] = useState(false);
  const [dayBusy, setDayBusy] = useState(false);

  // ---- parse query string once (e.g. /loads?status=pending) ----
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const followUp = params.get('followUp');
    const date = params.get('date');
    const mode = params.get('mode');

    setFilters((current) => {
      const next = { ...current };
      if (status) next.status = status;
      if (followUp) next.followUp = followUp;
      if (date) {
        next.mode = 'custom';
        next.date = date;
      } else if (mode === 'today') {
        next.mode = 'today';
      } else if (mode === 'range') {
        // «بازه»ی داشبورد = ۷ روز اخیر
        next.mode = 'week';
      }
      return next;
    });
  }, []);

  // ---- debounce search input ----
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => (current.q === searchInput ? current : { ...current, q: searchInput, page: 1 }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ---- meta data ----
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [zonesResponse, rescuersResponse] = await Promise.all([
          api.get('/meta/zones'),
          api.get('/rescuers', { limit: 200 }),
        ]);
        if (!active) return;
        setZones(zonesResponse.items || []);
        setRescuers(rescuersResponse.items || []);
      } catch {
        if (active) setZones([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const query = useMemo(() => {
    const params = {
      q: filters.q || undefined,
      status: filters.status || undefined,
      followUp: filters.followUp || undefined,
      loadType: filters.loadType || undefined,
      paid: filters.paid || undefined,
      cityId: filters.cityId || undefined,
      page: filters.page,
      limit: filters.limit,
    };
    if (filters.mode === 'today') params.date = todayISO();
    else if (filters.mode === 'yesterday') params.date = addDaysISO(todayISO(), -1);
    else if (filters.mode === 'week') {
      params.from = addDaysISO(todayISO(), -6);
      params.to = todayISO();
    } else if (filters.mode === 'custom' && filters.date) params.date = filters.date;
    return params;
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/loads', query);
      setData(response);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedDay = query.date || null;
  const dayClosed = Boolean(data?.dayClosed);

  const applyMode = (mode) => {
    setFilters((current) => ({
      ...current,
      mode,
      from: '',
      to: '',
      date: mode === 'custom' ? current.date || todayISO() : mode === 'today' ? todayISO() : current.date,
      page: 1,
    }));
  };

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  };

  const refresh = () => load();

  const handleSaved = () => {
    refresh();
  };

  const toggleFollowUp = async (loadItem) => {
    setBusyId(loadItem.id);
    try {
      const next = loadItem.followUp === 'done' ? 'not_done' : 'done';
      const response = await api.patch(`/loads/${loadItem.id}/follow-up`, { followUp: next });
      toast.success(response.message);
      refresh();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusyId(null);
    }
  };

  const togglePayment = async (loadItem) => {
    setBusyId(loadItem.id);
    try {
      const response = await api.patch(`/loads/${loadItem.id}/payment`, { isPaid: !loadItem.isPaid });
      toast.success(response.message);
      refresh();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmLoad = async (loadItem) => {
    setBusyId(loadItem.id);
    try {
      const response = await api.patch(`/loads/${loadItem.id}/status`, { status: 'confirmed' });
      toast.success(response.message);
      refresh();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusyId(null);
    }
  };

  const submitCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      toast.error('دلیل کنسلی را وارد کنید.');
      return;
    }
    setBusyAction(true);
    try {
      const response = await api.patch(`/loads/${cancelTarget.id}/status`, {
        status: 'cancelled',
        cancelReason: cancelReason.trim(),
      });
      toast.success(response.message);
      setCancelTarget(null);
      setCancelReason('');
      refresh();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusyAction(false);
    }
  };

  const removeLoad = async () => {
    if (!deleteTarget) return;
    setBusyAction(true);
    try {
      const response = await api.delete(`/loads/${deleteTarget.id}`);
      toast.success(response.message || 'بار حذف شد.');
      setDeleteTarget(null);
      refresh();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusyAction(false);
    }
  };

  const closeDay = async () => {
    if (!selectedDay) return;
    setDayBusy(true);
    try {
      const response = await api.post(`/days/${selectedDay}/close`, { note: 'بسته‌شدن روز توسط اپراتور' });
      toast.success(response.message);
      refresh();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setDayBusy(false);
    }
  };

  const reopenDay = async () => {
    if (!selectedDay) return;
    setDayBusy(true);
    try {
      const response = await api.post(`/days/${selectedDay}/reopen`, {});
      toast.success(response.message);
      refresh();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setDayBusy(false);
    }
  };

  const exportCsv = async () => {
    try {
      const { page, limit, ...rest } = query;
      await downloadExport('/loads/export', rest, `loads-${selectedDay || 'all'}.csv`);
      toast.success('خروجی CSV دانلود شد.');
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const summary = data?.summary;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">بارهای امداد خودرو</h1>
          <p className="page-description">
            ثبت، ویرایش، تایید یا کنسل درخواست‌ها و پیگیری امدادخواهان
            {selectedDay ? ` — ${faDateWithWeekday(selectedDay)}` : ''}
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-outline" onClick={exportCsv}>
            ⬇️ خروجی CSV
          </button>
          {selectedDay ? (
            dayClosed ? (
              <button type="button" className="btn btn-outline" onClick={reopenDay} disabled={dayBusy}>
                🔓 بازگشایی روز
              </button>
            ) : (
              <button type="button" className="btn btn-outline" onClick={closeDay} disabled={dayBusy}>
                🔒 بستن روز
              </button>
            )
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            ➕ ثبت بار جدید
          </button>
        </div>
      </div>

      {selectedDay && dayClosed ? (
        <div className="banner warning" style={{ marginBottom: 16 }}>
          🔒 روز {faDate(selectedDay)} بسته شده است؛ ثبت و ویرایش بار در این روز امکان‌پذیر نیست.
          <button type="button" className="btn btn-outline btn-sm banner-action" onClick={reopenDay} disabled={dayBusy}>
            بازگشایی برای ویرایش
          </button>
        </div>
      ) : null}

      {summary ? (
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <span className="chip">
            کل بارها <b>{faNumber(summary.total)}</b>
          </span>
          <span className="chip success">
            تایید شده <b>{faNumber(summary.confirmed)}</b>
          </span>
          <span className="chip danger">
            کنسل شده <b>{faNumber(summary.cancelled)}</b>
          </span>
          <span className="chip warning">
            در انتظار <b>{faNumber(summary.pending)}</b>
          </span>
          <Link href="/follow-ups/done" className="chip success">
            پیگیری انجام‌شده <b>{faNumber(summary.followUpDone ?? 0)}</b>
          </Link>
          <Link href="/follow-ups/not_done" className="chip warning">
            پیگیری انجام‌نشده <b>{faNumber(summary.followUpNotDone ?? 0)}</b>
          </Link>
        </div>
      ) : null}

      <Card bodyClassName="tight" title={null}>
        <div className="toolbar">
          <div className="btn-group">
            {['today', 'yesterday', 'week', 'all', 'custom'].map((mode) => (
              <button
                key={mode}
                type="button"
                className={filters.mode === mode ? 'active' : ''}
                onClick={() => applyMode(mode)}
              >
                {DATE_MODES[mode].label}
              </button>
            ))}
          </div>

          {filters.mode === 'custom' ? (
            <JalaliDateInput
              value={filters.date}
              onChange={(iso) => setFilters((current) => ({ ...current, date: iso, page: 1 }))}
              ariaLabel="انتخاب تاریخ شمسی"
              allowToday
            />
          ) : null}

          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="جست‌وجو: نام امدادخواه، امدادگر، شماره، شهر، آدرس…"
          />

          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">همه وضعیت‌ها</option>
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <select value={filters.followUp} onChange={(event) => updateFilter('followUp', event.target.value)}>
            <option value="">همه پیگیری‌ها</option>
            {FOLLOW_UPS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select value={filters.loadType} onChange={(event) => updateFilter('loadType', event.target.value)}>
            <option value="">همه نوع‌های بار</option>
            {LOAD_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.icon} {type.label}
              </option>
            ))}
          </select>

          <select value={filters.paid} onChange={(event) => updateFilter('paid', event.target.value)}>
            <option value="">همه پرداخت‌ها</option>
            <option value="true">پرداخت‌شده</option>
            <option value="false">پرداخت‌نشده</option>
          </select>

          <select value={filters.cityId} onChange={(event) => updateFilter('cityId', event.target.value)}>
            <option value="">همه شهرها</option>
            {zones.map((zone) => (
              <optgroup key={zone.id} label={zone.name}>
                {zone.cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <button type="button" className="btn btn-ghost btn-sm" onClick={refresh}>
            🔄 بازخوانی
          </button>
        </div>

        {error ? (
          <div className="banner danger" style={{ margin: 14 }}>
            {error}
            <button type="button" className="btn btn-outline btn-sm banner-action" onClick={refresh}>
              تلاش دوباره
            </button>
          </div>
        ) : null}

        {loading && !data ? (
          <Loader text="در حال دریافت بارها…" />
        ) : data?.items?.length ? (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>تاریخ</th>
                    <th>امدادخواه</th>
                    <th>شهر / محدوده</th>
                    <th>خودرو / مشکل</th>
                    <th>امدادگر</th>
                    <th>مبلغ / نوع بار</th>
                    <th>سهم امدادگر</th>
                    <th>وضعیت</th>
                    <th>پیگیری</th>
                    <th>ثبت‌کننده</th>
                    <th style={{ textAlign: 'left' }}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => {
                    const status = STATUS_MAP[item.status] || { tone: 'neutral', label: item.status };
                    const busy = busyId === item.id;
                    return (
                      <tr key={item.id}>
                        <td className="nowrap">
                          <span className="strong">{jalaliDateTimeLabel(item.createdAt)}</span>
                          <span className="sub">تاریخ بار: {faDate(item.loadDate)}</span>
                        </td>
                        <td className="customer-cell">
                          <span className="customer-name">{item.customerName}</span>
                          <a className="customer-phone" href={`tel:${item.customerPhone}`} dir="ltr">
                            {item.customerPhone}
                          </a>
                        </td>
                        <td>
                          <span className="strong">{item.cityName || '—'}</span>
                          <span className="sub">{item.zoneName || 'بدون محدوده'}</span>
                        </td>
                        <td>
                          <span className="strong">{item.vehicleName}</span>
                          <span className="sub">{item.carProblem}</span>
                        </td>
                        <td>
                          <span className="strong">{item.rescuerName || '—'}</span>
                          {item.address ? <span className="sub">{item.address}</span> : null}
                        </td>
                        <td className="money-cell">
                          <span className="strong" dir="ltr">
                            {formatAmount(item.amountReceived)}
                          </span>
                          <span className="sub">
                            {LOAD_TYPE_MAP[item.loadType]?.icon || ''} {item.loadTypeLabel}
                            {item.loadType === 'garage_dispatch'
                              ? item.garageDispatched
                                ? ' · اعزام شد'
                                : ' · اعزام نشد'
                              : ''}
                          </span>
                        </td>
                        <td className="money-cell">
                          <span className="strong" dir="ltr">
                            {formatAmount(item.commissionAmount)}
                          </span>
                          <span className="sub">{item.commissionRate}٪ سهم امدادگر</span>
                          <button
                            type="button"
                            className={`badge ${item.isPaid ? 'badge-success' : 'badge-warning'}`}
                            onClick={() => togglePayment(item)}
                            disabled={busy}
                            title="برای تغییر وضعیت پرداخت کلیک کنید"
                            style={{ cursor: 'pointer', marginTop: 4 }}
                          >
                            {item.isPaid ? '✅ پرداخت شد' : '⏳ پرداخت نشد'}
                          </button>
                        </td>
                        <td>
                          <Badge tone={status.tone}>
                            {item.status === 'confirmed' ? '✅' : item.status === 'cancelled' ? '⛔' : '⏳'}{' '}
                            {status.label}
                          </Badge>
                          {item.cancelReason ? <span className="sub">{item.cancelReason}</span> : null}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`badge ${item.followUp === 'done' ? 'badge-success' : 'badge-warning'}`}
                            title="برای تغییر وضعیت پیگیری کلیک کنید"
                            onClick={() => toggleFollowUp(item)}
                            disabled={busy || dayClosed}
                            style={{ cursor: dayClosed ? 'not-allowed' : 'pointer' }}
                          >
                            {item.followUp === 'done' ? '✅ پیگیری شد' : '⏳ پیگیری نشد'}
                          </button>
                        </td>
                        <td>
                          <span className="text-xs text-muted">{item.createdByUsername || '—'}</span>
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
                            {item.status !== 'confirmed' ? (
                              <button
                                type="button"
                                className="btn btn-icon"
                                title="تایید بار"
                                onClick={() => confirmLoad(item)}
                                disabled={busy || dayClosed}
                              >
                                ✅
                              </button>
                            ) : null}
                            {item.status !== 'cancelled' ? (
                              <button
                                type="button"
                                className="btn btn-icon"
                                title="کنسل کردن بار"
                                onClick={() => {
                                  setCancelTarget(item);
                                  setCancelReason('');
                                }}
                                disabled={busy || dayClosed}
                              >
                                ⛔
                              </button>
                            ) : null}
                            {isAdmin ? (
                              <button
                                type="button"
                                className="btn btn-icon"
                                title="حذف"
                                onClick={() => setDeleteTarget(item)}
                                disabled={busy || dayClosed}
                              >
                                🗑
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
            icon="🚗"
            title="باری برای این فیلترها پیدا نشد"
            description="تاریخ یا فیلترها را تغییر دهید یا اولین بار این روز را ثبت کنید."
            action={
              <button
                type="button"
                className="btn btn-primary btn-sm mt-12"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                ➕ ثبت بار جدید
              </button>
            }
          />
        )}
      </Card>

      <LoadFormModal
        open={formOpen}
        initial={editing}
        zones={zones}
        rescuers={rescuers}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <Modal
        open={Boolean(cancelTarget)}
        size="sm"
        title="کنسل کردن بار"
        subtitle={cancelTarget ? `${cancelTarget.customerName} — ${cancelTarget.vehicleName}` : ''}
        onClose={() => setCancelTarget(null)}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setCancelTarget(null)}>
              انصراف
            </button>
            <button type="button" className="btn btn-danger" onClick={submitCancel} disabled={busyAction}>
              {busyAction ? <span className="spinner light" /> : null}
              ثبت کنسلی
            </button>
          </>
        }
      >
        <Field label="دلیل کنسلی" required hint="این دلیل در گزارش‌های آماری نمایش داده می‌شود.">
          <textarea
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="مثلاً لغو توسط امدادخواه"
            style={{ minHeight: 70 }}
          />
        </Field>
        <div className="chip-row mt-12">
          {CANCEL_REASON_SUGGESTIONS.slice(0, 5).map((reason) => (
            <button
              key={reason}
              type="button"
              className="chip"
              onClick={() => setCancelReason(reason)}
              style={{ cursor: 'pointer' }}
            >
              {reason}
            </button>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف بار"
        description={
          deleteTarget
            ? `آیا از حذف بار «${deleteTarget.customerName}» در تاریخ ${faDate(deleteTarget.loadDate)} مطمئن هستید؟ این عمل قابل بازگشت نیست.`
            : ''
        }
        confirmText="حذف بار"
        onConfirm={removeLoad}
        onClose={() => setDeleteTarget(null)}
        busy={busyAction}
      />
    </>
  );
}
