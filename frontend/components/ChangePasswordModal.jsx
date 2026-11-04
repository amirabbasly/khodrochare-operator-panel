'use client';

import { useEffect, useState } from 'react';
import { api, saveSession } from '@/lib/api';
import { Field, Modal } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';

export default function ChangePasswordModal({ open, onClose }) {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
    setFormError('');
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!currentPassword) nextErrors.currentPassword = 'رمز فعلی را وارد کنید.';
    if (newPassword.length < 10) nextErrors.newPassword = 'رمز جدید باید حداقل ۱۰ کاراکتر باشد.';
    else if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      nextErrors.newPassword = 'رمز جدید باید شامل حرف انگلیسی و عدد باشد.';
    }
    if (newPassword !== confirmPassword) nextErrors.confirmPassword = 'تکرار رمز جدید مطابقت ندارد.';

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const response = await api.post('/auth/change-password', { currentPassword, newPassword });
      if (response.token) saveSession({ token: response.token });
      toast.success(response.message || 'رمز عبور تغییر کرد.');
      onClose?.();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      size="sm"
      title="تغییر رمز عبور"
      subtitle="برای امنیت بیشتر، رمز پیش‌فرض را تغییر دهید."
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
          <button type="submit" form="password-form" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner light" /> : null}
            ذخیره رمز جدید
          </button>
        </>
      }
    >
      <form id="password-form" onSubmit={submit} className="form-grid">
        <Field label="رمز عبور فعلی" required error={errors.currentPassword} className="full">
          <input
            type="password"
            dir="ltr"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field label="رمز عبور جدید" required error={errors.newPassword} className="full" hint="حداقل ۱۰ کاراکتر، شامل حرف انگلیسی و عدد">
          <input
            type="password"
            dir="ltr"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="تکرار رمز عبور جدید" required error={errors.confirmPassword} className="full">
          <input
            type="password"
            dir="ltr"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </form>
    </Modal>
  );
}
