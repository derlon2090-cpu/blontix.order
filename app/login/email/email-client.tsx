"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { AccessFrame } from "../access-frame";

export default function EmailClient() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (blocked) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/access/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }), cache: "no-store", referrerPolicy: "no-referrer" });
      const data = await response.json() as { next?: string; error?: string; blocked?: boolean };
      setEmail("");
      if (data.blocked) { setBlocked(true); throw new Error(data.error); }
      if (!response.ok || data.next !== '/login/2fa') throw new Error(data.error || "تعذر تسجيل الدخول. تحقق من البيانات المدخلة.");
      window.location.assign('/login/2fa');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تسجيل الدخول.");
      setEmail("");
    } finally { setLoading(false); }
  }

  return <AccessFrame step={2} title="تأكيد البريد الإلكتروني" subtitle="أدخل البريد المرتبط بحسابك لإكمال الدخول">
    <form onSubmit={submit} className="access-form">
      <Label htmlFor="admin-email">البريد الإلكتروني</Label>
      <Input id="admin-email" type="email" inputMode="email" autoComplete="username" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} disabled={blocked || loading} placeholder="name@example.com" />
      {blocked && <p role="alert" className="access-alert">تم حظر هذا المتصفح بعد ثلاث محاولات فاشلة. تواصل مع مسؤول المنصة.</p>}
      {!blocked && error && <p role="alert" className="access-alert">{error}</p>}
      <Button type="submit" disabled={blocked || loading} className="access-submit">{loading ? <Loader2 className="animate-spin" /> : <Mail />} متابعة إلى المصادقة الثنائية</Button>
      <a href="/login" className="access-back"><ArrowRight className="size-4" /> العودة إلى رمز التفعيل</a>
    </form>
  </AccessFrame>;
}
