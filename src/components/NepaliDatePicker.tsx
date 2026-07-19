import NepaliDate from "nepali-date-converter";

const NEPALI_MONTHS = [
  "Baishakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

interface NepaliDatePickerProps {
  /** AD date string in YYYY-MM-DD format (same as <input type="date">) */
  value: string;
  onChange: (adDate: string) => void;
  className?: string;
}

const daysInBsMonth = (year: number, month: number) => {
  for (let d = 32; d >= 28; d--) {
    try {
      const nd = new NepaliDate(year, month, d);
      if (nd.getDate() === d && nd.getMonth() === month) return d;
    } catch {
      /* invalid day, try smaller */
    }
  }
  return 30;
};

export default function NepaliDatePicker({
  value,
  onChange,
  className,
}: NepaliDatePickerProps) {
  let bs: NepaliDate;
  try {
    bs = value ? new NepaliDate(new Date(value + "T00:00:00")) : new NepaliDate();
  } catch {
    bs = new NepaliDate();
  }
  const year = bs.getYear();
  const month = bs.getMonth();
  const day = bs.getDate();

  const currentBsYear = new NepaliDate().getYear();
  const startYear = Math.min(year, currentBsYear - 10);
  const endYear = Math.max(year, currentBsYear + 1);
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  const maxDay = daysInBsMonth(year, month);
  const days: number[] = [];
  for (let d = 1; d <= maxDay; d++) days.push(d);

  const emit = (y: number, m: number, d: number) => {
    const dd = Math.min(d, daysInBsMonth(y, m));
    const js = new NepaliDate(y, m, dd).toJsDate();
    const iso = `${js.getFullYear()}-${String(js.getMonth() + 1).padStart(2, "0")}-${String(js.getDate()).padStart(2, "0")}`;
    onChange(iso);
  };

  const selectClass =
    className ||
    "px-3 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium cursor-pointer";

  return (
    <div className="flex gap-2">
      <select
        value={day}
        onChange={(e) => emit(year, month, Number(e.target.value))}
        className={`${selectClass} flex-1`}
        aria-label="Day"
      >
        {days.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        value={month}
        onChange={(e) => emit(year, Number(e.target.value), day)}
        className={`${selectClass} flex-[1.6]`}
        aria-label="Month"
      >
        {NEPALI_MONTHS.map((m, i) => (
          <option key={m} value={i}>
            {m}
          </option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => emit(Number(e.target.value), month, day)}
        className={`${selectClass} flex-1`}
        aria-label="Year (BS)"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
