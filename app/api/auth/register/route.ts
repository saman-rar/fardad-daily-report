import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb, publicUser } from "@/lib/db";

const schema = z.object({
  fullName: z.string().trim().min(3, "نام و نام خانوادگی را وارد کنید."),
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/, "نام کاربری فقط شامل حروف انگلیسی، عدد و ._- باشد."),
  password: z.string().min(8, "رمز عبور حداقل ۸ کاراکتر باشد."),
});

export async function POST(request: Request) {
  try {
    const data = schema.parse(await request.json());
    const db = getDb();
    if (await db.findUserByUsername(data.username)) {
      return NextResponse.json({ message: "این نام کاربری قبلاً استفاده شده است." }, { status: 409 });
    }
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await db.createUser({ fullName: data.fullName, username: data.username, passwordHash, role: "EMPLOYEE", status: "PENDING" });
    return NextResponse.json({ user: publicUser(user), message: "درخواست عضویت ثبت شد و پس از تأیید مدیر می‌توانید وارد شوید." }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: error.issues[0]?.message || "اطلاعات معتبر نیست." }, { status: 400 });
    console.error(error);
    return NextResponse.json({ message: "ثبت نام انجام نشد." }, { status: 500 });
  }
}
