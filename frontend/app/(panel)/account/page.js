'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import { Badge, Card } from '@/components/ui';
import { faNumber } from '@/lib/format';
import { isoToJalaliInput, jalaliDateTimeLabel } from '@/lib/jalali';

function Row({ label, value, mono = false }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className={`info-value ${mono ? 'mono' : ''}`}>{value || '—'}</span>
    </div>
  );
}

export default function AccountPage() {
  const { user, isAdmin } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);

  if (!user) return null;

  const createdLabel = user.createdAt ? jalaliDateTimeLabel(user.createdAt) : '—';

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">حساب من</h1>
          <p className="page-description">
            {isAdmin
              ? 'اطلاعات حساب مدیر سیستم — برای تغییر رمز عبور از دکمه‌ی پایین استفاده کنید.'
              : 'اطلاعات حساب شما فقط قابل مشاهده است؛ هرگونه تغییر (نام، شماره، کد ملی و رمز عبور) فقط توسط مدیر سیستم انجام می‌شود.'}
          </p>
        </div>
        <div className="page-actions">
          {isAdmin ? (
            <button type="button" className="btn btn-primary" onClick={() => setPasswordOpen(true)}>
              🔑 تغییر رمز عبور
            </button>
          ) : null}
        </div>
      </div>

      {!isAdmin ? (
        <div className="banner info" style={{ marginBottom: 16 }}>
          🔒 دسترسی شما «فقط خواندن» است: امکان ویرایش اطلاعات حساب یا تغییر رمز عبور برای اپراتور
          وجود ندارد. در صورت نیاز به تغییر، با مدیر سیستم تماس بگیرید.
        </div>
      ) : null}

      <div className="grid grid-2">
        <Card title="مشخصات حساب" hint="این اطلاعات توسط مدیر سیستم ثبت شده است">
          <div className="info-list">
            <Row label="نام و نام خانوادگی" value={user.fullName} />
            <Row label="نام کاربری" value={user.username} mono />
            <Row label="شماره تماس" value={user.phone} mono />
            <Row label="کد ملی" value={user.nationalId} mono />
            <Row
              label="نقش"
              value={
                <Badge tone={isAdmin ? 'brand' : 'neutral'}>
                  {isAdmin ? '👤 مدیر سیستم' : '🎧 اپراتور'}
                </Badge>
              }
            />
            <Row
              label="وضعیت حساب"
              value={
                <Badge tone={user.isActive ? 'success' : 'danger'}>
                  {user.isActive ? 'فعال' : 'غیرفعال'}
                </Badge>
              }
            />
          </div>
        </Card>

        <Card title="سابقه‌ی ورود" hint="زمان‌ها به تاریخ شمسی و ساعت تهران">
          <div className="info-list">
            <Row label="آخرین ورود" value={jalaliDateTimeLabel(user.lastLoginAt)} />
            <Row label="تاریخ ساخت حساب" value={createdLabel} />
            <Row label="شناسه‌ی کاربر" value={faNumber(user.id)} />
            <Row label="تاریخ شمسی امروز" value={isoToJalaliInput(new Date().toISOString().slice(0, 10))} />
          </div>

          <div className="divider" />

          <div className="text-xs text-muted">
            نشست شما پس از ۱۲ ساعت یا هنگام تغییر رمز توسط مدیر به‌صورت خودکار بسته می‌شود.
            {isAdmin ? ' رمز جدید را در جای امن نگه دارید.' : ''}
          </div>

          <div className="mt-12">
            <Link href="/dashboard" className="btn btn-outline btn-sm">
              ← بازگشت به داشبورد
            </Link>
          </div>
        </Card>
      </div>

      {isAdmin ? (
        <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      ) : null}
    </>
  );
}
