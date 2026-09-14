import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb, publicUser } from "@/lib/db";
export async function GET() {
  try {
    await requireAdmin();
    const users = (await getDb().listUsers()).map(publicUser);
    return NextResponse.json({ users });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json({ message: "دسترسی مجاز نیست." }, { status: msg === "UNAUTHORIZED" ? 401 : 403 });
  }
}
