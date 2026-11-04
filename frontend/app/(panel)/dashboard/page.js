'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { addDaysISO, faDateWithWeekday, faNumber, faPercent, todayISO } from '@/lib/format';
import { WORK_TYPE_MAP } from '@/lib/constants';
import { formatAmount } from '@/lib/money';
import {
  BarList,
  Card,
  EmptyState,
  Loader,
  RankList,
  StatCard,
  TrendChart,
} from '@/components/ui';

function StatLink({ href, children }) {
  return (
    <Link href={href} className="stat-link" title="مشاهده‌ی جزئیات">
      {children}
    </Link>
  );
}

const RANGES = [
  { label: 'امروز', days: 0 },
  { label: '۷ روز', days: 6 },
  { label: '۳۰ روز', days: 29 },
  { label: '۹۰ روز', days: 89 },
];

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const [rangeDays, setRangeDays] = useState(29);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rescuerTab, setRescuerTab] = useState('confirmed');

  const range = useMemo(() => {
    const to = todayISO();
    return { from: addDaysISO(to, -rangeDays), to };
  }, [rangeDays]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/stats/overview', range);
      setData(response);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.totals;
  const today = data?.today;
  const followUpTotal = (totals?.followUpDone || 0) + (totals?.followUpNotDone || 0);

  const cityBars = (data?.cities || []).slice(0, 8).map((city) => ({
    key: city.id,
    label: city.name,
    tag: city.zoneName,
    value: city.total,
    suffix: `تایید ${faNumber(city.confirmed)} · کنسل ${faNumber(city.cancelled)}`,
  }));

  const zoneBars = (data?.zones || []).map((zone) => ({
    key: zone.id,
    label: zone.name,
    value: zone.total,
    suffix: `تایید ${faNumber(zone.confirmed)} · کنسل ${faNumber(zone.cancelled)}`,
  }));

  const cancelBars = (data?.cancelReasons || []).slice(0, 7).map((item) => ({
    key: item.reason,
    label: item.reason,
    value: item.total,
  }));

  const problemBars = (data?.problems || []).slice(0, 7).map((item) => ({
    key: item.problem,
    label: item.problem,
    value: item.total,
  }));

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            سلام {user?.firstName} 👋
          </h1>
          <p className="page-description">
            نمای کلی عملکرد بارها در بازه‌ی انتخاب‌شده — {faDateWithWeekday(todayISO())}
          </p>
        </div>
        <div className="page-actions">
          <div className="btn-group">
            {RANGES.map((item) => (
              <button
                key={item.days}
                type="button"
                className={rangeDays === item.days ? 'active' : ''}
                onClick={() => setRangeDays(item.days)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Link href="/loads" className="btn btn-primary">
            ➕ ثبت بار جدید
          </Link>
        </div>
      </div>

      {error ? (
        <div className="banner danger">
          {error}
          <button type="button" className="btn btn-outline btn-sm banner-action" onClick={load}>
            تلاش دوباره
          </button>
        </div>
      ) : null}

      {loading && !data ? (
        <Loader text="در حال محاسبه آمار…" />
      ) : null}

      {data ? (
        <>
          <div className="stat-grid">
            <StatLink href="/loads?mode=range">
              <StatCard
                label="کل بارهای بازه"
                value={totals.loads}
                icon="🚗"
                tone="brand"
                foot={`${faDateWithWeekday(data.range.from)} تا ${faDateWithWeekday(data.range.to)}`}
              />
            </StatLink>
            <StatLink href="/loads?status=confirmed&mode=range">
              <StatCard
                label="تایید شده"
                value={totals.confirmed}
                icon="✅"
                tone="success"
                foot={`${faPercent(totals.confirmationRate)} از کل بارها — مشاهده‌ی جزئیات`}
              />
            </StatLink>
            <StatLink href="/loads?status=cancelled&mode=range">
              <StatCard
                label="کنسل شده"
                value={totals.cancelled}
                icon="⛔"
                tone="danger"
                foot={`${faPercent(totals.cancellationRate)} نرخ کنسلی — دلایل کنسلی`}
              />
            </StatLink>
            <StatLink href="/loads?status=pending&mode=range">
              <StatCard
                label="در انتظار بررسی"
                value={totals.pending}
                icon="⏳"
                tone="warning"
                foot={`${faPercent(totals.pendingRate)} از کل بارها — مشاهده‌ی فهرست`}
              />
            </StatLink>
            <StatLink href="/loads?mode=today">
              <StatCard
                label="بارهای امروز"
                value={today.total}
                icon="📅"
                tone="teal"
                foot={`تایید ${faNumber(today.confirmed)} · کنسل ${faNumber(today.cancelled)}`}
              />
            </StatLink>
            <StatLink href="/loads?paid=false">
              <StatCard
                label="مانده سهم خودرو چاره"
                value={formatAmount(data.finance?.unpaid ?? 0)}
                icon="⏳"
                tone="danger"
                foot={`${faNumber(data.finance?.unpaidLoads ?? 0)} بار تسویه‌نشده — مشاهده‌ی فهرست`}
              />
            </StatLink>
            <StatLink href="/loads?paid=true">
              <StatCard
                label="سهم خودرو چاره‌ی پرداخت‌شده"
                value={formatAmount(data.finance?.paid ?? 0)}
                icon="✅"
                tone="success"
                foot={`${faNumber(data.finance?.paidLoads ?? 0)} بار تسویه‌شده`}
              />
            </StatLink>
            <StatLink href="/reports">
              <StatCard
                label="مبلغ کل دریافتی"
                value={formatAmount(data.finance?.received ?? 0)}
                icon="💵"
                tone="teal"
                foot={`سهم خودرو چاره: ${formatAmount(data.finance?.commission ?? 0)} تومان`}
              />
            </StatLink>
            <StatLink href="/rescuers">
              <StatCard
                label="امدادگران فعال"
                value={data.counts.rescuers.active}
                icon="🧰"
                tone="purple"
                foot={`از ${faNumber(data.counts.rescuers.total)} امدادگر · ${faNumber(
                  data.counts.rescuers.garages
                )} تعمیرگاهی`}
              />
            </StatLink>
          </div>

          <div className="grid grid-sidebar section-gap">
            <Card
              title="روند روزانه بارها"
              hint={`${faNumber(totals.loads)} بار در ${faNumber(data.trend.length)} روز`}
              action={
                <div className="chip-row">
                  <span className="chip success">
                    تایید <b>{faNumber(totals.confirmed)}</b>
                  </span>
                  <span className="chip danger">
                    کنسل <b>{faNumber(totals.cancelled)}</b>
                  </span>
                  <span className="chip">
                    در انتظار <b>{faNumber(totals.pending)}</b>
                  </span>
                </div>
              }
            >
              <TrendChart data={data.trend} />
            </Card>

            <Card title="وضعیت پیگیری" hint="برای دیدن فهرست بارها روی هر ردیف کلیک کنید">
              <div className="bar-list">
                <Link href="/follow-ups/done" className="flex-between follow-link">
                  <span className="text-sm">✅ پیگیری انجام شد — مشاهده‌ی فهرست</span>
                  <span className="badge badge-success">{faNumber(totals.followUpDone)}</span>
                </Link>
                <div className="bar-track">
                  <div
                    className="bar-fill success"
                    style={{
                      width: `${followUpTotal ? Math.round((totals.followUpDone / followUpTotal) * 100) : 0}%`,
                    }}
                  />
                </div>
                <Link href="/follow-ups/not_done" className="flex-between mt-12 follow-link">
                  <span className="text-sm">⏳ پیگیری انجام نشد — مشاهده‌ی فهرست</span>
                  <span className="badge badge-warning">{faNumber(totals.followUpNotDone)}</span>
                </Link>
                <div className="bar-track">
                  <div
                    className="bar-fill warning"
                    style={{
                      width: `${
                        followUpTotal ? Math.round((totals.followUpNotDone / followUpTotal) * 100) : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="divider" />

              <div className="flex-between">
                <span className="text-sm text-muted">نرخ تایید کل</span>
                <span className="badge badge-brand">{faPercent(totals.confirmationRate)}</span>
              </div>
              <div className="flex-between mt-12">
                <span className="text-sm text-muted">نرخ کنسلی کل</span>
                <span className="badge badge-danger">{faPercent(totals.cancellationRate)}</span>
              </div>
              <div className="flex-between mt-12">
                <span className="text-sm text-muted">اپراتورهای فعال</span>
                <span className="badge badge-neutral">
                  {faNumber(data.counts.operators.active)} از {faNumber(data.counts.operators.total)}
                </span>
              </div>
            </Card>
          </div>

          <div className="grid grid-2 section-gap">
            <Card title="بیشترین بار به تفکیک شهر" hint="شهرهایی که بیشترین درخواست را داشته‌اند">
              <BarList items={cityBars} valueLabel="بار" emptyText="در این بازه باری ثبت نشده است." />
            </Card>
            <Card title="بیشترین بار به تفکیک محدوده" hint="محدوده‌های فعال در بازه‌ی انتخابی">
              <BarList
                items={zoneBars}
                tone="purple"
                valueLabel="بار"
                emptyText="در این بازه باری ثبت نشده است."
              />
            </Card>
          </div>

          <div className="grid grid-3 section-gap">
            <Card
              title="امدادگران برتر"
              hint="بر اساس تایید یا کنسلی"
              action={
                <div className="btn-group">
                  <button
                    type="button"
                    className={rescuerTab === 'confirmed' ? 'active' : ''}
                    onClick={() => setRescuerTab('confirmed')}
                  >
                    بیشترین تایید
                  </button>
                  <button
                    type="button"
                    className={rescuerTab === 'cancelled' ? 'active' : ''}
                    onClick={() => setRescuerTab('cancelled')}
                  >
                    بیشترین کنسلی
                  </button>
                </div>
              }
            >
              <RankList
                items={
                  (data.topRescuers?.[rescuerTab] || []).filter((item) =>
                    rescuerTab === 'confirmed' ? item.confirmed > 0 : item.cancelled > 0
                  )
                }
                valueKey={rescuerTab}
                label={rescuerTab === 'confirmed' ? 'تایید' : 'کنسل'}
                emptyText="داده‌ای برای این بخش وجود ندارد."
              />
            </Card>

            <Card title="دلایل کنسلی" hint="پرتکرارترین دلایل ثبت‌شده">
              {cancelBars.length ? (
                <BarList items={cancelBars} tone="danger" valueLabel="مورد" />
              ) : (
                <EmptyState icon="🎉" title="کنسلی ثبت نشده" description="در این بازه هیچ باری کنسل نشده است." />
              )}
            </Card>

            <Card title="پرتکرارترین مشکلات خودرو" hint="بر اساس شرح مشکل امدادخواه">
              {problemBars.length ? (
                <BarList items={problemBars} tone="warning" valueLabel="مورد" />
              ) : (
                <EmptyState icon="🛠️" title="موردی ثبت نشده" />
              )}
            </Card>
          </div>

          <div className="grid grid-2 section-gap">
            <Card title="ترکیب نوع خدمت امدادگران" hint="تعداد امدادگر و بارهای انجام‌شده">
              <BarList
                items={(data.workTypes || []).map((item) => ({
                  key: item.workType,
                  label: `${WORK_TYPE_MAP[item.workType]?.icon || ''} ${
                    WORK_TYPE_MAP[item.workType]?.label || item.workType
                  }`,
                  value: item.rescuers,
                  suffix: `${faNumber(item.loads)} بار`,
                }))}
                tone="teal"
                valueLabel="امدادگر"
              />
            </Card>

            <Card
              title="دسترسی سریع"
              hint={isAdmin ? 'امکانات مدیریتی شما' : 'امکانات روزمره‌ی اپراتور'}
            >
              <div className="grid grid-2" style={{ gap: 10 }}>
                <Link href="/loads" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                  🚗 فهرست و ثبت بارها
                </Link>
                <Link href="/rescuers" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                  🧰 مدیریت امدادگران
                </Link>
                {isAdmin ? (
                  <>
                    <Link href="/operators" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                      👥 ساخت و مدیریت اپراتور
                    </Link>
                    <Link href="/reports" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                      📈 گزارش کامل بارها
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/follow-ups/done" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                      ✅ پیگیری‌های انجام‌شده
                    </Link>
                    <Link href="/follow-ups/not_done" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                      ⏳ پیگیری‌های انجام‌نشده
                    </Link>
                    <Link href="/loads?status=pending" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                      ⏳ بارهای در انتظار
                    </Link>
                    <Link href="/loads#today" className="btn btn-outline" style={{ justifyContent: 'flex-start' }}>
                      📅 بارهای امروز
                    </Link>
                  </>
                )}
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </>
  );
}
