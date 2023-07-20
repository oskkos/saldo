export default function IntegerInput({
  label,
  value,
  placeholder,
  className,
  onChange,
}: {
  label: string;
  value?: number;
  placeholder?: string;
  className?: string;
  onChange?: (val?: number) => void;
}) {
  const input = (
    <input
      type="number"
      className={`input input-bordered ${className ?? ''}`}
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        if (e.target.value !== '') {
          onChange?.(parseInt(e.target.value));
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
