import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { getDb, publicUser } from "@/lib/db";

const schema = z.object({
  username: z.string().trim().min(2),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    const data = schema.parse(await request.json());
    const db = getDb();
    const user = await db.findUserByUsername(data.username);

    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      return NextResponse.json({ message: "نام کاربری یا رمز عبور صحیح نیست." }, { status: 401 });
    }
    if (user.status === "PENDING") {
      return NextResponse.json({ message: "حساب شما هنوز توسط مدیر تأیید نشده است.", code: "PENDING" }, { status: 403 });
    }
    if (user.status !== "APPROVED") {
      return NextResponse.json({ message: "دسترسی این حساب فعال نیست." }, { status: 403 });
    }

    const safe = publicUser(user);
    await createSession(safe);
    await db.updateLastLogin(user.id);
    return NextResponse.json({ user: safe });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "اطلاعات ورود کامل نیست." }, { status: 400 });
    console.error(error);
    return NextResponse.json({ message: "خطایی در ورود رخ داد." }, { status: 500 });
  }
}
