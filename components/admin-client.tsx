"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudUpload,
  Database,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  getJalaliMonthDays,
  gregorianIsoToJalali,
  jalaliToGregorianIso,
  PERSIAN_MONTHS,
} from "@/lib/date";

type User = {
  id: string;
  fullName: string;
  username: string;
  role: "ADMIN" | "EMPLOYEE";
  status: "PENDING" | "APPROVED" | "REJECTED" | "DISABLED";
  createdAt: string;
};

type Report = {
  id: string;
  userId: string;
  reportDate: string;
  jalaliDate: string;
  jalaliYear: number;
  jalaliMonth: number;
  jalaliDay: number;
  reportText: string;
  status: string;
  updatedAt: string;
  user: User | null;
};

type SyncStatus = {
  configured: boolean;
  sourceOfTruth: "DATABASE";
  direction: "DATABASE_TO_SHEETS";
  latest: null | {
    id: string;
    status: "SUCCESS" | "FAILED";
    startedAt: string;
    finishedAt: string | null;
    usersCount: number;
    reportsCount: number;
    message: string | null;
  };
};

type ViewMode = "list" | "calendar";

const WEEK_DAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

function jalaliMonthBounds(year: number, month: number) {
  return {
    from: jalaliToGregorianIso(year, month, 1),
    to: jalaliToGregorianIso(year, month, getJalaliMonthDays(year, month)),
  };
}

function moveJalaliMonth(year: number, month: number, delta: number) {
  let y = year;
  let m = month + delta;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return { year: y, month: m };
}

function saturdayOffset(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (jsDay + 1) % 7;
}

function safeJalaliLabel(iso: string) {
  if (!iso) return "";
  try {
    return gregorianIsoToJalali(iso).text;
  } catch {
    return "";
  }
}

