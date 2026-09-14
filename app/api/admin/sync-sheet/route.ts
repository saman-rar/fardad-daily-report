import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isGoogleSheetsConfigured } from "@/lib/google-sheets";
import { autoSyncGoogleSheet } from "@/lib/services/google-sheet-auto-sync";

export async function GET() {
  try {
    await requireAdmin();
    const latest = await prisma.sheetSyncLog.findFirst({ orderBy: { startedAt: "desc" } });
    return NextResponse.json({
      configured: isGoogleSheetsConfigured(),
      sourceOfTruth: "DATABASE",
      direction: "DATABASE_TO_SHEETS",
      layout: "ONE_SHEET_PER_EMPLOYEE",
      latest: latest
        ? {
            ...latest,
            startedAt: latest.startedAt.toISOString(),
            finishedAt: latest.finishedAt?.toISOString() || null,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { message: "دسترسی مجاز نیست." },
      { status: message === "UNAUTHORIZED" ? 401 : 403 },
    );
  }
}

export async function POST() {
  try {
    const admin = await requireAdmin();
    if (!isGoogleSheetsConfigured()) {
      return NextResponse.json(
        { message: "اتصال Google Sheet هنوز در Environment Variables تنظیم نشده است." },
        { status: 503 },
      );
    }

    const result = await autoSyncGoogleSheet("ADMIN_MANUAL_SYNC", admin.id);

    return NextResponse.json({
      message: "شیت‌های کارمندان با اطلاعات دیتابیس همگام شدند.",
      ...result,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ message: "ابتدا وارد شوید." }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ message: "دسترسی مجاز نیست." }, { status: 403 });
    }
    return NextResponse.json({ message: "همگام‌سازی با Google Sheet ناموفق بود." }, { status: 500 });
  }
}
