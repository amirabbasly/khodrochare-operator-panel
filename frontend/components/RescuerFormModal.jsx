'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { WORK_TYPES } from '@/lib/constants';
import { normalizePhoneInput } from '@/lib/format';
import { Field, Modal } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';

const emptyForm = {
  firstName: '',
  lastName: '',
  phone: '',
  vehicle: '',
  plate: '',
  zoneId: '',
  cityId: '',
  workType: 'both',
  isActive: true,
  notes: '',
};

export default function RescuerFormModal({ open, onClose, onSaved, zones = [], initial = null }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    setFormError('');
    if (initial) {
      setForm({
        firstName: initial.firstName || '',
        lastName: initial.lastName || '',
        phone: initial.phone || '',
        vehicle: initial.vehicle || '',
        plate: initial.plate || '',
        zoneId: initial.zoneId ? String(initial.zoneId) : '',
        cityId: initial.cityId ? String(initial.cityId) : '',
        workType: initial.workType || 'both',
        isActive: initial.isActive !== false,
        notes: initial.notes || '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, initial]);

  const cities = useMemo(() => {
    if (!form.zoneId) return zones.flatMap((zone) => zone.cities.map((city) => ({ ...city, zoneName: zone.name })));
    const zone = zones.find((item) => String(item.id) === String(form.zoneId));
    return (zone?.cities || []).map((city) => ({ ...city, zoneName: zone.name }));
  }, [form.zoneId, zones]);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setFieldErrors({});

    const errors = {};
    if (!form.firstName.trim()) errors.firstName = 'نام امدادگر الزامی است.';
    if (!form.lastName.trim()) errors.lastName = 'نام خانوادگی الزامی است.';
    if (!form.vehicle.trim()) errors.vehicle = 'خودروی امدادگر الزامی است.';
    if (!form.plate.trim()) errors.plate = 'پلاک خودرو الزامی است.';
    if (form.phone && !/^0\d{10}$/.test(normalizePhoneInput(form.phone))) {
      errors.phone = 'شماره تماس معتبر نیست.';
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone ? normalizePhoneInput(form.phone) : null,
      vehicle: form.vehicle.trim(),
      plate: form.plate.trim(),
      zoneId: form.zoneId ? Number(form.zoneId) : null,
      cityId: form.cityId ? Number(form.cityId) : null,
      workType: form.workType,
      isActive: form.isActive,
      notes: form.notes.trim() || null,
    };

    try {
      const response = isEdit
        ? await api.patch(`/rescuers/${initial.id}`, payload)
        : await api.post('/rescuers', payload);
      toast.success(response.message || 'امدادگر ذخیره شد.');
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
      title={isEdit ? `ویرایش امدادگر #${initial?.id}` : 'ثبت امدادگر جدید'}
      subtitle="اطلاعات خودرو، محدوده‌ی فعالیت و نوع خدمت امدادگر"
      onClose={onClose}
      footer={
        <>
          {formError ? (
            <span className="modal-note" style={{ color: 'var(--danger)' }}>
              {formError}
            </span>
          ) : null}
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
            انصراف
          </button>
          <button type="submit" form="rescuer-form" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner light" /> : null}
            {isEdit ? 'ذخیره تغییرات' : 'ثبت امدادگر'}
          </button>
        </>
      }
    >
      <form id="rescuer-form" onSubmit={handleSubmit} className="form-grid">
        <Field label="نام" required error={fieldErrors.firstName}>
          <input
            type="text"
            value={form.firstName}
            onChange={(event) => update('firstName', event.target.value)}
            placeholder="مثلاً امیر"
            required
          />
        </Field>

        <Field label="نام خانوادگی" required error={fieldErrors.lastName}>
          <input
            type="text"
            value={form.lastName}
            onChange={(event) => update('lastName', event.target.value)}
            placeholder="مثلاً کریمی"
            required
          />
        </Field>

        <Field label="شماره تماس امدادگر" error={fieldErrors.phone}>
          <input
            type="tel"
            dir="ltr"
            value={form.phone}
            onChange={(event) => update('phone', normalizePhoneInput(event.target.value))}
            placeholder="09111234567"
          />
        </Field>

        <Field label="خودروی امدادگر" required error={fieldErrors.vehicle}>
          <input
            type="text"
            value={form.vehicle}
            onChange={(event) => update('vehicle', event.target.value)}
            placeholder="مثلاً نیسان زامیاد"
            required
          />
        </Field>

        <Field label="پلاک خودرو" required error={fieldErrors.plate}>
          <input
            type="text"
            value={form.plate}
            onChange={(event) => update('plate', event.target.value)}
            placeholder="مثلاً ۱۲ب۳۴۵-۷۳"
            required
          />
        </Field>

        <Field label="نوع کار امدادگر" required error={fieldErrors.workType}>
          <select value={form.workType} onChange={(event) => update('workType', event.target.value)}>
            {WORK_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.icon} {type.label}
                {type.value === 'garage' ? ' (امتیاز ویژه)' : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field label="محدوده فعالیت" error={fieldErrors.zoneId}>
          <select
            value={form.zoneId}
            onChange={(event) => {
              update('zoneId', event.target.value);
              update('cityId', '');
            }}
          >
            <option value="">— انتخاب محدوده —</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="شهر فعالیت" error={fieldErrors.cityId}>
          <select value={form.cityId} onChange={(event) => update('cityId', event.target.value)}>
            <option value="">— انتخاب شهر —</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="توضیحات" error={fieldErrors.notes} className="full">
          <textarea
            value={form.notes}
            onChange={(event) => update('notes', event.target.value)}
            placeholder="توضیحات اختیاری درباره‌ی امدادگر…"
          />
        </Field>

        <div className="field full">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => update('isActive', event.target.checked)}
            />
            امدادگر فعال است و می‌تواند بار بگیرد
          </label>
        </div>
      </form>
    </Modal>
  );
}
