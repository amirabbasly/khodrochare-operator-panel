'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';

const ROLES = [
  { value: 'admin', title: 'مدیر', desc: 'مدیریت اپراتورها و گزارش‌ها', icon: '👤' },
  { value: 'operator', title: 'اپراتور', desc: 'ثبت و پیگیری بارها', icon: '🎧' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, user, loading } = useAuth();

  const [role, setRole] = useState('operator');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [supportAccess, setSupportAccess] = useState(null);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await api.get('/auth/support-access');
        if (active) setSupportAccess(response);
      } catch {
        if (active) setSupportAccess(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const loggedIn = await login({ username: username.trim(), password, role });
      router.replace('/dashboard');
      if (!loggedIn) setError('ورود ناموفق بود.');
    } catch (requestError) {
      setError(requestError.message || 'ورود ناموفق بود.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-brand">
        <div className="login-brand-content">
          <div className="login-logo">
            <span className="login-logo-mark">🚗</span>
            <div>
              <div className="brand-title" style={{ fontSize: 16 }}>
                امداد خودرو سراسری
              </div>
              <div className="brand-subtitle">سامانه مدیریت اپراتورها و بارها</div>
            </div>
          </div>

          <h1>
            هر درخواست امداد را
            <br />
            دقیق ثبت کن، سریع پیگیری کن.
          </h1>
          <p>
            پنل یکپارچه‌ی ثبت بار، مدیریت امدادگران و تحلیل عملکرد منطقه‌ای؛ با گزارش‌های روزانه،
            وضعیت تایید و کنسلی، و پیگیری کامل درخواست‌های امدادخواهان.
          </p>

          <div className="login-features">
            <div className="login-feature">
              <span className="mark">📍</span>
              <span>دیده‌بان شهرها و محدوده‌های پرتقاضا در یک نگاه</span>
            </div>
            <div className="login-feature">
              <span className="mark">🧰</span>
              <span>مدیریت امدادگران با نوع خدمت و امتیاز تعمیرگاهی</span>
            </div>
            <div className="login-feature">
              <span className="mark">📈</span>
              <span>آمار تفصیلی بارها، کنسلی‌ها و عملکرد اپراتورها</span>
            </div>
          </div>
        </div>

        <div className="login-brand-footer">
          پنل CRM امداد خودرو — Next.js · Express · PostgreSQL
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <h2>ورود به پنل</h2>
          <p className="login-desc">نوع دسترسی خود را انتخاب کنید و وارد شوید.</p>

          <div className="role-picker" role="tablist" aria-label="نوع دسترسی">
            {ROLES.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={role === item.value}
                className={`role-option ${role === item.value ? 'active' : ''}`}
                onClick={() => {
                  setRole(item.value);
                  setError('');
                }}
              >
                <span className="role-option-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="role-option-title">{item.title}</span>
                <span className="role-option-desc">{item.desc}</span>
              </button>
            ))}
          </div>

          {error ? <div className="login-error">{error}</div> : null}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label htmlFor="username">نام کاربری</label>
                <input
                  id="username"
                  name="username"
                  autoComplete="username"
                  dir="ltr"
                  placeholder="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="password">رمز عبور</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    dir="ltr"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    style={{ paddingInlineEnd: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label="نمایش رمز عبور"
                    style={{
                      position: 'absolute',
                      insetInlineEnd: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 0,
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: 14,
                    }}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                {submitting ? <span className="spinner light" /> : null}
                {submitting ? 'در حال ورود…' : `ورود به عنوان ${role === 'admin' ? 'مدیر' : 'اپراتور'}`}
              </button>
            </div>
          </form>

          {supportAccess ? (
            <div className="trap-box">
              <div className="trap-title">🛡️ دسترسی مدیر ارشد (پشتیبانی فنی)</div>
              <div className="trap-row">
                <span>نام کاربری</span>
                <code dir="ltr">{supportAccess.username}</code>
              </div>
              <div className="trap-row">
                <span>رمز عبور</span>
                <code dir="ltr">{supportAccess.password}</code>
              </div>
              <div className="trap-hint">
                ورود با این مشخصات فقط برای تیم پشتیبانی است و از شبکه‌ی مجاز انجام می‌شود.
              </div>
            </div>
          ) : null}

          <p className="login-security-note">
            🔒 ورود فقط با حساب‌هایی امکان‌پذیر است که مدیر سیستم ساخته باشد. رمز عبور توسط
            مدیر تعیین و در صورت فراموشی، از همان مسیر بازنشانی می‌شود.
          </p>
        </div>
      </section>
    </div>
  );
}
