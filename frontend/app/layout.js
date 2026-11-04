import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { ToastProvider } from '@/components/ToastProvider';

export const metadata = {
  title: 'سامانه CRM امداد خودرو | پنل اپراتورها',
  description:
    'پنل مدیریت درخواست‌های امداد خودرو، امدادگران، اپراتورها و گزارش‌های آماری سراسری',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
