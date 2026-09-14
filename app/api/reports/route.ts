import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { getDb, getTehranDate } from "@/lib/db";
import { getJalaliMonthDays, isFriday, jalaliToGregorianIso, todayJalali } from "@/lib/date";
import { autoSyncGoogleSheet } from "@/lib/services/google-sheet-auto-sync";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const today = todayJalali();
    const year = Number(request.nextUrl.searchParams.get("year") || today.year);
    const month = Number(request.nextUrl.searchParams.get("month") || today.month);
    const db = getDb();
    const reports = await db.listReportsForUser(session.id, year, month);
    const byDay = new Map(reports.map((r) => [r.jalaliDay, r]));
    const totalDays = getJalaliMonthDays(year, month);
    const todayIso = getTehranDate();

    const days = Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1;
      const iso = jalaliToGregorianIso(year, month, day);
      const report = byDay.get(day);
      const future = iso > todayIso;
      const friday = isFriday(iso);
      const status = report?.status || (friday ? "HOLIDAY" : future ? "FUTURE" : "MISSING");
      return { day, reportDate: iso, status, report: report || null, isToday: iso === todayIso };
    });

    return NextResponse.json({ year, month, days });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ message: message === "UNAUTHORIZED" ? "ابتدا وارد شوید." : "دریافت گزارش‌ها ناموفق بود." }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}

const reportSchema = z.object({ text: z.string().trim().min(3).max(6000) });
export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const { text } = reportSchema.parse(await request.json());
    const db = getDb();
    const report = await db.upsertReport(session.id, getTehranDate(), text);
    await autoSyncGoogleSheet("EMPLOYEE_REPORT_CREATED", session.id).catch(console.error);
    return NextResponse.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
    if (error instanceof z.ZodError) return NextResponse.json({ message: "متن گزارش را کامل وارد کنید." }, { status: 400 });
    console.error(error);
    return NextResponse.json({ message: "ثبت گزارش انجام نشد." }, { status: 500 });
  }
}
