'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import { api } from '@/lib/api';
import { STATUS_MAP } from '@/lib/constants';
import { faDate, faNumber, todayISO } from '@/lib/format';
import { jalaliDateTimeLabel } from '@/lib/jalali';
import { formatAmount } from '@/lib/money';
import { Card, EmptyState, Loader, Pagination, SearchInput } from '@/components/ui';
import JalaliDateInput from '@/components/JalaliDateInput';

const MODES = {
  done: {
    title: 'پیگیری‌های انجام‌شده',
    icon: '✅',
    tone: 'success',
    description: 'همه‌ی بارهایی که با امدادخواه تماس گرفته و نتیجه ثبت شده است.',
  },
  not_done: {
    title: 'پیگیری‌های انجام‌نشده',
    icon: '⏳',
    tone: 'warning',
    description: 'بارهایی که هنوز پیگیری نشده‌اند؛ برای بستن کار، تماس و نتیجه را ثبت کنید.',
  },
};

export default function FollowUpDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();

  const state = params?.state === 'done' ? 'done' : 'not_done';
  const meta = MODES[state];

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ q: '', date: '', page: 1, limit: 20 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [globalSummary, setGlobalSummary] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) =>
        current.q === searchInput ? current : { ...current, q: searchInput, page: 1 }
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo(
    () => ({
      followUp: state,
      q: filters.q || undefined,
      date: filters.date || undefined,
      page: filters.page,
      limit: filters.limit,
    }),
    [state, filters]
  );

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

  // شمارش کل (بدون فیلتر پیگیری) برای نوار خلاصه
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await api.get('/loads', { limit: 1 });
        if (active) setGlobalSummary(response.summary || null);
      } catch {
        /* بی‌صدا: نوار خلاصه اختیاری است */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const togglePayment = async (item) => {
    setBusyId(item.id);
    try {
      const response = await api.patch(`/loads/${item.id}/payment`, { isPaid: !item.isPaid });
      toast.success(response.message || 'وضعیت پرداخت تغییر کرد.');
      load();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggle = async (item) => {
    setBusyId(item.id);
    try {
      const next = item.followUp === 'done' ? 'not_done' : 'done';
      const response = await api.patch(`/loads/${item.id}/follow-up`, { followUp: next });
      toast.success(response.message || 'وضعیت پیگیری تغییر کرد.');
      load();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusyId(null);
    }
  };

  const summary = data?.summary;
  const items = data?.items || [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {meta.icon} {meta.title}
          </h1>
          <p className="page-description">{meta.description}</p>
        </div>
        <div className="page-actions">
          <div className="btn-group">
            <button
              type="button"
              className={state === 'done' ? 'active' : ''}
              onClick={() => router.push('/follow-ups/done')}
            >
              ✅ انجام‌شده
            </button>
            <button
              type="button"
              className={state === 'not_done' ? 'active' : ''}
              onClick={() => router.push('/follow-ups/not_done')}
            >
              ⏳ انجام‌نشده
            </button>
          </div>
          <Link href="/dashboard" className="btn btn-outline">
            ← داشبورد
          </Link>
        </div>
      </div>

      <div className="chip-row" style={{ marginBottom: 14 }}>
        <span className="chip success">
          کل پیگیری انجام‌شده <b>{faNumber(globalSummary?.followUpDone ?? 0)}</b>
        </span>
        <span className="chip warning">
          کل پیگیری انجام‌نشده <b>{faNumber(globalSummary?.followUpNotDone ?? 0)}</b>
        </span>
        <span className="chip">
          نتیجه‌ی این فیلتر <b>{faNumber(summary?.total ?? 0)}</b> بار
        </span>
        <span className="chip danger">
          کنسل‌شده در این فهرست <b>{faNumber(summary?.cancelled ?? 0)}</b>
        </span>
      </div>

      <Card bodyClassName="tight">
        <div className="toolbar">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="جست‌وجو: نام یا شماره امدادخواه، خودرو، امدادگر، شهر، آدرس…"
          />
          <JalaliDateInput
            value={filters.date}
            onChange={(iso) => setFilters((current) => ({ ...current, date: iso, page: 1 }))}
            ariaLabel="فیلتر تاریخ شمسی"
            allowToday
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setFilters({ q: '', date: '', page: 1, limit: 20 })}
          >
            پاک‌کردن فیلترها
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setFilters((c) => ({ ...c, date: todayISO(), page: 1 }))}
          >
            امروز
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={load}>
            🔄 بازخوانی
          </button>
        </div>

        {error ? (
          <div className="banner danger" style={{ margin: 14 }}>
            {error}
            <button type="button" className="btn btn-outline btn-sm banner-action" onClick={load}>
              تلاش دوباره
            </button>
          </div>
        ) : null}

        {loading && !data ? (
          <Loader text="در حال دریافت بارها…" />
        ) : items.length ? (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>تاریخ و ساعت</th>
                    <th>امدادخواه</th>
                    <th>خودرو / مشکل</th>
                    <th>امدادگر</th>
                    <th>شهر / محدوده</th>
                    <th>آدرس و توضیحات</th>
                    <th>مبلغ / سهم امدادگر</th>
                    <th>پرداخت</th>
                    <th>وضعیت بار</th>
                    <th>پیگیری</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const status = STATUS_MAP[item.status] || { tone: 'neutral', label: item.status };
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
                          <span className="strong">{item.vehicleName}</span>
                          <span className="sub">{item.carProblem}</span>
                        </td>
                        <td>
                          <span className="strong">{item.rescuerName || '—'}</span>
                          <span className="sub">ثبت: {item.createdByUsername || '—'}</span>
                        </td>
                        <td>
                          <span className="strong">{item.cityName || '—'}</span>
                          <span className="sub">{item.zoneName || 'بدون محدوده'}</span>
                        </td>
                        <td className="wrap-cell">
                          <span className="text-sm">{item.address || '—'}</span>
                          {item.description ? (
                            <span className="sub">{item.description}</span>
                          ) : null}
                        </td>
                        <td className="money-cell">
                          <span className="strong" dir="ltr">{formatAmount(item.amountReceived)}</span>
                          <span className="sub">
                            {item.commissionRate}٪ = {formatAmount(item.commissionAmount)}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`badge ${item.isPaid ? 'badge-success' : 'badge-warning'}`}
                            onClick={() => togglePayment(item)}
                            disabled={busyId === item.id}
                            title="برای تغییر وضعیت پرداخت کلیک کنید"
                          >
                            {item.isPaid ? '✅ پرداخت شد' : '⏳ پرداخت نشد'}
                          </button>
                        </td>
                        <td>
                          <span className={`badge badge-${status.tone}`}>{status.label}</span>
                          {item.cancelReason ? <span className="sub">{item.cancelReason}</span> : null}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`badge ${item.followUp === 'done' ? 'badge-success' : 'badge-warning'}`}
                            onClick={() => toggle(item)}
                            disabled={busyId === item.id || item.dayClosed}
                            title={
                              item.dayClosed
                                ? 'این روز بسته شده است؛ برای تغییر، روز را بازگشایی کنید.'
                                : 'برای تغییر وضعیت پیگیری کلیک کنید'
                            }
                          >
                            {item.followUp === 'done' ? '✅ انجام شد' : '⏳ انجام نشد'}
                          </button>
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
            icon={meta.icon}
            title={`هیچ بار «${meta.title}» با این فیلترها پیدا نشد`}
            description="فیلتر تاریخ یا عبارت جست‌وجو را تغییر دهید."
            action={
              <Link href="/loads" className="btn btn-outline btn-sm mt-12">
                رفتن به فهرست بارها
              </Link>
            }
          />
        )}
      </Card>
    </>
  );
}
