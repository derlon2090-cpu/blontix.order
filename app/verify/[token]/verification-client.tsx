"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Check, FileCheck2, FileSearch, Loader2, LockKeyhole, ShieldCheck, Upload, X } from "lucide-react";

type VerificationRecord = {
  status: "original" | "superseded" | "cancelled" | "not_found" | "rate_limited" | "unavailable";
  documentReference?: string; orderNumber?: string; productName?: string; price?: string;
  currency?: string; documentVersion?: number; latestVersion?: number; issuedAt?: string;
  maskedPhone?: string; verificationId?: string; documentFingerprint?: string;
  signatureStatus?: string; timestampStatus?: string;
};

const dateFormat = (value?: string) => value ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(value)) : "—";

export default function VerificationClient({ token }: { token: string }) {
  const [record, setRecord] = useState<VerificationRecord | null>(null);
  const [fileResult, setFileResult] = useState<"idle" | "checking" | "match" | "mismatch" | "error">("idle");
  const [privateResult, setPrivateResult] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/verify/${encodeURIComponent(token)}`, { cache: "no-store", referrerPolicy: "no-referrer" })
      .then(async (response) => {
        const data = await response.json();
        if (active) setRecord(data);
      })
      .catch(() => active && setRecord({ status: "unavailable" }));
    return () => { active = false; };
  }, [token]);

  const verifyFile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFileResult("checking");
    const response = await fetch(`/api/verify/${encodeURIComponent(token)}/file`, { method: "POST", body: new FormData(event.currentTarget), referrerPolicy: "no-referrer" });
    const data = await response.json().catch(() => ({}));
    setFileResult(data.result === "match" ? "match" : data.result === "mismatch" ? "mismatch" : "error");
  };

  const startPrivateVerification = async () => {
    setPrivateResult("loading");
    const response = await fetch(`/api/verify/${encodeURIComponent(token)}/private/start`, { method: "POST", referrerPolicy: "no-referrer" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setPrivateResult("sent");
    else setPrivateResult(data.error || "تعذر بدء التحقق الخاص.");
  };

  if (!record) return <main className="verify-page"><div className="verify-card grid place-items-center py-28"><Loader2 className="animate-spin text-[#2f6fa8]" /><p className="mt-3 text-sm text-[#64748b]">جاري التحقق من السجل…</p></div></main>;
  if (!record.documentReference) return (
    <main className="verify-page"><div className="verify-card text-center"><div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-[#f1f5f9] text-[#64748b]"><FileSearch /></div><h1 className="text-2xl font-bold text-[#22384a]">لم يتم العثور على مستند مطابق</h1><p className="mt-3 text-[#64748b]">{record.status === "rate_limited" ? "تم تجاوز الحد المؤقت لمحاولات التحقق. حاول بعد دقيقة." : "تأكد من أن رابط التحقق كامل وأنه على النطاق الرسمي للمنصة."}</p></div></main>
  );

  const state = record.status === "original"
    ? { icon: Check, title: "مستند أصلي ومسجل في النظام", note: "أصلي ومعتمد", color: "green" }
    : record.status === "superseded"
      ? { icon: AlertTriangle, title: "مستند أصلي، ويوجد إصدار أحدث", note: `الإصدار الحالي V${record.latestVersion}`, color: "orange" }
      : { icon: X, title: "تم إلغاء هذا المستند", note: "لا يُستخدم كإصدار حالي", color: "red" };
  const StateIcon = state.icon;
  const details = [
    ["Document Reference", record.documentReference], ["Version", `V${record.documentVersion}`],
    ["تاريخ الإصدار", dateFormat(record.issuedAt)], ["المنتج", record.productName],
    ["السعر المدفوع", `${record.price} ر.س`], ["حالة المستند", state.note],
    ["Verification ID", record.verificationId], ["آخر 4 أرقام", record.maskedPhone],
  ];

  return (
    <main className="verify-page" dir="rtl">
      <div className="verify-card">
        <header className="verify-header"><div className="grid size-11 place-items-center rounded-xl bg-[#0b2f55] text-white"><FileCheck2 /></div><div><p className="font-bold text-[#0b2f55]">منصة توثيق الطلبات</p><p className="text-sm text-[#64748b]">التحقق الإلكتروني من المستند</p></div></header>
        <section className={`verify-state verify-state-${state.color}`}><StateIcon className="size-7" /><div><h1>{state.title}</h1><p>{state.note}</p></div></section>
        <section className="verify-grid">{details.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</section>
        <section className="fingerprint-box"><ShieldCheck /><div><p>Document Fingerprint</p><code>{record.documentFingerprint}</code><span>بصمة مختصرة من SHA-256 للنسخة الأصلية المخزنة.</span></div></section>
        <section className="verify-upload">
          <div><h2>تحقق من ملف PDF</h2><p>ارفع النسخة الموجودة لديك لمقارنتها بالـMaster PDF. لا يُحفظ الملف المرفوع.</p></div>
          <form onSubmit={verifyFile} className="mt-4 flex flex-col gap-3 sm:flex-row"><Input type="file" name="file" accept="application/pdf" required /><Button disabled={fileResult === "checking"} className="bg-[#0b2f55]">{fileResult === "checking" ? <Loader2 className="animate-spin" /> : <Upload />} تحقق من الملف</Button></form>
          {fileResult === "match" && <p className="verify-result success">✓ هذا الملف مطابق تمامًا للنسخة الأصلية المحفوظة لدينا.</p>}
          {fileResult === "mismatch" && <p className="verify-result danger">⚠ هذا الملف لا يطابق النسخة الأصلية المسجلة لهذا المستند.</p>}
          {fileResult === "error" && <p className="verify-result danger">تعذر فحص الملف. تأكد أنه PDF وألا يتجاوز 15 ميجابايت.</p>}
        </section>
        <section className="private-verification"><LockKeyhole /><div className="flex-1"><h2>التحقق من ارتباط المستند بالعميل</h2><p>يتطلب إثبات الوصول إلى رقم الهاتف المسجل، ولا يكشف الرقم الكامل في هذه الصفحة.</p>{privateResult === "sent" && <p className="mt-2 text-sm font-semibold text-[#17613a]">تم إرسال طلب التحقق إلى الهاتف المسجل.</p>}{privateResult && !["loading","sent"].includes(privateResult) && <p className="mt-2 text-sm text-[#a23a30]">{privateResult}</p>}</div><Button variant="outline" onClick={startPrivateVerification} disabled={privateResult === "loading"}>{privateResult === "loading" ? <Loader2 className="animate-spin" /> : <ShieldCheck />} بدء التحقق الخاص</Button></section>
        <footer className="verify-domain">تأكد دائمًا أن هذه الصفحة مفتوحة على النطاق الرسمي للمنصة. لا تعتمد على شكل ملف PDF أو رمز QR وحدهما.</footer>
      </div>
    </main>
  );
}
