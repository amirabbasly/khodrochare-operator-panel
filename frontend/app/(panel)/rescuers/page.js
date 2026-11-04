'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { api } from '@/lib/api';
import { WORK_TYPES, WORK_TYPE_MAP } from '@/lib/constants';
import { faDate, faDateShort, faNumber, initials } from '@/lib/format';
import RescuerFormModal from '@/components/RescuerFormModal';
import {
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  Loader,
  Modal,
  Pagination,
  SearchInput,
  StatCard,
} from '@/components/ui';

export default function RescuersPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [filters, setFilters] = useState({
    q: '',
    zoneId: '',
    workType: '',
    isActive: '',
    sort: 'name',
    order: 'asc',
    page: 1,
    limit: 20,
  });
  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState(null);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => (current.q === searchInput ? current : { ...current, q: searchInput, page: 1 }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await api.get('/meta/zones');
        if (active) setZones(response.items || []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const query = useMemo(
    () => ({
      q: filters.q || undefined,
      zoneId: filters.zoneId || undefined,
      workType: filters.workType || undefined,
      isActive: filters.isActive || undefined,
      sort: filters.sort,
      order: filters.order,
      page: filters.page,
      limit: filters.limit,
    }),
    [filters]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/rescuers', query);
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

  const openDetails = async (rescuer) => {
    setDetails({ ...rescuer, recentLoads: [] });
    setDetailsLoading(true);
    try {
      const response = await api.get(`/rescuers/${rescuer.id}`);
      setDetails({ ...response.item, recentLoads: response.recentLoads || [] });
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const removeRescuer = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const response = await api.delete(`/rescuers/${deleteTarget.id}`);
      toast.success(response.message || 'امدادگر حذف شد.');
      setDeleteTarget(null);
      load();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const summary = data?.summary;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">امدادگران</h1>
          <p className="page-description">
            اطلاعات خودرو، محدوده‌ی فعالیت و نوع خدمت امدادگران — جست‌وجو با نام، شهر یا پلاک
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
            ➕ ثبت امدادگر جدید
          </button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <StatCard label="کل امدادگران" value={summary?.total ?? 0} icon="🧰" tone="brand" />
        <StatCard label="امدادگران فعال" value={summary?.active ?? 0} icon="✅" tone="success" />
        <StatCard
          label="تعمیرگاهی (امتیاز ویژه)"
          value={summary?.garages ?? 0}
          icon="⭐"
          tone="purple"
          foot="دارای تعمیرگاه مجاز"
        />
        <StatCard
          label="امدادگران حملی"
          value={(data?.items || []).filter((item) => item.workType === 'transport').length}
          icon="🚚"
          tone="teal"
          foot="در صفحه‌ی جاری"
        />
      </div>

      <Card bodyClassName="tight">
        <div className="toolbar">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="جست‌وجو: نام امدادگر، شهر، محدوده، پلاک، خودرو…"
          />

          <select
            value={filters.zoneId}
            onChange={(event) => setFilters((current) => ({ ...current, zoneId: event.target.value, page: 1 }))}
          >
            <option value="">همه محدوده‌ها</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>

          <select
            value={filters.workType}
            onChange={(event) => setFilters((current) => ({ ...current, workType: event.target.value, page: 1 }))}
          >
            <option value="">همه نوع‌های کار</option>
            {WORK_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.icon} {type.label}
              </option>
            ))}
          </select>

          <select
            value={filters.isActive}
            onChange={(event) => setFilters((current) => ({ ...current, isActive: event.target.value, page: 1 }))}
          >
            <option value="">همه وضعیت‌ها</option>
            <option value="true">فقط فعال</option>
            <option value="false">غیرفعال</option>
          </select>

          <select
            value={`${filters.sort}:${filters.order}`}
            onChange={(event) => {
              const [sort, order] = event.target.value.split(':');
              setFilters((current) => ({ ...current, sort, order, page: 1 }));
            }}
          >
            <option value="name:asc">مرتب‌سازی: نام</option>
            <option value="total:desc">بیشترین بار</option>
            <option value="confirmed:desc">بیشترین تایید</option>
            <option value="cancelled:desc">بیشترین کنسلی</option>
            <option value="newest:desc">جدیدترین</option>
          </select>
        </div>

        {error ? (
          <div className="banner danger" style={{ margin: 14 }}>
            {error}
          </div>
        ) : null}

        {loading && !data ? (
          <Loader text="در حال دریافت امدادگران…" />
        ) : data?.items?.length ? (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>امدادگر</th>
                    <th>خودرو / پلاک</th>
                    <th>محدوده / شهر</th>
                    <th>نوع کار</th>
                    <th>بارها</th>
                    <th>وضعیت</th>
                    <th style={{ textAlign: 'left' }}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => {
                    const workType = WORK_TYPE_MAP[item.workType] || {};
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="person">
                            <span className={`avatar ${item.workType === 'garage' ? 'purple' : 'green'}`}>
                              {initials(item.fullName)}
                            </span>
                            <div>
                              <div className="person-name">{item.fullName}</div>
                              <div className="person-meta" dir="ltr">
                                {item.phone || '—'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="strong">{item.vehicle}</span>
                          <span className="sub" dir="ltr">
                            {item.plate}
                          </span>
                        </td>
                        <td>
                          <span className="strong">{item.zoneName || '—'}</span>
                          <span className="sub">{item.cityName || 'بدون شهر'}</span>
                        </td>
                        <td>
                          <Badge tone={item.workType === 'garage' ? 'purple' : 'brand'}>
                            {workType.icon} {item.workTypeLabel}
                          </Badge>
                          {item.isSpecial ? <span className="sub">امتیاز ویژه</span> : null}
                        </td>
                        <td>
                          <span className="strong">{faNumber(item.stats.total)}</span>
                          <span className="sub">
                            ✅ {faNumber(item.stats.confirmed)} · ⛔ {faNumber(item.stats.cancelled)}
                          </span>
                        </td>
                        <td>
                          <Badge tone={item.isActive ? 'success' : 'neutral'}>
                            {item.isActive ? 'فعال' : 'غیرفعال'}
                          </Badge>
                        </td>
                        <td>
                          <div className="cell-actions">
                            <button type="button" className="btn btn-icon" title="جزئیات" onClick={() => openDetails(item)}>
                              👁
                            </button>
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
                            {isAdmin ? (
                              <button
                                type="button"
                                className="btn btn-icon"
                                title="حذف"
                                onClick={() => setDeleteTarget(item)}
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
            icon="🧰"
            title="امدادگری پیدا نشد"
            description="عبارت جست‌وجو را تغییر دهید یا امدادگر جدید ثبت کنید."
            action={
              <button type="button" className="btn btn-primary btn-sm mt-12" onClick={() => setFormOpen(true)}>
                ➕ ثبت امدادگر جدید
              </button>
            }
          />
        )}
      </Card>

      <RescuerFormModal
        open={formOpen}
        initial={editing}
        zones={zones}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />

      <Modal
        open={Boolean(details)}
        size="md"
        title={details?.fullName || 'جزئیات امدادگر'}
        subtitle={details ? `${details.vehicle} • ${details.plate}` : ''}
        onClose={() => setDetails(null)}
      >
        {details ? (
          <>
            <div className="chip-row">
              <span className={`chip ${details.isActive ? 'success' : ''}`}>
                {details.isActive ? 'فعال' : 'غیرفعال'}
              </span>
              <span className="chip">{details.workTypeLabel}</span>
              <span className="chip">{details.cityName || 'بدون شهر'}</span>
              <span className="chip">{details.zoneName || 'بدون محدوده'}</span>
              {details.isSpecial ? <span className="chip warning">⭐ امتیاز ویژه</span> : null}
            </div>

            <div className="grid grid-3 mt-18" style={{ gap: 10 }}>
              <div className="rank-item">
                <div className="rank-body">
                  <div className="rank-meta">کل بار</div>
                  <div className="rank-value">{faNumber(details.stats?.total)}</div>
                </div>
              </div>
              <div className="rank-item">
                <div className="rank-body">
                  <div className="rank-meta">تایید شده</div>
                  <div className="rank-value" style={{ color: 'var(--success)' }}>
                    {faNumber(details.stats?.confirmed)}
                  </div>
                </div>
              </div>
              <div className="rank-item">
                <div className="rank-body">
                  <div className="rank-meta">کنسل شده</div>
                  <div className="rank-value" style={{ color: 'var(--danger)' }}>
                    {faNumber(details.stats?.cancelled)}
                  </div>
                </div>
              </div>
            </div>

            <h3 className="card-title mt-18" style={{ fontSize: 13 }}>
              <span className="dot" /> آخرین بارهای این امدادگر
            </h3>

            {detailsLoading ? (
              <Loader text="در حال دریافت بارها…" />
            ) : details.recentLoads?.length ? (
              <div className="table-wrap mt-12">
                <table className="data" style={{ minWidth: 480 }}>
                  <thead>
                    <tr>
                      <th>تاریخ</th>
                      <th>امدادخواه</th>
                      <th>خودرو</th>
                      <th>شهر</th>
                      <th>وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.recentLoads.map((loadItem) => (
                      <tr key={loadItem.id}>
                        <td className="nowrap">{faDateShort(loadItem.loadDate)}</td>
                        <td>{loadItem.customerName}</td>
                        <td>{loadItem.vehicleName}</td>
                        <td>{loadItem.cityName || '—'}</td>
                        <td>
                          <Badge
                            tone={
                              loadItem.status === 'confirmed'
                                ? 'success'
                                : loadItem.status === 'cancelled'
                                  ? 'danger'
                                  : 'warning'
                            }
                          >
                            {loadItem.status === 'confirmed'
                              ? 'تایید'
                              : loadItem.status === 'cancelled'
                                ? 'کنسل'
                                : 'در انتظار'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted mt-12">هنوز باری برای این امدادگر ثبت نشده است.</p>
            )}

            <div className="divider" />
            <div className="flex-between">
              <span className="text-xs text-muted">تاریخ ثبت در سامانه</span>
              <span className="text-xs">{faDate(details.createdAt)}</span>
            </div>
          </>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف امدادگر"
        description={
          deleteTarget
            ? `آیا از حذف «${deleteTarget.fullName}» مطمئن هستید؟ امدادگر دارای بار قابل حذف نیست؛ در آن صورت او را غیرفعال کنید.`
            : ''
        }
        confirmText="حذف امدادگر"
        onConfirm={removeRescuer}
        onClose={() => setDeleteTarget(null)}
        busy={busy}
      />
    </>
  );
}
