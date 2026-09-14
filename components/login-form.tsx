"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LogIn, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("fardad_username");
    if (saved) setUsername(saved);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "ورود ناموفق بود.");
      if (remember) localStorage.setItem("fardad_username", username); else localStorage.removeItem("fardad_username");
      router.replace(data.user.role === "ADMIN" ? "/admin" : "/dashboard");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "خطایی رخ داد."); }
    finally { setLoading(false); }
  }

  return (
    <Card className="bg-white/65">
      <CardContent className="p-6 sm:p-7">
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username">نام کاربری</Label>
            <div className="relative">
              <UserRound className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="مثلاً ali.rezaei" className="pr-10" autoComplete="username" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">رمز عبور</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رمز عبور" className="pl-10" autoComplete="current-password" required />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700" aria-label="نمایش رمز عبور">
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-emerald-500" />
              نام کاربری را به خاطر بسپار
            </label>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">ورود امن</span>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-6 text-red-700">{error}</div>}

          <Button className="w-full" size="lg" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
            ورود به سامانه
          </Button>

          <div className="text-center text-sm text-slate-500">
            حساب ندارید؟ <Link href="/register" className="font-semibold text-emerald-600 hover:text-emerald-700">درخواست عضویت</Link>
          </div>

          {process.env.NODE_ENV !== "production" && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-3 text-xs leading-6 text-slate-500">
              حالت دمو: <b>admin / Admin@123</b> یا <b>employee / Demo@123</b>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
