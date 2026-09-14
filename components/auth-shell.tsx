import Image from "next/image";
import { ShieldCheck, Sparkles, Clock3 } from "lucide-react";

export function AuthShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/35 shadow-[0_25px_100px_-35px_rgba(15,23,42,.35)] backdrop-blur-2xl lg:grid-cols-[1.08fr_.92fr]">
        <section className="relative hidden overflow-hidden border-l border-white/50 p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950" />
          <div className="absolute -right-20 top-14 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-lime-300/10 blur-3xl" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-emerald-100 backdrop-blur-xl">
              <Sparkles className="size-3.5" /> سامانه گزارش‌کار هوشمند
            </div>
            <h1 className="mt-8 max-w-xl text-4xl font-bold leading-[1.55] text-white">
              گزارش روزانه، بدون فایل‌های پراکنده و پیگیری دستی
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300">
              ثبت سریع گزارش، کنترل وضعیت ماهانه، تأیید کاربران و مدیریت متمرکز اطلاعات؛ با PostgreSQL به‌عنوان منبع اصلی و Google Sheets به‌عنوان نمای همگام‌شده.
            </p>
          </div>

          <div className="relative z-10 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
              <Clock3 className="mb-3 size-5 text-emerald-300" />
              <p className="text-sm font-semibold text-white">ثبت در چند ثانیه</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">تاریخ و وضعیت روزها کاملاً خودکار</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
              <ShieldCheck className="mb-3 size-5 text-emerald-300" />
              <p className="text-sm font-semibold text-white">ورود امن سازمانی</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">حساب‌های جدید پس از تأیید مدیر فعال می‌شوند</p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-5 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center">
              <div className="rounded-3xl border border-white/80 bg-white/75 px-6 py-4 shadow-xl shadow-slate-900/5 backdrop-blur-xl">
                <Image src="/fardad-logo.png" alt="فناوران سپهر فرداد" width={245} height={185} className="h-24 w-auto object-contain" priority />
              </div>
            </div>
            <div className="mb-7 text-center">
              <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
