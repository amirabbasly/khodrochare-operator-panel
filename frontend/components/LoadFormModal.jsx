'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { CANCEL_REASON_SUGGESTIONS, FOLLOW_UPS, STATUSES } from '@/lib/constants';
import { normalizePhoneInput, todayISO } from '@/lib/format';
import { Field, Modal } from '@/components/ui';
import JalaliDateInput from '@/components/JalaliDateInput';
import { useToast } from '@/components/ToastProvider';

const emptyForm = {
  loadDate: todayISO(),
  customerName: '',
  customerPhone: '',
  vehicleName: '',
  carProblem: '',
  cityName: '',
  zoneName: '',
  rescuerId: '',
  rescuerName: '',
  address: '',
  description: '',
  status: 'pending',
  cancelReason: '',
  followUp: 'not_done',
};

export default function LoadFormModal({ open, onClose, onSaved, zones = [], rescuers = [], initial = null }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [manualRescuer, setManualRescuer] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    setFormError('');

    if (initial) {
      const hasKnownRescuer = rescuers.some((item) => Number(item.id) === Number(initial.rescuerId));
      setManualRescuer(!hasKnownRescuer);
      setForm({
        loadDate: initial.loadDate || todayISO(),
        customerName: initial.customerName || '',
        customerPhone: initial.customerPhone || '',
        vehicleName: initial.vehicleName || '',
        carProblem: initial.carProblem || '',
        cityName: initial.cityName || '',
        zoneName: initial.zoneName || '',
        rescuerId: hasKnownRescuer ? String(initial.rescuerId) : '',
        rescuerName: hasKnownRescuer ? '' : initial.rescuerName || '',
        address: initial.address || '',
        description: initial.description || '',
        status: initial.status || 'pending',
        cancelReason: initial.cancelReason || '',
        followUp: initial.followUp || 'not_done',
      });
    } else {
      setManualRescuer(false);
      setForm({ ...emptyForm, loadDate: todayISO() });
    }
  }, [open, initial, rescuers]);

  const citySuggestions = useMemo(
    () => zones.flatMap((zone) => zone.cities.map((city) => city.name)),
    [zones]
  );

  const zoneSuggestions = useMemo(() => zones.map((zone) => zone.name), [zones]);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    setFieldErrors({});

    const clientErrors = {};
    if (!form.customerName.trim()) clientErrors.customerName = 'نام امدادخواه الزامی است.';
    if (!/^09\d{9}$/.test(normalizePhoneInput(form.customerPhone))) {
      clientErrors.customerPhone = 'شماره تماس باید ۱۱ رقم و با ۰۹ شروع شود.';
    }
    if (!form.vehicleName.trim()) clientErrors.vehicleName = 'نام خودرو الزامی است.';
    if (!form.carProblem.trim()) clientErrors.carProblem = 'مشکل خودرو الزامی است.';
    if (!form.rescuerId && !manualRescuer && !form.rescuerName.trim()) {
      clientErrors.rescuerName = 'امدادگر را انتخاب کنید یا نام او را وارد کنید.';
    }
    if (manualRescuer && !form.rescuerName.trim()) {
      clientErrors.rescuerName = 'نام امدادگر را وارد کنید.';
    }
    if (form.status === 'cancelled' && !form.cancelReason.trim()) {
      clientErrors.cancelReason = 'برای کنسل کردن بار، دلیل کنسلی را وارد کنید.';
    }

    if (Object.keys(clientErrors).length) {
      setFieldErrors(clientErrors);
      setSaving(false);
      return;
    }

    const payload = {
      loadDate: form.loadDate,
      customerName: form.customerName.trim(),
      customerPhone: normalizePhoneInput(form.customerPhone),
      vehicleName: form.vehicleName.trim(),
      carProblem: form.carProblem.trim(),
      cityName: form.cityName.trim() || null,
      zoneName: form.zoneName.trim() || null,
      rescuerId: !manualRescuer && form.rescuerId ? Number(form.rescuerId) : null,
      rescuerName: manualRescuer ? form.rescuerName.trim() : null,
      address: form.address.trim() || null,
      description: form.description.trim() || null,
      status: form.status,
      cancelReason: form.status === 'cancelled' ? form.cancelReason.trim() : null,
      followUp: form.followUp,
    };

    try {
      const response = isEdit
        ? await api.patch(`/loads/${initial.id}`, payload)
        : await api.post('/loads', payload);
      toast.success(response.message || 'بار ذخیره شد.');
      onSaved?.(response.item);
      onClose?.();
    } catch (error) {
      const details = Array.isArray(error.details) ? error.details : [];
      const mapped = {};
      details.forEach((detail) => {
        if (detail.field) mapped[detail.field] = detail.message;
      });
      setFieldErrors(mapped);
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? `ویرایش بار #${initial?.id}` : 'ثبت بار جدید'}
      subtitle="اطلاعات امدادخواه و امدادگر را کامل وارد کنید."
      onClose={onClose}
      footer={
        <>
          {formError ? <span className="modal-note" style={{ color: 'var(--danger)' }}>{formError}</span> : null}
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
            انصراف
          </button>
          <button type="submit" form="load-form" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner light" /> : null}
            {isEdit ? 'ذخیره تغییرات' : 'ثبت بار'}
          </button>
        </>
      }
    >
      <form id="load-form" onSubmit={handleSubmit} className="form-grid">
        <Field
          label="تاریخ بار (شمسی)"
          required
          error={fieldErrors.loadDate}
          hint="به صورت ۱۴۰۴/۰۸/۱۳ تایپ کنید"
        >
          <JalaliDateInput
            value={form.loadDate}
            onChange={(iso) => update('loadDate', iso)}
            ariaLabel="تاریخ شمسی بار"
            allowToday
          />
        </Field>

        <Field label="شماره تماس امدادخواه" required error={fieldErrors.customerPhone}>
          <input
            type="tel"
            dir="ltr"
            placeholder="۰۹۱۲۳۴۵۶۷۸۹"
            value={form.customerPhone}
            onChange={(event) => update('customerPhone', normalizePhoneInput(event.target.value))}
            required
          />
        </Field>

        <Field label="نام امدادخواه" required error={fieldErrors.customerName}>
          <input
            type="text"
            placeholder="مثلاً محمود رضایی"
            value={form.customerName}
            onChange={(event) => update('customerName', event.target.value)}
            required
          />
        </Field>

        <Field label="نام خودرو" required error={fieldErrors.vehicleName}>
          <input
            type="text"
            placeholder="مثلاً پژو ۲۰۶"
            value={form.vehicleName}
            onChange={(event) => update('vehicleName', event.target.value)}
            required
          />
        </Field>

        <Field label="مشکل خودرو" required error={fieldErrors.carProblem} className="full">
          <input
            type="text"
            placeholder="مثلاً روشن نشدن خودرو"
            value={form.carProblem}
            onChange={(event) => update('carProblem', event.target.value)}
            required
          />
        </Field>

        <Field
          label="شهر"
          error={fieldErrors.cityName}
          hint="شهر را تایپ کنید؛ نام‌های تکرارشده به‌صورت پیشنهاد نمایش داده می‌شوند."
        >
          <input
            type="text"
            list="load-city-suggestions"
            placeholder="مثلاً محمودآباد"
            value={form.cityName}
            onChange={(event) => update('cityName', event.target.value)}
          />
          <datalist id="load-city-suggestions">
            {citySuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>

        <Field label="محدوده" error={fieldErrors.zoneName} hint="محدوده‌ی فعالیت را خودتان تایپ کنید.">
          <input
            type="text"
            list="load-zone-suggestions"
            placeholder="مثلاً محدوده‌ی مرکزی"
            value={form.zoneName}
            onChange={(event) => update('zoneName', event.target.value)}
          />
          <datalist id="load-zone-suggestions">
            {zoneSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>

        <Field
          label="امدادگر"
          required
          error={fieldErrors.rescuerId || fieldErrors.rescuerName}
          hint={manualRescuer ? undefined : 'از فهرست امدادگران انتخاب کنید.'}
        >
          {manualRescuer ? (
            <input
              type="text"
              placeholder="نام و نام خانوادگی امدادگر"
              value={form.rescuerName}
              onChange={(event) => update('rescuerName', event.target.value)}
            />
          ) : (
            <select
              value={form.rescuerId}
              onChange={(event) => {
                if (event.target.value === '__manual__') {
                  setManualRescuer(true);
                  update('rescuerId', '');
                } else {
                  update('rescuerId', event.target.value);
                }
              }}
            >
              <option value="">— انتخاب امدادگر —</option>
              {rescuers.map((rescuer) => (
                <option key={rescuer.id} value={rescuer.id}>
                  {rescuer.fullName}
                  {rescuer.cityName ? ` — ${rescuer.cityName}` : ''}
                  {rescuer.workType === 'garage' ? ' ⭐' : ''}
                  {rescuer.isActive === false ? ' (غیرفعال)' : ''}
                </option>
              ))}
              <option value="__manual__">➕ امدادگر خارج از فهرست (ورود دستی)</option>
            </select>
          )}
          {manualRescuer ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: 'flex-start', paddingInline: 0 }}
              onClick={() => {
                setManualRescuer(false);
                update('rescuerName', '');
              }}
            >
              ↩ بازگشت به فهرست امدادگران
            </button>
          ) : null}
        </Field>

        <Field label="آدرس امدادخواه" error={fieldErrors.address} className="full">
          <input
            type="text"
            placeholder="مثلاً محمودآباد، بلوار امام، پلاک ۱۲"
            value={form.address}
            onChange={(event) => update('address', event.target.value)}
          />
        </Field>

        <Field label="توضیحات" error={fieldErrors.description} className="full">
          <textarea
            placeholder="توضیحات تکمیلی درباره‌ی درخواست…"
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
          />
        </Field>

        <Field label="وضعیت بار" error={fieldErrors.status}>
          <select value={form.status} onChange={(event) => update('status', event.target.value)}>
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="وضعیت پیگیری" error={fieldErrors.followUp}>
          <select value={form.followUp} onChange={(event) => update('followUp', event.target.value)}>
            {FOLLOW_UPS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        {form.status === 'cancelled' ? (
          <Field label="دلیل کنسلی" required error={fieldErrors.cancelReason} className="full">
            <input
              type="text"
              list="cancel-reasons"
              placeholder="دلیل کنسل شدن بار"
              value={form.cancelReason}
              onChange={(event) => update('cancelReason', event.target.value)}
            />
            <datalist id="cancel-reasons">
              {CANCEL_REASON_SUGGESTIONS.map((reason) => (
                <option key={reason} value={reason} />
              ))}
            </datalist>
          </Field>
        ) : null}
      </form>
    </Modal>
  );
}
