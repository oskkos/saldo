export default function Checkbox({
  label,
  checked,
  onChange,
}: {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="label cursor-pointer">
      <span className="label-text">{label}</span>
      <input
        type="checkbox"
        className="toggle toggle-primary"
        checked={checked}
        onChange={(e) => {
          onChange?.(e.target.checked);
        }}
      />
    </label>
  );
}
