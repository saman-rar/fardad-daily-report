"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, FileText, LayoutDashboard, LogOut, Menu, ShieldCheck, Users, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Props = { user: { fullName: string; username: string; role: "ADMIN" | "EMPLOYEE" }; children: React.ReactNode };

export function AppShell({ user, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const admin = user.role === "ADMIN";
  const links = admin
    ? [{ href: "/admin", label: "داشبورد مدیریت", icon: LayoutDashboard }, { href: "/admin#reports", label: "گزارش‌های کارمندان", icon: FileText }, { href: "/admin#users", label: "کاربران", icon: Users }]
    : [{ href: "/dashboard", label: "داشبورد من", icon: LayoutDashboard }, { href: "/dashboard#monthly", label: "گزارش‌های ماهانه", icon: BarChart3 }];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login"); router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-24 items-center border-b border-white/50 px-5">
        <Image src="/fardad-logo.png" alt="فرداد" width={205} height={155} className="h-[72px] w-auto object-contain" priority />
      </div>
      <nav className="flex-1 space-y-1.5 p-4">
        <p className="mb-3 px-3 text-[11px] font-semibold text-slate-400">فضای کاری</p>
        {links.map(({ href, label, icon: Icon }) => {
          const active = !href.includes("#") && pathname === href;
          return <Link key={href} href={href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition", active ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "text-slate-600 hover:bg-white/65 hover:text-slate-900") }><Icon className="size-4.5" />{label}</Link>;
        })}
      </nav>
      <div className="p-4">
        <div className="rounded-2xl border border-white/70 bg-white/50 p-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Avatar><AvatarFallback>{user.fullName.slice(0, 1)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{user.fullName}</p><p className="mt-0.5 truncate text-[11px] text-slate-400">{admin ? "مدیر سامانه" : `@${user.username}`}</p></div>
          </div>
          <Button variant="ghost" className="mt-3 w-full justify-start text-slate-500 hover:text-red-600" onClick={logout}><LogOut /> خروج از حساب</Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="fixed inset-y-4 right-4 z-40 hidden w-[244px] overflow-hidden rounded-[2rem] border border-white/70 bg-white/50 shadow-xl shadow-slate-900/5 backdrop-blur-2xl lg:block">{sidebar}</aside>
      <div className="lg:col-start-2 lg:min-w-0">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-white/45 bg-[#f5f8f6]/70 px-4 backdrop-blur-2xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Button variant="outline" size="icon" onClick={() => setOpen(true)}><Menu /></Button>
            <Image src="/fardad-logo.png" alt="فرداد" width={120} height={80} className="h-10 w-auto object-contain" />
          </div>
          <div className="hidden items-center gap-2 text-xs text-slate-500 lg:flex"><ShieldCheck className="size-4 text-emerald-500" /> اتصال امن به فضای گزارش‌کار</div>
          <div className="rounded-full border border-white/80 bg-white/60 px-3 py-1.5 text-xs text-slate-500 shadow-sm">{admin ? "پنل مدیریت" : "پنل کارمند"}</div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] p-4 pb-10 sm:p-6 lg:p-8">{children}</main>
      </div>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-slate-950/25 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="بستن منو" /><aside className="absolute inset-y-3 right-3 w-[285px] overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-2xl backdrop-blur-2xl"><button onClick={() => setOpen(false)} className="absolute left-3 top-3 z-10 rounded-full bg-white/80 p-2 text-slate-500"><X className="size-4" /></button>{sidebar}</aside></div>}
    </div>
  );
}
