export type ExportRow = Record<string, boolean | number | string | null>;

function preventSpreadsheetFormula(value: string): string {
  return /^[\t\r\n ]*[=+\-@]/u.test(value) ? `'${value}` : value;
}

function csvCell(value: ExportRow[string]): string {
  if (value === null) return "";
  const safe =
    typeof value === "string"
      ? preventSpreadsheetFormula(value)
      : String(value);
  return `"${safe.replaceAll('"', '""')}"`;
}

export function serializeCsv(rows: ExportRow[], columns: string[]): string {
  const header = columns.map(csvCell).join(",");
  const body = rows.map((row) =>
    columns.map((column) => csvCell(row[column] ?? null)).join(","),
  );
  return `\uFEFF${[header, ...body].join("\r\n")}\r\n`;
}
