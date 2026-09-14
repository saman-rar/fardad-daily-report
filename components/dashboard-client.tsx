"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, FileCheck2, Loader2, Send, Sparkles, TriangleAlert, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PERSIAN_MONTHS } from "@/lib/date";

type DayItem = {
  day: number;
  reportDate: string;
  status: "SUBMITTED" | "MISSING" | "HOLIDAY" | "LEAVE" | "FUTURE";
  report: null | { reportText: string; updatedAt: string; status: string };
  isToday: boolean;
};

type ReportPayload = { year: number; month: number; days: DayItem[] };

function monthOptions(year: number, month: number) {
  const result: { year: number; month: number; key: string; label: string }[] = [];
  let y = year, m = month;
  for (let i = 0; i < 6; i++) {
    result.push({ year: y, month: m, key: `${y}-${m}`, label: `${PERSIAN_MONTHS[m - 1]} ${y}` });
    m -= 1; if (m === 0) { m = 12; y -= 1; }
  }
  return result;
}

function statusBadge(status: DayItem["status"]) {
  if (status === "SUBMITTED") return <Badge>ثبت شده</Badge>;
  if (status === "MISSING") return <Badge variant="destructive">ثبت نشده</Badge>;
  if (status === "HOLIDAY") return <Badge variant="secondary">تعطیل</Badge>;
  if (status === "LEAVE") return <Badge variant="warning">مرخصی</Badge>;
  return <Badge variant="outline">آینده</Badge>;
}

