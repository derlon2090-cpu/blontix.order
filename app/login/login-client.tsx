"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, LockKeyhole } from "lucide-react";
import { AccessFrame } from "./access-frame";

export default function LoginClient() {
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/access/device", { cache: "no-store", referrerPolicy: "no-referrer" })
      .then(async (response) => {
        const data = await response.json() as { blocked?: boolean; error?: string };
        setBlocked(Boolean(data.blocked));
        setReady(response.ok);
        if (!response.ok && !data.blocked) setError(data.error || "خدمة الدخول غير متاحة مؤقتًا. يرجى التواصل مع مسؤول المنصة.");
      })
      .catch(() => setError("تعذر تجهيز الدخول. أعد تحميل الصفحة."));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!ready || blocked) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/access/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }), cache: "no-store", referrerPolicy: "no-referrer" });
      const data = await response.json() as { next?: string; error?: string; blocked?: boolean };
      setPassword("");
      if (data.blocked) { setBlocked(true); throw new Error(data.error); }
      if (!response.ok || data.next !== "/login/email") throw new Error(data.error || "تعذر تسجيل الدخول. تحقق من البيانات المدخلة.");
      window.location.assign("/login/email");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تسجيل الدخول.");
      setPassword("");
    } finally { setLoading(false); }
  }

  return <AccessFrame step={1} title="رمز تفعيل اللوحة" subtitle="فعّل مفتاحك الرقمي لتفعيل حسابك">
    <form onSubmit={submit} className="access-form">
      <Label htmlFor="access-password">رمز التفعيل</Label>
      <Input id="access-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={256} disabled={!ready || blocked || loading} placeholder="أدخل رمز التفعيل الخاص بك" />
      {blocked && <p role="alert" className="access-alert">تم حظر هذا المتصفح بعد ثلاث محاولات فاشلة. تواصل مع مسؤول المنصة.</p>}
      {!blocked && error && <p role="alert" className="access-alert">{error}</p>}
      <Button type="submit" disabled={!ready || blocked || loading} className="access-submit">{loading ? <Loader2 className="animate-spin" /> : <LockKeyhole />} متابعة إلى البريد <ArrowLeft /></Button>
    </form>
  </AccessFrame>;
}
