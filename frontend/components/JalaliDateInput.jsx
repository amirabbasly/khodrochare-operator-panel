'use client';

import { useEffect, useState } from 'react';
import { isoToJalaliInput, parseJalaliInput, todayJalaliInput } from '@/lib/jalali';

/**
 * ورودی تاریخ شمسی (تایپ مستقیم: ۱۴۰۴/۰۸/۱۳).
 * مقدار خروجی همیشه «YYYY-MM-DD» میلادی است تا API بدون تغییر بماند.
 */
export default function JalaliDateInput({
  value,
  onChange,
  id,
  placeholder = '۱۴۰۴/۰۸/۱۳',
  ariaLabel = 'تاریخ شمسی',
  allowToday = false,
}) {
  const [text, setText] = useState(() => isoToJalaliInput(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(isoToJalaliInput(value));
    setInvalid(false);
  }, [value]);

  const commit = (raw) => {
    setText(raw);
    if (!raw.trim()) {
      setInvalid(false);
      onChange?.('');
      return;
    }
    const iso = parseJalaliInput(raw);
    if (iso) {
      setInvalid(false);
      onChange?.(iso);
    } else {
      setInvalid(true);
    }
  };

  return (
    <span className={`jalali-input ${invalid ? 'invalid' : ''}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        dir="ltr"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={text}
        onChange={(event) => commit(event.target.value)}
        onBlur={() => setText(isoToJalaliInput(value))}
      />
      {allowToday ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            const today = todayJalaliInput();
            commit(today);
          }}
        >
          امروز
        </button>
      ) : null}
      {invalid ? <span className="jalali-error">تاریخ شمسی درست نیست؛ نمونه: ۱۴۰۴/۰۸/۱۳</span> : null}
    </span>
  );
}
