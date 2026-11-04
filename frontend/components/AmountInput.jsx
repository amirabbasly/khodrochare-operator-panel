'use client';

import { useEffect, useState } from 'react';
import { formatAmount, parseAmount } from '@/lib/money';

/**
 * ورودی مبلغ با جداکننده‌ی سه‌رقمی (کاما) که همان‌طور که تایپ می‌کنید اعمال می‌شود.
 * مقدار خروجی یک عدد صحیح است (بدون کاما).
 */
export default function AmountInput({ value, onChange, id, placeholder = '1,000,000', ariaLabel }) {
  const [text, setText] = useState(() => (Number(value) ? formatAmount(value) : ''));

  useEffect(() => {
    const next = Number(value) ? formatAmount(value) : '';
    setText((current) => (parseAmount(current) === Number(value) ? current : next));
  }, [value]);

  const handleChange = (event) => {
    const amount = parseAmount(event.target.value);
    setText(amount ? formatAmount(amount) : '');
    onChange?.(amount);
  };

  return (
    <span className="amount-input">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        dir="ltr"
        aria-label={ariaLabel || 'مبلغ'}
        placeholder={placeholder}
        value={text}
        onChange={handleChange}
      />
      <span className="amount-unit">تومان</span>
    </span>
  );
}
