'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { faDigitsToLatin, normalizePhoneInput } from '@/lib/format';
import { Field, Modal } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';

const emptyForm = {
  firstName: '',
  lastName: '',
  username: '',
  password: '',
  phone: '',
  nationalId: '',
  role: 'operator',
  isActive: true,
};

export default function OperatorFormModal({ open, onClose, onSaved, initial = null }) {
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
        username: initial.username || '',
        password: '',
        phone: initial.phone || '',
        nationalId: initial.nationalId || '',
        role: initial.role || 'operator',
        isActive: initial.isActive !== false,
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, initial]);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setFieldErrors({});

    const errors = {};
    if (!form.firstName.trim()) errors.firstName = 'نام را وارد کنید.';
    if (!form.lastName.trim()) errors.lastName = 'نام خانوادگی را وارد کنید.';
    if (!/^[a-z0-9._]{4,30}$/.test(form.username.trim().toLowerCase())) {
      errors.username = 'نام کاربری باید ۴ تا ۳۰ کاراکتر و شامل حروف انگلیسی، عدد، نقطه یا خط زیر باشد.';
    }
    if (!isEdit && form.password.length < 8) errors.password = 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
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
      username: form.username.trim().toLowerCase(),
      phone: form.phone ? normalizePhoneInput(form.phone) : null,
      nationalId: form.nationalId ? faDigitsToLatin(form.nationalId) : null,
      role: form.role,
      isActive: form.isActive,
    };
    if (!isEdit) payload.password = form.password;

    try {
      const response = isEdit
        ? await api.patch(`/users/${initial.id}`, payload)
        : await api.post('/users', payload);
      toast.success(response.message || 'کاربر ذخیره شد.');
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
      title={isEdit ? 'ویرایش کاربر' : 'ساخت اپراتور جدید'}
      subtitle="نام کاربری و رمز عبور را در اختیار اپراتور قرار دهید."
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
          <button type="submit" form="operator-form" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner light" /> : null}
            {isEdit ? 'ذخیره تغییرات' : 'ساخت کاربر'}
          </button>
        </>
      }
    >
      <form id="operator-form" onSubmit={handleSubmit} className="form-grid">
        <Field label="نام" required error={fieldErrors.firstName}>
          <input
            type="text"
            value={form.firstName}
            onChange={(event) => update('firstName', event.target.value)}
            placeholder="مثلاً علی"
            required
          />
        </Field>

        <Field label="نام خانوادگی" required error={fieldErrors.lastName}>
          <input
            type="text"
            value={form.lastName}
            onChange={(event) => update('lastName', event.target.value)}
            placeholder="مثلاً رضایی"
            required
          />
        </Field>

        <Field label="نام کاربری" required error={fieldErrors.username} hint="فقط حروف انگلیسی، عدد، نقطه و خط زیر">
          <input
            type="text"
            dir="ltr"
            value={form.username}
            onChange={(event) => update('username', event.target.value)}
            placeholder="ali.rezaei"
            required
          />
        </Field>

        {!isEdit ? (
          <Field label="رمز عبور" required error={fieldErrors.password} hint="حداقل ۸ کاراکتر">
            <input
              type="text"
              dir="ltr"
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>
        ) : (
          <Field label="نقش کاربر" error={fieldErrors.role}>
            <select value={form.role} onChange={(event) => update('role', event.target.value)}>
              <option value="operator">اپراتور</option>
              <option value="admin">مدیر</option>
            </select>
          </Field>
        )}

        <Field label="شماره تماس" error={fieldErrors.phone}>
          <input
            type="tel"
            dir="ltr"
            value={form.phone}
            onChange={(event) => update('phone', normalizePhoneInput(event.target.value))}
            placeholder="09121112233"
          />
        </Field>

        <Field label="کد ملی" error={fieldErrors.nationalId} hint="۱۰ رقم">
          <input
            type="text"
            dir="ltr"
            value={form.nationalId}
            onChange={(event) => update('nationalId', faDigitsToLatin(event.target.value).slice(0, 10))}
            placeholder="0012345679"
          />
        </Field>

        {!isEdit ? (
          <Field label="نقش کاربر" error={fieldErrors.role}>
            <select value={form.role} onChange={(event) => update('role', event.target.value)}>
              <option value="operator">اپراتور</option>
              <option value="admin">مدیر</option>
            </select>
          </Field>
        ) : null}

        <div className="field full">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => update('isActive', event.target.checked)}
            />
            حساب فعال باشد (امکان ورود داشته باشد)
          </label>
        </div>
      </form>
    </Modal>
  );
}
