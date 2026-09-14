import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb, publicUser } from "@/lib/db";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const user = await getDb().setUserStatus(id, "APPROVED", admin.id);
    return user ? NextResponse.json({ user: publicUser(user) }) : NextResponse.json({ message: "کاربر پیدا نشد." }, { status: 404 });
  } catch { return NextResponse.json({ message: "دسترسی مجاز نیست." }, { status: 403 }); }
}
