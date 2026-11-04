'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { api, downloadExport } from '@/lib/api';
import { WORK_TYPE_MAP } from '@/lib/constants';
import { addDaysISO, faDate, faNumber, faPercent, todayISO } from '@/lib/format';
import {
  BarList,
  Card,
  EmptyState,
  Loader,
  RateBar,
  StatCard,
  TrendChart,
} from '@/components/ui';
import JalaliDateInput from '@/components/JalaliDateInput';

const PRESETS = [
  { label: 'امروز', days: 0 },
  { label: '۷ روز', days: 6 },
  { label: '۳۰ روز', days: 29 },
  { label: '۹۰ روز', days: 89 },
];

const TABS = [
  { key: 'summary', label: 'خلاصه' },
  { key: 'regions', label: 'شهرها و محدوده‌ها' },
  { key: 'rescuers', label: 'امدادگران' },
  { key: 'operators', label: 'اپراتورها' },
  { key: 'cancellations', label: 'کنسلی‌ها و مشکلات' },
];

export default function ReportsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [from, setFrom] = useState(addDaysISO(todayISO(), -29));
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('summary');

  const range = useMemo(() => ({ from, to }), [from, to]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/stats/detailed', range);
      setData(response);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, range]);

  useEffect(() => {
    load();
  }, [load]);

  const applyPreset = (days) => {
    const end = todayISO();
    setFrom(addDaysISO(end, -days));
    setTo(end);
  };

  const exportCsv = async () => {
    try {
      await downloadExport('/loads/export', range, `report-${from}_${to}.csv`);
      toast.success('خروجی CSV دانلود شد.');
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  if (!isAdmin) {
    return <div className="banner danger">⛔ این گزارش‌ها فقط برای مدیر سیستم قابل مشاهده است.</div>;
  }

  const totals = data?.totals;
  const followUpTotal = (totals?.followUpDone || 0) + (totals?.followUpNotDone || 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">گزارش‌های کامل</h1>
          <p className="page-description">
            آمار تفصیلی بارها، شهرها، امدادگران، اپراتورها و دلایل کنسلی — بازه‌ی{' '}
            {faDate(from)} تا {faDate(to)}
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-outline" onClick={() => window.print()}>
            🖨 چاپ
          </button>
          <button type="button" className="btn btn-outline" onClick={exportCsv}>
            ⬇️ خروجی CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={load} disabled={loading}>
            🔄 به‌روزرسانی
          </button>
        </div>
      </div>

      <Card>
        <div className="toolbar" style={{ borderBottom: 0 }}>
          <div className="btn-group">
            {PRESETS.map((preset) => (
              <button key={preset.days} type="button" onClick={() => applyPreset(preset.days)}>
                {preset.label}
              </button>
            ))}
          </div>
          <span className="filter-label">از تاریخ</span>
          <JalaliDateInput value={from} onChange={setFrom} ariaLabel="از تاریخ شمسی" />
          <span className="filter-label">تا تاریخ</span>
          <JalaliDateInput value={to} onChange={setTo} ariaLabel="تا تاریخ شمسی" allowToday />
          <div className="toolbar-spacer" />
          {data?.range ? (
            <span className="chip">
              بازه‌ی گزارش: <b>{faNumber(data.trend.length)}</b> روز
            </span>
          ) : null}
        </div>
      </Card>

      {error ? (
        <div className="banner danger mt-18">
          {error}
          <button type="button" className="btn btn-outline btn-sm banner-action" onClick={load}>
            تلاش دوباره
          </button>
        </div>
      ) : null}

      {loading && !data ? <Loader text="در حال محاسبه گزارش…" /> : null}

      {data ? (
        <>
          <div className="stat-grid section-gap">
            <StatCard
              label="کل بارها در بازه"
              value={totals.loads}
              icon="🚗"
              tone="brand"
              foot={`از ابتدای سامانه: ${faNumber(data.counts.allLoads)} بار`}
            />
            <StatCard
              label="تایید شده"
              value={totals.confirmed}
              icon="✅"
              tone="success"
              foot={`نرخ تایید ${faPercent(totals.confirmationRate)}`}
            />
            <StatCard
              label="کنسل شده"
              value={totals.cancelled}
              icon="⛔"
              tone="danger"
              foot={`نرخ کنسلی ${faPercent(totals.cancellationRate)}`}
            />
            <StatCard
              label="در انتظار"
              value={totals.pending}
              icon="⏳"
              tone="warning"
              foot={`نرخ انتظار ${faPercent(totals.pendingRate)}`}
            />
            <StatCard
              label="پیگیری انجام‌شده"
              value={totals.followUpDone}
              icon="📞"
              tone="teal"
              foot={`${faPercent(followUpTotal ? (totals.followUpDone / followUpTotal) * 100 : 0)} از کل بارها`}
            />
            <StatCard
              label="امدادگران"
              value={data.counts.rescuers.total}
              icon="🧰"
              tone="purple"
              foot={`${faNumber(data.counts.rescuers.active)} فعال · ${faNumber(
                data.counts.rescuers.garages
              )} تعمیرگاهی`}
            />
            <StatCard
              label="اپراتورها"
              value={data.counts.operators.total}
              icon="🎧"
              tone="brand"
              foot={`${faNumber(data.counts.operators.active)} اپراتور فعال`}
            />
            <StatCard
              label="بارهای امروز"
              value={data.today.total}
              icon="📅"
              tone="teal"
              foot={`✅ ${faNumber(data.today.confirmed)} · ⛔ ${faNumber(data.today.cancelled)}`}
            />
          </div>

          <div className="card section-gap" style={{ overflow: 'hidden' }}>
            <div className="tab-row">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`tab ${tab === item.key ? 'active' : ''}`}
                  onClick={() => setTab(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="card-body">
              {tab === 'summary' ? (
                <div className="grid grid-sidebar">
                  <div>
                    <h3 className="card-title" style={{ marginBottom: 12 }}>
                      <span className="dot" /> روند روزانه بارها
                    </h3>
                    <TrendChart data={data.trend} />
                    <div className="divider" />
                    <h3 className="card-title" style={{ marginBottom: 12 }}>
                      <span className="dot" /> روند ماهانه
                    </h3>
                    <BarList
                      items={(data.monthlyTrend || []).map((month) => ({
                        key: month.month,
                        label: month.month,
                        value: month.total,
                        suffix: `✅ ${faNumber(month.confirmed)} · ⛔ ${faNumber(month.cancelled)}`,
                      }))}
                      valueLabel="بار"
                    />
                  </div>
                  <div>
                    <h3 className="card-title" style={{ marginBottom: 12 }}>
                      <span className="dot" /> ترکیب وضعیت بارها
                    </h3>
                    <div className="bar-list">
                      <div className="flex-between">
                        <span className="text-sm">تایید شده</span>
                        <span className="badge badge-success">{faNumber(totals.confirmed)}</span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill success" style={{ width: `${totals.confirmationRate}%` }} />
                      </div>
                      <div className="flex-between mt-12">
                        <span className="text-sm">کنسل شده</span>
                        <span className="badge badge-danger">{faNumber(totals.cancelled)}</span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill danger" style={{ width: `${totals.cancellationRate}%` }} />
                      </div>
                      <div className="flex-between mt-12">
                        <span className="text-sm">در انتظار</span>
                        <span className="badge badge-warning">{faNumber(totals.pending)}</span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill warning" style={{ width: `${totals.pendingRate}%` }} />
                      </div>
                    </div>

                    <div className="divider" />

                    <h3 className="card-title" style={{ marginBottom: 12 }}>
                      <span className="dot" /> نوع خدمت امدادگران
                    </h3>
                    <BarList
                      items={(data.workTypes || []).map((item) => ({
                        key: item.workType,
                        label: `${WORK_TYPE_MAP[item.workType]?.icon || ''} ${
                          WORK_TYPE_MAP[item.workType]?.label || item.workType
                        }`,
                        value: item.rescuers,
                        suffix: `${faNumber(item.loads)} بار`,
                      }))}
                      tone="purple"
                      valueLabel="نفر"
                    />

                    <div className="divider" />

                    <h3 className="card-title" style={{ marginBottom: 12 }}>
                      <span className="dot" /> پیگیری‌ها
                    </h3>
                    <div className="flex-between">
                      <span className="text-sm">انجام‌شده</span>
                      <span className="badge badge-success">{faNumber(totals.followUpDone)}</span>
                    </div>
                    <div className="flex-between mt-12">
                      <span className="text-sm">انجام‌نشده</span>
                      <span className="badge badge-warning">{faNumber(totals.followUpNotDone)}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {tab === 'regions' ? (
                <div className="grid grid-2">
                  <div>
                    <h3 className="card-title" style={{ marginBottom: 12 }}>
                      <span className="dot" /> آمار محدوده‌ها
                    </h3>
                    <div className="table-wrap">
                      <table className="data" style={{ minWidth: 420 }}>
                        <thead>
                          <tr>
                            <th>محدوده</th>
                            <th>کل</th>
                            <th>تایید</th>
                            <th>کنسل</th>
                            <th>نرخ کنسلی</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.zones || []).map((zone) => (
                            <tr key={zone.id}>
                              <td className="strong">{zone.name}</td>
                              <td className="num">{faNumber(zone.total)}</td>
                              <td className="num" style={{ color: 'var(--success)' }}>
                                {faNumber(zone.confirmed)}
                              </td>
                              <td className="num" style={{ color: 'var(--danger)' }}>
                                {faNumber(zone.cancelled)}
                              </td>
                              <td style={{ minWidth: 120 }}>
                                <RateBar
                                  value={zone.total ? (zone.cancelled / zone.total) * 100 : 0}
                                  tone="danger"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="card-title" style={{ marginBottom: 12 }}>
                      <span className="dot" /> آمار شهرها
                    </h3>
                    <div className="table-wrap">
                      <table className="data" style={{ minWidth: 420 }}>
                        <thead>
                          <tr>
                            <th>شهر</th>
                            <th>محدوده</th>
                            <th>کل</th>
                            <th>تایید</th>
                            <th>کنسل</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.cities || []).map((city) => (
                            <tr key={city.id}>
                              <td className="strong">{city.name}</td>
                              <td className="text-xs text-muted">{city.zoneName || '—'}</td>
                              <td className="num">{faNumber(city.total)}</td>
                              <td className="num" style={{ color: 'var(--success)' }}>
                                {faNumber(city.confirmed)}
                              </td>
                              <td className="num" style={{ color: 'var(--danger)' }}>
                                {faNumber(city.cancelled)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}

              {tab === 'rescuers' ? (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>امدادگر</th>
                        <th>نوع کار</th>
                        <th>شهر / محدوده</th>
                        <th>کل بار</th>
                        <th>تایید</th>
                        <th>کنسل</th>
                        <th>نرخ کنسلی</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.rescuers || []).map((rescuer) => (
                        <tr key={rescuer.id}>
                          <td className="strong">{rescuer.fullName}</td>
                          <td>
                            {WORK_TYPE_MAP[rescuer.workType]?.icon} {WORK_TYPE_MAP[rescuer.workType]?.label}
                          </td>
                          <td className="text-xs text-muted">
                            {[rescuer.cityName, rescuer.zoneName].filter(Boolean).join(' / ') || '—'}
                          </td>
                          <td className="num">{faNumber(rescuer.total)}</td>
                          <td className="num" style={{ color: 'var(--success)' }}>
                            {faNumber(rescuer.confirmed)}
                          </td>
                          <td className="num" style={{ color: 'var(--danger)' }}>
                            {faNumber(rescuer.cancelled)}
                          </td>
                          <td style={{ minWidth: 120 }}>
                            <RateBar value={rescuer.cancellationRate} tone="danger" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!(data.rescuers || []).length ? <EmptyState icon="🧰" title="در این بازه باری به امدادگران تخصیص نیافته است." /> : null}
                </div>
              ) : null}

              {tab === 'operators' ? (
                <div className="table-wrap">
                  <table className="data" style={{ minWidth: 640 }}>
                    <thead>
                      <tr>
                        <th>اپراتور</th>
                        <th>نام کاربری</th>
                        <th>وضعیت</th>
                        <th>بارهای ثبت‌شده</th>
                        <th>تایید</th>
                        <th>کنسل</th>
                        <th>در انتظار</th>
                        <th>نرخ تایید</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.operators || []).map((operator) => (
                        <tr key={operator.id}>
                          <td className="strong">{operator.fullName}</td>
                          <td dir="ltr" className="text-xs">
                            {operator.username}
                          </td>
                          <td>
                            <span className={`badge ${operator.isActive ? 'badge-success' : 'badge-neutral'}`}>
                              {operator.isActive ? 'فعال' : 'غیرفعال'}
                            </span>
                          </td>
                          <td className="num">{faNumber(operator.total)}</td>
                          <td className="num" style={{ color: 'var(--success)' }}>
                            {faNumber(operator.confirmed)}
                          </td>
                          <td className="num" style={{ color: 'var(--danger)' }}>
                            {faNumber(operator.cancelled)}
                          </td>
                          <td className="num">{faNumber(operator.pending)}</td>
                          <td style={{ minWidth: 120 }}>
                            <RateBar value={operator.confirmationRate} tone="success" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {tab === 'cancellations' ? (
                <div className="grid grid-2">
                  <div>
                    <h3 className="card-title" style={{ marginBottom: 12 }}>
                      <span className="dot" /> دلایل کنسلی بارها
                    </h3>
                    {(data.cancelReasons || []).length ? (
                      <BarList
                        items={(data.cancelReasons || []).map((item) => ({
                          key: item.reason,
                          label: item.reason,
                          value: item.total,
                        }))}
                        tone="danger"
                        valueLabel="مورد"
                      />
                    ) : (
                      <EmptyState icon="🎉" title="در این بازه کنسلی ثبت نشده است." />
                    )}
                  </div>
                  <div>
                    <h3 className="card-title" style={{ marginBottom: 12 }}>
                      <span className="dot" /> پرتکرارترین مشکلات خودرو
                    </h3>
                    {(data.problems || []).length ? (
                      <BarList
                        items={(data.problems || []).map((item) => ({
                          key: item.problem,
                          label: item.problem,
                          value: item.total,
                        }))}
                        tone="warning"
                        valueLabel="مورد"
                      />
                    ) : (
                      <EmptyState icon="🛠️" title="موردی ثبت نشده است." />
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
