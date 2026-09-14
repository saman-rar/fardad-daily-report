import { NextResponse } from "next/server";
import { autoSyncGoogleSheet } from "@/lib/services/google-sheet-auto-sync";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await autoSyncGoogleSheet("DAILY_CRON_SYNC");
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ message: "Sync failed" }, { status: 500 });
  }
}
