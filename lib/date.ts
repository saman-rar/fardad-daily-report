import jalaali from "jalaali-js";

export const PERSIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

export function getTehranDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIMEZONE || "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function gregorianIsoToJalali(iso: string) {
  const [gy, gm, gd] = iso.split("-").map(Number);
  const { jy, jm, jd } = jalaali.toJalaali(gy, gm, gd);
  return {
    year: jy,
    month: jm,
    day: jd,
    text: `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`,
    monthName: PERSIAN_MONTHS[jm - 1],
  };
}

export function todayJalali() {
  return gregorianIsoToJalali(getTehranDate());
}

export function isFriday(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 5;
}

export function getJalaliMonthDays(jy: number, jm: number) {
  return jalaali.jalaaliMonthLength(jy, jm);
}

export function jalaliToGregorianIso(jy: number, jm: number, jd: number) {
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
  return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}

export function formatPersianDate(iso: string) {
  const j = gregorianIsoToJalali(iso);
  return `${j.day} ${j.monthName} ${j.year}`;
}
