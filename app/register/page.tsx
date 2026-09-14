import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/register-form";
export default async function RegisterPage() {
  const session = await getSession(); if (session) redirect("/");
  return <AuthShell title="درخواست عضویت" subtitle="اطلاعات خود را وارد کنید؛ پس از تأیید مدیر دسترسی شما فعال می‌شود."><RegisterForm /></AuthShell>;
}
