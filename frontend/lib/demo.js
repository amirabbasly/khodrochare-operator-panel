export const API_READY = process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS !== 'false';

export const DEMO_ACCOUNTS = [
  {
    label: 'مدیر سیستم',
    role: 'admin',
    username: 'admin',
    password: 'admin12345',
  },
  {
    label: 'اپراتور پاسخگو',
    role: 'operator',
    username: 'ali.rezaei',
    password: 'operator12345',
  },
];
