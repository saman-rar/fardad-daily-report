"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function RegisterForm() {
  const [form, setForm] = useState({ fullName: "", username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "ثبت نام انجام نشد.");
      setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : "خطایی رخ داد."); }
    finally { setLoading(false); }
  }

  if (done) return (
    <Card className="bg-white/70"><CardContent className="p-7 text-center">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600"><CheckCircle2 className="size-7" /></div>
      <h3 className="text-lg font-bold text-slate-900">درخواست شما ثبت شد</h3>
      <p className="mt-2 text-sm leading-7 text-slate-500">پس از تأیید مدیر سامانه، حساب شما فعال می‌شود و می‌توانید وارد شوید.</p>
      <Button asChild className="mt-5 w-full" variant="secondary"><Link href="/login">بازگشت به صفحه ورود</Link></Button>
    </CardContent></Card>
  );

  return (
    <Card className="bg-white/65"><CardContent className="p-6 sm:p-7">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label>نام و نام خانوادگی</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="نام کامل" required /></div>
        <div className="space-y-2"><Label>نام کاربری</Label><Input dir="ltr" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="ali.rezaei" required /></div>
        <div className="space-y-2"><Label>رمز عبور</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="حداقل ۸ کاراکتر" required /></div>
        <p className="text-xs leading-6 text-slate-500">حساب جدید ابتدا در وضعیت «در انتظار تأیید» قرار می‌گیرد و فقط مدیر می‌تواند آن را فعال کند.</p>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Button size="lg" className="w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <UserPlus />} ثبت درخواست عضویت</Button>
        <div className="text-center text-sm text-slate-500">قبلاً حساب دارید؟ <Link href="/login" className="font-semibold text-emerald-600">ورود</Link></div>
      </form>
    </CardContent></Card>
  );
}
