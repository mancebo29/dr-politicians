import { z } from "zod";

export type DatePrecision = "year" | "month" | "day";

// "2020", "2020-08" or "2020-08-16". Research records only what sources state;
// the database stores the first day of the period plus its precision.
export const partialDateSchema = z
  .string()
  .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, "Use YYYY, YYYY-MM or YYYY-MM-DD")
  .refine((value) => {
    const [y, m = 1, d = 1] = value.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, "Not a real calendar date");

export function toDbDate(value: string | null | undefined): {
  date: string | null;
  precision: DatePrecision | null;
} {
  if (!value) return { date: null, precision: null };
  const parts = value.split("-");
  if (parts.length === 1) return { date: `${parts[0]}-01-01`, precision: "year" };
  if (parts.length === 2) return { date: `${parts[0]}-${parts[1]}-01`, precision: "month" };
  return { date: value, precision: "day" };
}

export function fromDbDate(
  date: string | null | undefined,
  precision: DatePrecision | null | undefined,
): string | null {
  if (!date || !precision) return null;
  if (precision === "year") return date.slice(0, 4);
  if (precision === "month") return date.slice(0, 7);
  return date;
}

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function formatPartialDate(value: string | null | undefined): string {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  if (!m) return y;
  const month = MONTHS[Number(m) - 1];
  return d ? `${Number(d)} de ${month} de ${y}` : `${month} de ${y}`;
}
