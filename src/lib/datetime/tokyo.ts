const TOKYO_TIME_ZONE = "Asia/Tokyo";
const TOKYO_OFFSET = "+09:00";
const DATE_TIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const tokyoFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  timeZone: TOKYO_TIME_ZONE,
  year: "numeric",
});

export function formatTokyoDateTimeLocal(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value.");
  }

  const parts = Object.fromEntries(
    tokyoFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function parseTokyoDateTimeLocal(value: string): string {
  if (!DATE_TIME_LOCAL_PATTERN.test(value)) {
    throw new Error("Date and time must use the datetime-local format.");
  }

  const isoValue = `${value}:00${TOKYO_OFFSET}`;
  const date = new Date(isoValue);

  if (
    Number.isNaN(date.getTime()) ||
    formatTokyoDateTimeLocal(date) !== value
  ) {
    throw new Error("Date and time are not valid in Asia/Tokyo.");
  }

  return date.toISOString();
}
