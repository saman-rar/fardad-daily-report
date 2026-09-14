import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.role === "ADMIN" ? "/admin" : "/dashboard");
  return <AuthShell title="ورود به گزارش‌کار" subtitle="برای ادامه نام کاربری و رمز عبور سازمانی خود را وارد کنید."><LoginForm /></AuthShell>;
}
