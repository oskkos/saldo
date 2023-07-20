import { assertIsISODay } from '@/util/assertionFunctions';
import { Date_ISODay } from '@/util/dateFormatter';

export default function DateInput({
  label,
  value,
  placeholder,
  className,
  onChange,
}: {
  label?: string;
  value?: Date_ISODay;
  placeholder?: string;
  className?: string;
  onChange?: (value?: Date_ISODay) => void;
}) {
  const input = (
    <input
      type="date"
      placeholder={placeholder}
      className={`input input-bordered ${className ?? ''}`}
      value={value}
      onChange={(e) => {
        if (e.target.value) {
          assertIsISODay(e.target.value);
          onChange?.(e.target.value);
        } else {
          onChange?.();
        }
      }}
    />
  );

  return label ? (
    <div className="indicator">
      <span className="indicator-item indicator-top indicator-center badge">
        {label}
      </span>
      {input}
    </div>
  ) : (
    input
  );
}
