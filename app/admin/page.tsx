import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { todayJalali } from "@/lib/date";
import { AppShell } from "@/components/app-shell";
import { AdminClient } from "@/components/admin-client";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");
  const today = todayJalali();
  return <AppShell user={session}><AdminClient currentYear={today.year} currentMonth={today.month} currentDay={today.day} /></AppShell>;
}
