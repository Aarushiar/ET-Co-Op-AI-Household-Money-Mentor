type SliderFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
};

const inrFormatter = new Intl.NumberFormat("en-IN");

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1000,
  onChange,
}: SliderFieldProps) {
  const inputId = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={inputId}
          className="text-[0.83rem] font-semibold text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
          Rs {inrFormatter.format(value)}
        </span>
      </div>

      <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(2,6,23,0.04)] dark:border-slate-700 dark:bg-slate-900/40">
        <span className="mr-2 text-sm font-medium text-slate-500 dark:text-slate-400">Rs</span>
        <input
          id={inputId}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) =>
            onChange(clamp(Number(event.target.value || min), min, max))
          }
          className="sota-focus-ring w-full bg-transparent text-sm font-semibold text-slate-900 outline-none dark:text-slate-100"
        />
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="sota-range"
      />

      <div className="flex justify-between text-[0.72rem] font-medium text-slate-500 dark:text-slate-400">
        <span>Rs {inrFormatter.format(min)}</span>
        <span>Rs {inrFormatter.format(max)}</span>
      </div>
    </div>
  );
}
