import { assertIsTime } from '@/util/assertionFunctions';
import { Date_Time } from '@/util/dateFormatter';

export default function TimeInput({
  label,
  value,
  placeholder,
  className,
  indicatorClassName,
  onChange,
}: {
  label?: string;
  value: Date_Time | '';
  placeholder?: string;
  className?: string;
  indicatorClassName?: string;
  onChange?: (value?: Date_Time) => void;
}) {
  const input = (
    <input
      type="time"
      placeholder={placeholder}
      className={`input input-bordered ${className ?? ''}`}
      value={value}
      onChange={(e) => {
        if (e.target.value) {
          assertIsTime(e.target.value);
          onChange?.(e.target.value);
        } else {
          onChange?.();
        }
      }}
    />
  );

  return label ? (
    <div className={`indicator ${indicatorClassName ?? ''}`}>
      <span className="indicator-item indicator-top indicator-center badge">
        {label}
      </span>
      {input}
    </div>
  ) : (
    input
  );
}