export function AdminClient({
  currentYear,
  currentMonth,
  currentDay,
}: {
  currentYear: number;
  currentMonth: number;
  currentDay: number;
}) {
  const initialBounds = useMemo(() => jalaliMonthBounds(currentYear, currentMonth), [currentYear, currentMonth]);
  const todayIso = useMemo(
    () => jalaliToGregorianIso(currentYear, currentMonth, currentDay),
    [currentYear, currentMonth, currentDay],
  );

  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [calendarReports, setCalendarReports] = useState<Report[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [fromDate, setFromDate] = useState(initialBounds.from);
  const [toDate, setToDate] = useState(initialBounds.to);
  const [calendarYear, setCalendarYear] = useState(currentYear);
  const [calendarMonth, setCalendarMonth] = useState(currentMonth);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");
  const [todayReportsCount, setTodayReportsCount] = useState(0);

  async function loadBase() {
    setLoadingBase(true);
    try {
      const [usersRes, syncRes, todayRes] = await Promise.all([
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/sync-sheet", { cache: "no-store" }),
        fetch(`/api/admin/reports?from=${todayIso}&to=${todayIso}`, { cache: "no-store" }),
      ]);
      const [usersJson, syncJson, todayJson] = await Promise.all([usersRes.json(), syncRes.json(), todayRes.json()]);
      if (!usersRes.ok) throw new Error(usersJson.message || "خطا در دریافت کاربران");
      if (!syncRes.ok) throw new Error(syncJson.message || "خطا در دریافت وضعیت همگام‌سازی");
      if (!todayRes.ok) throw new Error(todayJson.message || "خطا در دریافت آمار امروز");
      setUsers(usersJson.users);
      setSyncStatus(syncJson);
      setTodayReportsCount(todayJson.reports.length);
    } catch (e) {
      setMessageKind("error");
      setMessage(e instanceof Error ? e.message : "خطایی رخ داد.");
    } finally {
      setLoadingBase(false);
    }
  }

  async function loadReports() {
    if (!fromDate || !toDate) return;
    setLoadingReports(true);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      if (selectedEmployee !== "all") params.set("userId", selectedEmployee);
      const res = await fetch(`/api/admin/reports?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "خطا در دریافت گزارش‌ها");
      setReports(json.reports);
    } catch (e) {
      setMessageKind("error");
      setMessage(e instanceof Error ? e.message : "خطا در دریافت گزارش‌ها");
    } finally {
      setLoadingReports(false);
    }
  }

  async function loadCalendarReports() {
    setLoadingCalendar(true);
    try {
      const bounds = jalaliMonthBounds(calendarYear, calendarMonth);
      const params = new URLSearchParams({ from: bounds.from, to: bounds.to });
      if (selectedEmployee !== "all") params.set("userId", selectedEmployee);
      const res = await fetch(`/api/admin/reports?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "خطا در دریافت تقویم گزارش‌ها");
      setCalendarReports(json.reports);
    } catch (e) {
      setMessageKind("error");
      setMessage(e instanceof Error ? e.message : "خطا در دریافت تقویم گزارش‌ها");
    } finally {
      setLoadingCalendar(false);
    }
  }

  useEffect(() => {
    loadBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee, fromDate, toDate]);

  useEffect(() => {
    loadCalendarReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee, calendarYear, calendarMonth]);

  async function refreshAll() {
    await Promise.all([loadBase(), loadReports(), loadCalendarReports()]);
  }

  async function setStatus(id: string, action: "approve" | "reject") {
    setActionId(id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/users/${id}/${action}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "عملیات انجام نشد.");
      setMessageKind("success");
      setMessage(action === "approve" ? "کاربر با موفقیت تأیید شد." : "درخواست کاربر رد شد.");
      await refreshAll();
    } catch (e) {
      setMessageKind("error");
      setMessage(e instanceof Error ? e.message : "خطایی رخ داد.");
    } finally {
      setActionId(null);
    }
  }

  async function syncSheet() {
    setSyncing(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/sync-sheet", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "همگام‌سازی انجام نشد.");
      setMessageKind("success");
      setMessage(json.message || "Google Sheet با موفقیت همگام شد.");
      await loadBase();
    } catch (e) {
      setMessageKind("error");
      setMessage(e instanceof Error ? e.message : "همگام‌سازی انجام نشد.");
    } finally {
      setSyncing(false);
    }
  }

  async function saveAdminReport(userId: string, reportDate: string, text: string) {
    setSavingReport(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reportDate, text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "ذخیره گزارش انجام نشد.");
      setMessageKind("success");
      setMessage("گزارش توسط مدیر با موفقیت ذخیره شد.");
      await Promise.all([loadReports(), loadCalendarReports(), loadBase()]);
      return true;
    } catch (e) {
      setMessageKind("error");
      setMessage(e instanceof Error ? e.message : "ذخیره گزارش انجام نشد.");
      return false;
    } finally {
      setSavingReport(false);
    }
  }

  const employees = useMemo(
    () => users.filter((u) => u.role === "EMPLOYEE").sort((a, b) => a.fullName.localeCompare(b.fullName, "fa")),
    [users],
  );
  const approved = employees.filter((u) => u.status === "APPROVED");
  const pending = employees.filter((u) => u.status === "PENDING");
  const completionToday = approved.length ? Math.round((todayReportsCount / approved.length) * 100) : 100;

  const filteredReports = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = reports.slice().sort((a, b) => b.reportDate.localeCompare(a.reportDate));
    if (!q) return sorted;
    return sorted.filter(
      (r) =>
        r.user?.fullName.toLowerCase().includes(q) ||
        r.user?.username.toLowerCase().includes(q) ||
        r.reportText.toLowerCase().includes(q) ||
        r.jalaliDate.includes(q),
    );
  }, [reports, query]);

  function moveCalendar(delta: number) {
    const next = moveJalaliMonth(calendarYear, calendarMonth, delta);
    setCalendarYear(next.year);
    setCalendarMonth(next.month);
  }

  function resetDateRange() {
    const bounds = jalaliMonthBounds(currentYear, currentMonth);
    setFromDate(bounds.from);
    setToDate(bounds.to);
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-emerald-600">
            <ShieldCheck className="size-4" /> مرکز کنترل گزارش‌کار
          </div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">داشبورد مدیریت</h1>
          <p className="mt-2 text-sm text-slate-500">
            گزارش کارمندان را فیلتر، مشاهده و در صورت نیاز برای هر تاریخ ویرایش کنید.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <SyncDialog configured={Boolean(syncStatus?.configured)} syncing={syncing} onSync={syncSheet} />
          <Button variant="secondary" onClick={refreshAll} disabled={loadingBase || loadingReports || loadingCalendar}>
            <RefreshCw className={loadingBase || loadingReports || loadingCalendar ? "animate-spin" : ""} /> به‌روزرسانی اطلاعات
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat icon={Users} label="کارمندان فعال" value={approved.length} helper="حساب تأییدشده" />
        <AdminStat icon={Clock3} label="در انتظار تأیید" value={pending.length} helper="درخواست عضویت جدید" warning={pending.length > 0} />
        <AdminStat icon={FileText} label="گزارش امروز" value={todayReportsCount} helper={`از ${approved.length.toLocaleString("fa-IR")} کارمند`} />
        <AdminStat icon={UserCheck} label="تکمیل امروز" value={`${completionToday}%`} helper="نسبت ثبت گزارش" />
      </section>

      {message && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            messageKind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <Tabs defaultValue="reports" id="reports">
        <TabsList className="w-full justify-start overflow-x-auto bg-white/55 sm:w-fit">
          <TabsTrigger value="reports">گزارش‌ها</TabsTrigger>
          <TabsTrigger value="pending">
            درخواست عضویت
            {pending.length > 0 && (
              <span className="mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                {pending.length.toLocaleString("fa-IR")}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="users">کاربران</TabsTrigger>
          <TabsTrigger value="sync">Google Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <Card className="overflow-hidden">
            <CardHeader className="gap-5 border-b border-white/60 bg-white/25">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <CardTitle>گزارش‌های کارمندان</CardTitle>
                  <CardDescription className="mt-1">
                    کارمند، بازه زمانی و نوع نمایش را انتخاب کنید. مدیر می‌تواند گزارش هر روز را ایجاد یا ویرایش کند.
                  </CardDescription>
                </div>
                <div className="flex items-center rounded-xl border border-slate-200 bg-white/75 p-1 shadow-sm">
                  <Button
                    type="button"
                    size="sm"
                    variant={viewMode === "list" ? "default" : "ghost"}
                    onClick={() => setViewMode("list")}
                    className="min-w-24"
                  >
                    <List /> لیستی
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={viewMode === "calendar" ? "default" : "ghost"}
                    onClick={() => setViewMode("calendar")}
                    className="min-w-24"
                  >
                    <LayoutGrid /> تقویم
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.1fr)_minmax(175px,.8fr)_minmax(175px,.8fr)_minmax(220px,1fr)]">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">کارمند</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="w-full bg-white/80">
                      <UserRound className="size-4 text-emerald-500" />
                      <SelectValue placeholder="انتخاب کارمند" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="all">همه کارمندان</SelectItem>
                      {approved.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">از تاریخ</Label>
                  <Input type="date" dir="ltr" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} disabled={viewMode === "calendar"} className="bg-white/80" />
                  <p className="px-1 text-[10px] text-slate-400">{safeJalaliLabel(fromDate)}</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">تا تاریخ</Label>
                  <Input type="date" dir="ltr" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} disabled={viewMode === "calendar"} className="bg-white/80" />
                  <p className="px-1 text-[10px] text-slate-400">{safeJalaliLabel(toDate)}</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">جستجو</Label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={viewMode === "list" ? "نام کارمند یا متن گزارش..." : "جستجو در حالت لیستی"}
                      disabled={viewMode === "calendar"}
                      className="bg-white/80 pr-10"
                    />
                  </div>
                  <button type="button" onClick={resetDateRange} className="px-1 text-[10px] text-emerald-600 hover:underline">
                    بازگشت بازه به ماه جاری
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-5">
              {viewMode === "list" ? (
                <ReportsList
                  reports={filteredReports}
                  loading={loadingReports}
                  saving={savingReport}
                  onSave={saveAdminReport}
                />
              ) : (
                <ReportsCalendar
                  year={calendarYear}
                  month={calendarMonth}
                  reports={calendarReports}
                  employees={approved}
                  selectedEmployee={selectedEmployee}
                  loading={loadingCalendar}
                  saving={savingReport}
                  todayIso={todayIso}
                  onPrev={() => moveCalendar(-1)}
                  onNext={() => moveCalendar(1)}
                  onToday={() => {
                    setCalendarYear(currentYear);
                    setCalendarMonth(currentMonth);
                  }}
                  onSave={saveAdminReport}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>درخواست‌های عضویت</CardTitle>
              <CardDescription>هر حساب جدید فقط پس از تأیید شما امکان ورود خواهد داشت.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingBase ? (
                <Loading />
              ) : pending.length === 0 ? (
                <Empty text="درخواست عضویت جدیدی وجود ندارد." />
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {pending.map((u) => (
                    <div
                      key={u.id}
                      className="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white/60 p-4 sm:flex-row sm:items-center"
                    >
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-50 font-bold text-amber-600">
                        {u.fullName.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800">{u.fullName}</p>
                        <p className="mt-1 text-xs text-slate-400">@{u.username}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => setStatus(u.id, "approve")} disabled={actionId === u.id}>
                          {actionId === u.id ? <Loader2 className="animate-spin" /> : <Check />} تأیید
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setStatus(u.id, "reject")} disabled={actionId === u.id}>
                          <X /> رد
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" id="users">
          <Card>
            <CardHeader>
              <CardTitle>فهرست کاربران</CardTitle>
              <CardDescription>حساب‌های ثبت‌شده در سامانه و وضعیت دسترسی آن‌ها.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingBase ? (
                <Loading />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/45">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>نام</TableHead>
                        <TableHead>نام کاربری</TableHead>
                        <TableHead>نقش</TableHead>
                        <TableHead>وضعیت</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium text-slate-800">{u.fullName}</TableCell>
                          <TableCell dir="ltr" className="text-right text-xs">@{u.username}</TableCell>
                          <TableCell><Badge variant="secondary">{u.role === "ADMIN" ? "مدیر" : "کارمند"}</Badge></TableCell>
                          <TableCell>
                            {u.status === "APPROVED" ? (
                              <Badge>فعال</Badge>
                            ) : u.status === "PENDING" ? (
                              <Badge variant="warning">در انتظار</Badge>
                            ) : (
                              <Badge variant="destructive">غیرفعال</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync">
          <div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
            <Card>
              <CardHeader>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <FileSpreadsheet className="size-6" />
                </div>
                <CardTitle>همگام‌سازی Google Sheet</CardTitle>
                <CardDescription>
                  Sheet یک نسخه نمایشی/پشتیبان از اطلاعات سامانه است و دیتابیس PostgreSQL منبع اصلی اطلاعات باقی می‌ماند.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoBox label="Source of truth" value="PostgreSQL + Prisma" icon={Database} />
                  <InfoBox label="جهت همگام‌سازی" value="Database → Sheet" icon={CloudUpload} />
                </div>
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-sm leading-7 text-amber-800">
                  برای هر کارمند تأییدشده یک Tab مجزا ساخته می‌شود. تغییر مستقیم داخل Google Sheet وارد دیتابیس نمی‌شود و در همگام‌سازی بعدی Tab کارمند دوباره از روی دیتابیس بازسازی می‌شود.
                </div>
                {!syncStatus?.configured && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-700">
                    اتصال Google Sheet هنوز تنظیم نشده است. متغیرهای GOOGLE_SHEET_ID، GOOGLE_SERVICE_ACCOUNT_EMAIL و GOOGLE_PRIVATE_KEY را در Environment Variables وارد کنید.
                  </div>
                )}
                <SyncDialog configured={Boolean(syncStatus?.configured)} syncing={syncing} onSync={syncSheet} wide />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>آخرین همگام‌سازی</CardTitle>
                <CardDescription>وضعیت آخرین Push اطلاعات از دیتابیس به Sheet.</CardDescription>
              </CardHeader>
              <CardContent>
                {!syncStatus?.latest ? (
                  <Empty text="هنوز همگام‌سازی انجام نشده است." />
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                      <span className="text-sm text-slate-500">وضعیت</span>
                      {syncStatus.latest.status === "SUCCESS" ? <Badge>موفق</Badge> : <Badge variant="destructive">ناموفق</Badge>}
                    </div>
                    <SyncRow label="زمان" value={formatDateTime(syncStatus.latest.finishedAt || syncStatus.latest.startedAt)} />
                    <SyncRow label="کاربران" value={syncStatus.latest.usersCount.toLocaleString("fa-IR")} />
                    <SyncRow label="گزارش‌ها" value={syncStatus.latest.reportsCount.toLocaleString("fa-IR")} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportsList({
  reports,
  loading,
  saving,
  onSave,
}: {
  reports: Report[];
  loading: boolean;
  saving: boolean;
  onSave: (userId: string, reportDate: string, text: string) => Promise<boolean>;
}) {
  if (loading) return <Loading />;
  if (reports.length === 0) return <Empty text="در بازه و فیلتر انتخاب‌شده گزارشی ثبت نشده است." />;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/45">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>کارمند</TableHead>
            <TableHead>تاریخ</TableHead>
            <TableHead>گزارش</TableHead>
            <TableHead className="w-24">وضعیت</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div>
                  <p className="font-medium text-slate-800">{r.user?.fullName || "کاربر حذف‌شده"}</p>
                  <p className="mt-1 text-[11px] text-slate-400">@{r.user?.username || "-"}</p>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs">
                <p>{r.jalaliDate}</p>
                <p dir="ltr" className="mt-1 text-[10px] text-slate-400">{r.reportDate}</p>
              </TableCell>
              <TableCell className="max-w-lg">
                <p className="line-clamp-2 text-xs leading-6 text-slate-600 sm:text-sm">{r.reportText}</p>
              </TableCell>
              <TableCell><Badge>ثبت شده</Badge></TableCell>
              <TableCell>
                {r.user && (
                  <ReportEditDialog report={r} saving={saving} onSave={onSave} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ReportEditDialog({
  report,
  saving,
  onSave,
}: {
  report: Report;
  saving: boolean;
  onSave: (userId: string, reportDate: string, text: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(report.reportText);

  useEffect(() => {
    if (open) setText(report.reportText);
  }, [open, report.reportText]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!report.user || text.trim().length < 3) return;
    const ok = await onSave(report.user.id, report.reportDate, text);
    if (ok) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm"><Pencil /> ویرایش</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ویرایش گزارش {report.user?.fullName}</DialogTitle>
          <DialogDescription>گزارش روز {report.jalaliDate} — مدیر محدودیت ویرایش روز جاری را ندارد.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={6000} className="min-h-52 resize-y bg-white/80" />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">{text.length.toLocaleString("fa-IR")} / ۶۰۰۰</span>
            <Button disabled={saving || text.trim().length < 3}>{saving ? <Loader2 className="animate-spin" /> : <Save />} ذخیره تغییرات</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReportsCalendar({
  year,
  month,
  reports,
  employees,
  selectedEmployee,
  loading,
  saving,
  todayIso,
  onPrev,
  onNext,
  onToday,
  onSave,
}: {
  year: number;
  month: number;
  reports: Report[];
  employees: User[];
  selectedEmployee: string;
  loading: boolean;
  saving: boolean;
  todayIso: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSave: (userId: string, reportDate: string, text: string) => Promise<boolean>;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayOpen, setDayOpen] = useState(false);
  const totalDays = getJalaliMonthDays(year, month);
  const firstIso = jalaliToGregorianIso(year, month, 1);
  const offset = saturdayOffset(firstIso);
  const trailing = (7 - ((offset + totalDays) % 7)) % 7;
  const byDate = useMemo(() => {
    const map = new Map<string, Report[]>();
    for (const report of reports) {
      const list = map.get(report.reportDate) || [];
      list.push(report);
      map.set(report.reportDate, list);
    }
    return map;
  }, [reports]);

  function openDay(iso: string) {
    setSelectedDate(iso);
    setDayOpen(true);
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/55 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-emerald-600" />
          <div>
            <p className="font-semibold text-slate-800">{PERSIAN_MONTHS[month - 1]} {year}</p>
            <p className="text-[11px] text-slate-400">برای مشاهده و ویرایش گزارش‌ها روی هر روز کلیک کنید.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={onPrev} title="ماه قبل"><ChevronRight /></Button>
          <Button type="button" variant="outline" size="sm" onClick={onToday}>ماه جاری</Button>
          <Button type="button" variant="outline" size="icon" onClick={onNext} title="ماه بعد"><ChevronLeft /></Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/50">
        <div className="min-w-[920px]">
          <div className="grid grid-cols-7 border-b border-slate-200/70 bg-slate-50/75">
            {WEEK_DAYS.map((day) => (
              <div key={day} className={`px-3 py-3 text-center text-xs font-semibold ${day === "جمعه" ? "text-red-500" : "text-slate-500"}`}>{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: offset }).map((_, index) => (
              <div key={`empty-${index}`} className="min-h-40 border-b border-l border-slate-100 bg-slate-50/35" />
            ))}
            {Array.from({ length: totalDays }, (_, index) => {
              const day = index + 1;
              const iso = jalaliToGregorianIso(year, month, day);
              const dayReports = byDate.get(iso) || [];
              const isToday = iso === todayIso;
              const isFuture = iso > todayIso;
              const dayOfWeek = saturdayOffset(iso);
              const isFriday = dayOfWeek === 6;
              const selectedUser = employees.find((u) => u.id === selectedEmployee);
              const selectedReport = selectedEmployee === "all" ? null : dayReports.find((r) => r.userId === selectedEmployee);
              const missingSpecific = selectedEmployee !== "all" && !selectedReport && !isFuture && !isFriday;
              const missingCount = selectedEmployee === "all" && !isFuture && !isFriday
                ? Math.max(0, employees.length - dayReports.length)
                : 0;

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => openDay(iso)}
                  className={`group min-h-40 border-b border-l border-slate-100 p-2 text-right align-top transition hover:z-10 hover:bg-white hover:shadow-lg ${
                    isToday ? "bg-emerald-50/70 ring-1 ring-inset ring-emerald-300" : isFriday ? "bg-red-50/30" : missingSpecific ? "bg-red-50/45" : "bg-white/25"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className={`flex size-7 items-center justify-center rounded-lg text-xs font-bold ${isToday ? "bg-emerald-500 text-white" : isFriday ? "text-red-500" : "text-slate-700"}`}>
                      {day.toLocaleString("fa-IR")}
                    </span>
                    {isToday && <span className="text-[10px] font-medium text-emerald-600">امروز</span>}
                  </div>

                  {selectedEmployee === "all" ? (
                    <div className="space-y-1.5">
                      {dayReports.slice(0, 3).map((report) => (
                        <div key={report.id} className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-2 py-1.5">
                          <p className="truncate text-[10px] font-semibold text-emerald-800">{report.user?.fullName}</p>
                          <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-slate-500">{report.reportText}</p>
                        </div>
                      ))}
                      {dayReports.length > 3 && <p className="text-[10px] text-slate-400">+ {(dayReports.length - 3).toLocaleString("fa-IR")} گزارش دیگر</p>}
                      {dayReports.length === 0 && (
                        <p className={`pt-3 text-center text-[10px] ${isFuture ? "text-slate-300" : isFriday ? "text-red-300" : "text-slate-400"}`}>
                          {isFuture ? "آینده" : isFriday ? "تعطیل" : "گزارشی ثبت نشده"}
                        </p>
                      )}
                      {!isFuture && !isFriday && employees.length > 0 && (
                        <p className={`pt-1 text-[10px] ${missingCount ? "text-red-400" : "text-emerald-500"}`}>
                          {dayReports.length.toLocaleString("fa-IR")} از {employees.length.toLocaleString("fa-IR")} گزارش
                        </p>
                      )}
                    </div>
                  ) : selectedReport ? (
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/65 p-2">
                      <p className="mb-1 text-[10px] font-semibold text-emerald-700">{selectedUser?.fullName}</p>
                      <p className="line-clamp-4 text-[10px] leading-5 text-slate-600">{selectedReport.reportText}</p>
                    </div>
                  ) : (
                    <div className="flex min-h-24 items-center justify-center">
                      <p className={`text-[10px] ${isFuture ? "text-slate-300" : isFriday ? "text-red-300" : "text-red-400"}`}>
                        {isFuture ? "آینده" : isFriday ? "تعطیل" : "گزارش ثبت نشده"}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
            {Array.from({ length: trailing }).map((_, index) => (
              <div key={`tail-${index}`} className="min-h-40 border-b border-l border-slate-100 bg-slate-50/35" />
            ))}
          </div>
        </div>
      </div>

      <DayReportsDialog
        open={dayOpen}
        onOpenChange={setDayOpen}
        reportDate={selectedDate}
        reports={selectedDate ? byDate.get(selectedDate) || [] : []}
        employees={employees}
        selectedEmployee={selectedEmployee}
        saving={saving}
        onSave={onSave}
      />
    </div>
  );
}

function DayReportsDialog({
  open,
  onOpenChange,
  reportDate,
  reports,
  employees,
  selectedEmployee,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportDate: string | null;
  reports: Report[];
  employees: User[];
  selectedEmployee: string;
  saving: boolean;
  onSave: (userId: string, reportDate: string, text: string) => Promise<boolean>;
}) {
  const defaultUserId = selectedEmployee === "all"
    ? reports[0]?.userId || employees[0]?.id || ""
    : selectedEmployee;
  const [editingUserId, setEditingUserId] = useState(defaultUserId);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) return;
    const nextUser = selectedEmployee === "all"
      ? reports[0]?.userId || employees[0]?.id || ""
      : selectedEmployee;
    setEditingUserId(nextUser);
  }, [open, selectedEmployee, reports, employees]);

  useEffect(() => {
    const report = reports.find((r) => r.userId === editingUserId);
    setText(report?.reportText || "");
  }, [editingUserId, reports]);

  const jalaliDate = reportDate ? safeJalaliLabel(reportDate) : "";
  const currentEmployee = employees.find((u) => u.id === editingUserId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reportDate || !editingUserId || text.trim().length < 3) return;
    await onSave(editingUserId, reportDate, text);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
        <div className="border-b border-slate-200/70 bg-white/70 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarRange className="size-5 text-emerald-600" /> گزارش‌های روز {jalaliDate}</DialogTitle>
            <DialogDescription>گزارش هر کارمند را مشاهده کنید؛ مدیر می‌تواند برای روزهای گذشته نیز گزارش را ایجاد یا ویرایش کند.</DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid min-h-[520px] overflow-hidden lg:grid-cols-[300px_1fr]">
          <div className="border-l border-slate-200/70 bg-slate-50/55 p-4">
            <p className="mb-3 text-xs font-semibold text-slate-500">کارمندان</p>
            <div className="max-h-[430px] space-y-2 overflow-y-auto pl-1 soft-scrollbar">
              {(selectedEmployee === "all" ? employees : employees.filter((u) => u.id === selectedEmployee)).map((employee) => {
                const report = reports.find((r) => r.userId === employee.id);
                const active = employee.id === editingUserId;
                return (
                  <button
                    type="button"
                    key={employee.id}
                    onClick={() => setEditingUserId(employee.id)}
                    className={`w-full rounded-2xl border p-3 text-right transition ${
                      active ? "border-emerald-300 bg-emerald-50 shadow-sm" : "border-slate-200/70 bg-white/70 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800">{employee.fullName}</span>
                      {report ? <Badge>ثبت شده</Badge> : <Badge variant="destructive">ثبت نشده</Badge>}
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">@{employee.username}</p>
                    {report && <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-slate-500">{report.reportText}</p>}
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={submit} className="flex min-w-0 flex-col gap-4 overflow-y-auto p-6 soft-scrollbar">
            {currentEmployee ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-slate-400">ویرایش گزارش</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">{currentEmployee.fullName}</h3>
                  </div>
                  {selectedEmployee === "all" && (
                    <Select value={editingUserId} onValueChange={setEditingUserId}>
                      <SelectTrigger className="w-full bg-white/80 sm:w-56"><UserRound className="size-4 text-emerald-500" /><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {employees.map((u) => <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={6000}
                  placeholder="گزارش این روز را وارد یا ویرایش کنید..."
                  className="min-h-72 flex-1 resize-y bg-white/80 text-sm leading-8"
                />
                <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-slate-400">{text.length.toLocaleString("fa-IR")} / ۶۰۰۰</p>
                    <p className="mt-1 text-[10px] text-slate-400">این دسترسی فقط برای مدیر است؛ کارمند همچنان فقط گزارش روز جاری خودش را ثبت می‌کند.</p>
                  </div>
                  <Button disabled={saving || text.trim().length < 3} className="min-w-40">
                    {saving ? <Loader2 className="animate-spin" /> : <Save />} ذخیره گزارش
                  </Button>
                </div>
              </>
            ) : (
              <Empty text="کارمند فعالی برای ثبت گزارش وجود ندارد." />
            )}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SyncDialog({
  configured,
  syncing,
  onSync,
  wide = false,
}: {
  configured: boolean;
  syncing: boolean;
  onSync: () => Promise<void>;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);

  async function confirm() {
    await onSync();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={wide ? "default" : "outline"} className={wide ? "w-full" : ""} disabled={!configured || syncing}>
          {syncing ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} همگام‌سازی با Sheet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>همگام‌سازی اطلاعات با Google Sheet؟</DialogTitle>
          <DialogDescription>
            اطلاعات PostgreSQL روی Tab مجزای هر کارمند بازنویسی می‌شود. چون این Spreadsheet مخصوص گزارش روزانه است، Tabهای غیرمرتبط با کارمندان تأییدشده، از جمله Tabهای قدیمی «کارمندان»، «گزارش‌ها»، «همگام‌سازی» و Sheet1—حذف می‌شوند و اطلاعات از Sheet به دیتابیس Import نخواهد شد.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
          اگر کسی داده‌های Tab یک کارمند را مستقیماً تغییر داده باشد، تغییرات دستی در Sync بعدی با نسخه دیتابیس جایگزین می‌شوند.
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={syncing}>انصراف</Button>
          <Button onClick={confirm} disabled={syncing}>{syncing ? <Loader2 className="animate-spin" /> : <CloudUpload />} شروع همگام‌سازی</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoBox({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Database }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/60 p-4">
      <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Icon className="size-5" /></div>
      <div><p className="text-[11px] text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{value}</p></div>
    </div>
  );
}

function SyncRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span><span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tehran" }).format(new Date(value));
}

function AdminStat({
  icon: Icon,
  label,
  value,
  helper,
  warning = false,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  helper: string;
  warning?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex size-11 items-center justify-center rounded-2xl ${warning ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}><Icon className="size-5" /></div>
        <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">{typeof value === "number" ? value.toLocaleString("fa-IR") : value}</p><p className="mt-1 text-[10px] text-slate-400">{helper}</p></div>
      </CardContent>
    </Card>
  );
}

function Loading() {
  return <div className="flex h-52 items-center justify-center text-sm text-slate-400"><Loader2 className="ml-2 size-4 animate-spin" /> در حال دریافت اطلاعات...</div>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center text-sm text-slate-400">
      <Check className="mb-3 size-6 text-emerald-500" />{text}
    </div>
  );
}
