"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Check, Copy, Download, FileCheck2, FileSearch, Loader2, ShieldCheck, Upload, X } from "lucide-react";
import { toast, Toaster } from "sonner";

type VerificationRecord = {
  status: "original" | "superseded" | "cancelled" | "revoked" | "not_found" | "rate_limited" | "unavailable";
  documentReference?: string; orderNumber?: string; productName?: string; price?: string;
  currency?: string; documentVersion?: number; latestVersion?: number; issuedAt?: string;
  verificationId?: string; documentFingerprint?: string; snapshotFingerprint?: string;
};

const dateFormat = (value?: string) => value ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "long", timeZone: "Asia/Riyadh" }).format(new Date(value)) : "—";

function CopyValue({ value, label }: { value?: string; label: string }) {
  if (!value) return null;
  return <Button type="button" variant="ghost" size="icon-sm" aria-label={`نسخ ${label}`} onClick={async () => { await navigator.clipboard.writeText(value); toast.success(`تم نسخ ${label}`); }}><Copy /></Button>;
}

export default function VerificationClient({ token }: { token: string }) {
  const [record, setRecord] = useState<VerificationRecord | null>(null);
  const [fileResult, setFileResult] = useState<"idle" | "checking" | "match" | "mismatch" | "error">("idle");

  useEffect(() => {
    let active = true;
    fetch(`/api/verify/${encodeURIComponent(token)}`, { cache: "no-store", referrerPolicy: "no-referrer" })
      .then(async (response) => { const data = await response.json() as VerificationRecord; if (active) setRecord(data); })
      .catch(() => active && setRecord({ status: "unavailable" }));
    return () => { active = false; };
  }, [token]);

  const verifyFile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFileResult("checking");
    const response = await fetch(`/api/verify/${encodeURIComponent(token)}/file`, { method: "POST", body: new FormData(event.currentTarget), referrerPolicy: "no-referrer" });
    const data = await response.json().catch(() => ({})) as { result?: string };
    setFileResult(data.result === "match" ? "match" : data.result === "mismatch" ? "mismatch" : "error");
  };

  if (!record) return <main className="verify-page"><div className="verify-card grid place-items-center py-28"><Loader2 className="animate-spin text-[#2f6fa8]" /><p className="mt-3 text-sm text-[#64748b]">جاري التحقق من السجل…</p></div></main>;
  if (!record.documentReference) return (
    <main className="verify-page"><div className="verify-card text-center"><div className="verify-wordmark"><img src="/blontix-logo-v1.png" alt="شعار blontix" /><strong>blontix</strong></div><div className="mx-auto mb-5 mt-8 grid size-14 place-items-center rounded-full bg-[#f1f5f9] text-[#64748b]"><FileSearch /></div><h1 className="text-2xl font-bold text-[#22384a]">{record.status === "revoked" ? "تم إلغاء رابط التحقق" : "لم يتم العثور على مستند مطابق"}</h1><p className="mt-3 text-[#64748b]">{record.status === "rate_limited" ? "تم تجاوز الحد المؤقت لمحاولات التحقق. حاول بعد دقيقة." : record.status === "revoked" ? "هذا الرابط لم يعد صالحًا. استخدم رمز QR الموجود في أحدث نسخة صادرة." : "تأكد من أن رابط التحقق كامل وأنه على النطاق الرسمي للمنصة."}</p></div></main>
  );

  const state = record.status === "original"
    ? { icon: Check, title: "أصلي ومعتمد", note: "المستند الحالي المسجل", color: "green" }
    : record.status === "superseded"
      ? { icon: AlertTriangle, title: "إصدار سابق", note: `يوجد إصدار أحدث V${record.latestVersion}`, color: "orange" }
      : { icon: X, title: "ملغي", note: "لا يُستخدم كإصدار حالي", color: "red" };
  const StateIcon = state.icon;
  const details = [
    ["رقم المستند", record.documentReference, "reference"], ["رقم الطلب", `#${record.orderNumber}`, ""],
    ["المنتج", record.productName, ""], ["المبلغ المدفوع", `${record.price} ر.س`, ""],
    ["تاريخ الإصدار", dateFormat(record.issuedAt), ""], ["الإصدار", `V${record.documentVersion}`, ""],
    ["معرف التحقق", record.verificationId, "verification"], ["حالة المستند", state.title, ""],
  ];

  return (
    <main className="verify-page" dir="rtl">
      <Toaster richColors position="top-center" />
      <div className="verify-card">
        <header className="verify-header"><div className="verify-wordmark"><img src="/blontix-logo-v1.png" alt="شعار blontix" /><strong>blontix</strong></div><div><h1>التحقق من أصالة المستند</h1><p>السجل الإلكتروني الرسمي للمستندات</p></div></header>
        <section className={`verify-state verify-state-${state.color}`}><StateIcon className="size-8" /><div><h2>{state.title}</h2><p>{state.note}</p></div></section>
        <section className="verify-grid">{details.map(([label, value, copyType]) => <div key={label}><small>{label}</small><span className="verify-value"><strong>{value}</strong>{copyType === "reference" && <CopyValue value={record.documentReference} label="رقم المستند" />}{copyType === "verification" && <CopyValue value={record.verificationId} label="معرف التحقق" />}</span></div>)}</section>
        <section className="verify-found"><FileCheck2 /><div><strong>تم العثور على هذا المستند في سجل المستندات الإلكتروني للمتجر.</strong><p>يمكن مقارنة البيانات الظاهرة هنا بالبيانات الموجودة في ملف PDF للتحقق من عدم التلاعب بالمحتوى.</p></div></section>
        <section className="fingerprint-box"><ShieldCheck /><div><p>بصمة ملف PDF الأصلي</p><code>{record.documentFingerprint}</code><span>تمثيل مختصر من SHA-256 للنسخة الأصلية المخزنة.</span><p className="mt-3">بصمة بيانات المستند</p><code>{record.snapshotFingerprint}</code><span>هذه هي البصمة المطبوعة داخل المستند؛ تختلف عن بصمة ملف PDF النهائي.</span></div></section>
        <Button asChild className="verify-master-download"><a href={`/api/verify/${encodeURIComponent(token)}/master`} referrerPolicy="no-referrer"><Download /> تحميل النسخة الأصلية</a></Button>
        <section className="verify-upload">
          <div><h2>تحقق من ملف لديك</h2><p>ارفع ملف PDF للتحقق مما إذا كان مطابقًا تمامًا للنسخة الأصلية المسجلة.</p></div>
          <form onSubmit={verifyFile} className="mt-4 flex flex-col gap-3 sm:flex-row"><Input type="file" name="file" accept="application/pdf" required /><Button disabled={fileResult === "checking"} className="bg-[#0b2f55]">{fileResult === "checking" ? <Loader2 className="animate-spin" /> : <Upload />} تحقق من الملف</Button></form>
          {fileResult === "match" && <p className="verify-result success">✓ الملف مطابق تمامًا للنسخة الأصلية.</p>}
          {fileResult === "mismatch" && <p className="verify-result danger">⚠ الملف لا يطابق النسخة الأصلية المسجلة. قد يكون الملف قد تم تعديله أو أنه نسخة مختلفة.</p>}
          {fileResult === "error" && <p className="verify-result danger">تعذر فحص الملف. تأكد أنه PDF وألا يتجاوز 15 ميجابايت.</p>}
        </section>
        <footer className="verify-domain">تأكد دائمًا أن هذه الصفحة مفتوحة على النطاق الرسمي للمنصة. لا تعتمد على شكل ملف PDF أو رمز QR وحدهما.</footer>
      </div>
    </main>
  );
}
