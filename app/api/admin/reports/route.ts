import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getDb, publicUser } from "@/lib/db";
import { jalaliToGregorianIso, todayJalali } from "@/lib/date";
import { autoSyncGoogleSheet } from "@/lib/services/google-sheet-auto-sync";

function monthBounds(year: number, month: number) {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const from = jalaliToGregorianIso(year, month, 1);
  const next = jalaliToGregorianIso(nextYear, nextMonth, 1);
  const nextDate = new Date(`${next}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() - 1);
  return { from, to: nextDate.toISOString().slice(0, 10) };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const today = todayJalali();
    const params = request.nextUrl.searchParams;
    const userId = params.get("userId") || undefined;
    let from = params.get("from") || undefined;
    let to = params.get("to") || undefined;

    if (!from && !to) {
      const year = Number(params.get("year") || today.year);
      const month = Number(params.get("month") || today.month);
      const bounds = monthBounds(year, month);
      from = bounds.from;
      to = bounds.to;
    }

    const db = getDb();
    const [reports, users] = await Promise.all([
      db.listReportsForAdmin({ userId, fromDate: from, toDate: to }),
      db.listUsers(),
    ]);
    const usersMap = new Map(users.map((u) => [u.id, publicUser(u)]));

    return NextResponse.json({
      from,
      to,
      reports: reports.map((r) => ({ ...r, user: usersMap.get(r.userId) || null })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { message: message === "UNAUTHORIZED" ? "ابتدا وارد شوید." : "دسترسی مجاز نیست." },
      { status: message === "UNAUTHORIZED" ? 401 : 403 },
    );
  }
}

const updateSchema = z.object({
  userId: z.string().min(1),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  text: z.string().trim().min(3).max(6000),
});

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const input = updateSchema.parse(await request.json());
    const db = getDb();
    const user = await db.findUserById(input.userId);

    if (!user || user.role !== "EMPLOYEE") {
      return NextResponse.json({ message: "کارمند انتخاب‌شده پیدا نشد." }, { status: 404 });
    }

    const report = await db.upsertReport(input.userId, input.reportDate, input.text);
    await autoSyncGoogleSheet("ADMIN_REPORT_UPDATED", undefined).catch(console.error);
    return NextResponse.json({ report: { ...report, user: publicUser(user) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ message: "دسترسی مجاز نیست." }, { status: 403 });
    if (error instanceof z.ZodError) return NextResponse.json({ message: "اطلاعات گزارش معتبر نیست." }, { status: 400 });
    console.error(error);
    return NextResponse.json({ message: "ذخیره گزارش انجام نشد." }, { status: 500 });
  }
}