export function DashboardClient({ userName, currentYear, currentMonth, currentDay }: { userName: string; currentYear: number; currentMonth: number; currentDay: number }) {
  const options = useMemo(() => monthOptions(currentYear, currentMonth), [currentYear, currentMonth]);
  const [selected, setSelected] = useState(`${currentYear}-${currentMonth}`);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");

  const [year, month] = selected.split("-").map(Number);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?year=${year}&month=${month}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "خطا در دریافت گزارش‌ها");
      setData(json);
      const today = json.days.find((d: DayItem) => d.isToday);
      if (today?.report?.reportText) setText(today.report.reportText);
      else if (year === currentYear && month === currentMonth) setText("");
    } catch (e) { setMessage(e instanceof Error ? e.message : "خطایی رخ داد."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selected]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true); setMessage("");
    try {
      const res = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "ثبت گزارش ناموفق بود.");
      setMessage("گزارش امروز با موفقیت ثبت شد.");
      setSelected(`${currentYear}-${currentMonth}`);
      await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : "خطایی رخ داد."); }
    finally { setSaving(false); }
  }

  const submitted = data?.days.filter((d) => d.status === "SUBMITTED").length || 0;
  const missing = data?.days.filter((d) => d.status === "MISSING").length || 0;
  const elapsedWorkDays = data?.days.filter((d) => ["SUBMITTED", "MISSING", "LEAVE"].includes(d.status)).length || 0;
  const completion = elapsedWorkDays ? Math.round((submitted / elapsedWorkDays) * 100) : 100;
  const todayItem = data?.days.find((d) => d.isToday);
  const isCurrentMonth = year === currentYear && month === currentMonth;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-emerald-600"><Sparkles className="size-4" /> روز کاری شما در یک نگاه</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">سلام {userName}، آماده‌ای گزارش امروز را ثبت کنی؟</h1>
          <p className="mt-2 text-sm text-slate-500">امروز {currentDay} {PERSIAN_MONTHS[currentMonth - 1]} {currentYear} است. مهلت ثبت گزارش تا پایان امروز است.</p>
        </div>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-full bg-white/65 lg:w-48"><CalendarDays className="size-4 text-emerald-500" /><SelectValue /></SelectTrigger>
          <SelectContent>{options.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileCheck2} label="گزارش‌های ثبت‌شده" value={submitted} hint="در ماه انتخابی" tone="green" />
        <StatCard icon={TriangleAlert} label="ثبت‌نشده" value={missing} hint="روزهای گذشته" tone={missing ? "red" : "green"} />
        <StatCard icon={CheckCircle2} label="نرخ تکمیل" value={`${completion}%`} hint="بر اساس روزهای کاری" tone="green" />
        <StatCard icon={Clock3} label="وضعیت امروز" value={todayItem?.status === "SUBMITTED" ? "ثبت شد" : "در انتظار"} hint="تا ساعت ۲۳:۵۹" tone={todayItem?.status === "SUBMITTED" ? "green" : "amber"} />
      </section>

      {isCurrentMonth && (
        <Card className="overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-emerald-400/70 to-transparent" />
          <CardHeader className="sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle>گزارش امروز</CardTitle><CardDescription>خلاصه فعالیت‌ها، پیگیری‌ها و خروجی‌های امروز را بنویسید.</CardDescription></div>
            <Badge variant={todayItem?.status === "SUBMITTED" ? "default" : "warning"}>{todayItem?.status === "SUBMITTED" ? "قابل ویرایش تا پایان روز" : "هنوز ثبت نشده"}</Badge>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="relative">
                <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={6000} placeholder="مثلاً: امروز ماژول گزارشات را تکمیل کردم، جلسه هماهنگی با تیم برگزار شد و ..." className="min-h-40 resize-y bg-white/75 pb-10" />
                <span className="absolute bottom-3 left-3 text-[11px] text-slate-400">{text.length.toLocaleString("fa-IR")} / ۶۰۰۰</span>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-6 text-slate-500">با ثبت مجدد، متن گزارش امروز به‌روزرسانی می‌شود.</p>
                <Button disabled={saving || text.trim().length < 3} className="min-w-40">{saving ? <Loader2 className="animate-spin" /> : <Send />} {todayItem?.status === "SUBMITTED" ? "به‌روزرسانی گزارش" : "ثبت گزارش امروز"}</Button>
              </div>
              {message && <div className={message.includes("موفقیت") ? "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700" : "rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"}>{message}</div>}
            </form>
          </CardContent>
        </Card>
      )}

      <Card id="monthly">
        <CardHeader className="sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>گزارش‌های ماهانه</CardTitle><CardDescription>وضعیت روزهای ماه و متن گزارش‌های ثبت‌شده.</CardDescription></div>
          <div className="flex items-center gap-2 text-xs text-slate-400"><span className="size-2 rounded-full bg-emerald-500" /> ثبت‌شده <span className="mr-2 size-2 rounded-full bg-red-500" /> ثبت‌نشده</div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="flex h-64 items-center justify-center text-slate-400"><Loader2 className="ml-2 animate-spin" /> در حال دریافت گزارش‌ها...</div> : (
            <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/45">
              <div className="grid grid-cols-[70px_110px_1fr_48px] border-b border-slate-200/70 bg-slate-50/70 px-3 py-3 text-xs font-medium text-slate-500 sm:grid-cols-[90px_130px_1fr_58px]"><span>روز</span><span>وضعیت</span><span>گزارش</span><span /></div>
              <div className="max-h-[620px] overflow-y-auto soft-scrollbar">
                {data?.days.map((item) => (
                  <div key={item.day} className={`grid grid-cols-[70px_110px_1fr_48px] items-center gap-2 border-b border-slate-100 px-3 py-3 text-sm last:border-0 sm:grid-cols-[90px_130px_1fr_58px] ${item.isToday ? "bg-emerald-50/60" : item.status === "MISSING" ? "bg-red-50/45" : "hover:bg-white/60"}`}>
                    <div><span className="font-semibold text-slate-800">{item.day.toLocaleString("fa-IR")}</span>{item.isToday && <span className="mr-1 text-[10px] text-emerald-600">امروز</span>}</div>
                    <div>{statusBadge(item.status)}</div>
                    <p className="truncate text-xs leading-6 text-slate-600 sm:text-sm">{item.report?.reportText || (item.status === "MISSING" ? "گزارشی برای این روز ثبت نشده است." : item.status === "HOLIDAY" ? "روز تعطیل" : "—")}</p>
                    <div className="text-left">{item.report?.reportText && <Dialog><DialogTrigger asChild><Button size="icon" variant="ghost"><Eye /></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>گزارش روز {item.day.toLocaleString("fa-IR")}</DialogTitle><DialogDescription>{PERSIAN_MONTHS[month - 1]} {year}</DialogDescription></DialogHeader><div className="rounded-2xl bg-slate-50 p-4 text-sm leading-8 text-slate-700">{item.report.reportText}</div></DialogContent></Dialog>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, tone }: { icon: typeof CheckCircle2; label: string; value: string | number; hint: string; tone: "green" | "red" | "amber" }) {
  const classes = tone === "red" ? "bg-red-50 text-red-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600";
  return <Card className="group transition hover:-translate-y-0.5 hover:bg-white/70"><CardContent className="flex items-center gap-4 p-5"><div className={`flex size-11 items-center justify-center rounded-2xl ${classes}`}><Icon className="size-5" /></div><div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{typeof value === "number" ? value.toLocaleString("fa-IR") : value}</p><p className="mt-1 text-[10px] text-slate-400">{hint}</p></div></CardContent></Card>;
}
