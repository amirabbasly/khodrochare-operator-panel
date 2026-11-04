export const WORK_TYPES = [
  { value: 'transport', label: 'حملی', icon: '🚚', hint: 'حمل خودرو با خودروی امداد' },
  { value: 'onsite_repair', label: 'تعمیر در محل', icon: '🛠️', hint: 'رفع مشکل در محل' },
  { value: 'both', label: 'حملی + تعمیر در محل', icon: '🚛', hint: 'هر دو خدمت' },
  { value: 'garage', label: 'تعمیرگاهی', icon: '⭐', hint: 'امتیاز ویژه' },
];

export const WORK_TYPE_MAP = Object.fromEntries(WORK_TYPES.map((item) => [item.value, item]));

export const STATUSES = [
  { value: 'pending', label: 'در انتظار', tone: 'warning' },
  { value: 'confirmed', label: 'تایید شده', tone: 'success' },
  { value: 'cancelled', label: 'کنسل شده', tone: 'danger' },
];

export const STATUS_MAP = Object.fromEntries(STATUSES.map((item) => [item.value, item]));

export const FOLLOW_UPS = [
  { value: 'done', label: 'پیگیری انجام شد', tone: 'success' },
  { value: 'not_done', label: 'پیگیری انجام نشد', tone: 'warning' },
];

export const FOLLOW_UP_MAP = Object.fromEntries(FOLLOW_UPS.map((item) => [item.value, item]));

export const CANCEL_REASON_SUGGESTIONS = [
  'لغو توسط امدادخواه',
  'عدم حضور امدادگر در زمان مقرر',
  'خارج از محدوده‌ی پوشش',
  'تکرار درخواست',
  'ارجاع به امدادگر دیگر',
  'نبود امدادگر آزاد در محدوده',
  'اشتباه در ثبت اطلاعات',
  'اتمام ساعت کاری امدادگر',
];

export const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'داشبورد',
    icon: '📊',
    description: 'آمار کلی و عملکرد',
    roles: ['admin', 'operator'],
  },
  {
    href: '/loads',
    label: 'بارها',
    icon: '🚗',
    description: 'ثبت و مدیریت درخواست‌ها',
    roles: ['admin', 'operator'],
  },
  {
    href: '/rescuers',
    label: 'امدادگران',
    icon: '🧰',
    description: 'اطلاعات امدادگران',
    roles: ['admin', 'operator'],
  },
  {
    href: '/operators',
    label: 'اپراتورها',
    icon: '👥',
    description: 'مدیریت کاربران',
    roles: ['admin'],
  },
  {
    href: '/reports',
    label: 'گزارش‌های کامل',
    icon: '📈',
    description: 'آمار تفصیلی مدیر',
    roles: ['admin'],
  },
];

export const RANGE_PRESETS = [
  { label: 'امروز', days: 0 },
  { label: '۷ روز', days: 6 },
  { label: '۳۰ روز', days: 29 },
  { label: '۹۰ روز', days: 89 },
];
