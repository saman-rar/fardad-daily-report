import prisma from "@/lib/prisma";
import { isGoogleSheetsConfigured, syncDatabaseToGoogleSheets } from "@/lib/google-sheets";
import { getDb } from "@/lib/db";

export async function autoSyncGoogleSheet(trigger: string, triggeredById?: string) {
  if (!isGoogleSheetsConfigured()) return { skipped: true, reason: "NOT_CONFIGURED" };

  const log = await prisma.sheetSyncLog.create({
    data: { status: "FAILED", triggeredById, message: `Trigger: ${trigger}` },
  });

  try {
    const db = getDb();
    const [users, reports] = await Promise.all([
      db.listUsers(),
      db.listAllReports(),
    ]);

    const result = await syncDatabaseToGoogleSheets({ users, reports });

    await prisma.sheetSyncLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        usersCount: result.usersCount,
        reportsCount: result.reportsCount,
        message: `SUCCESS - ${trigger}`,
      },
    });

    return result;
  } catch (error) {
    await prisma.sheetSyncLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}
