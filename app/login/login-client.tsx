"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LockKeyhole } from "lucide-react";

export default function LoginClient() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/access/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }), cache: "no-store", referrerPolicy: "no-referrer" });
      if (!response.ok) throw new Error();
      setPassword(""); window.location.assign("/");
    } catch { setError("تعذر تسجيل الدخول. تحقق من الرقم السري."); setPassword(""); }
    finally { setLoading(false); }
  }

  return <main className="login-page" dir="rtl"><div className="login-card"><img src="/blontix-logo-v1.png" alt="شعار blontix" className="login-logo" /><h1>blontix</h1><p>مستندات توثيق الطلبات</p><form onSubmit={submit} className="mt-8 space-y-4"><div><Label htmlFor="access-password" className="mb-2 block">الرقم السري</Label><Input id="access-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={256} /></div>{error && <p role="alert" className="text-sm text-[#b42318]">{error}</p>}<Button type="submit" disabled={loading} className="w-full bg-[#0b2f55]">{loading ? <Loader2 className="animate-spin" /> : <LockKeyhole />} دخول</Button></form></div></main>;
}
