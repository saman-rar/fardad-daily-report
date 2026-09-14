import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { todayJalali } from "@/lib/date";
import { AppShell } from "@/components/app-shell";
import { DashboardClient } from "@/components/dashboard-client";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin");
  const today = todayJalali();
  return <AppShell user={session}><DashboardClient userName={session.fullName} currentYear={today.year} currentMonth={today.month} currentDay={today.day} /></AppShell>;
}
