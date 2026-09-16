"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CUSTOMER_DECLARATION, DIGITAL_POLICY, WARRANTY_TEXT, type OrderDocumentRow } from "@/lib/order-document";
import { Check, Copy, Download, Eye, FileCheck2, FileText, History, ImageUp, Loader2, LockKeyhole, LogOut, Plus, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { toast, Toaster } from "sonner";

type PreviewData = {
  orderNumber: string; customerName: string; customerPhone: string; productName: string; price: string;
  orderApprovedAt: string; deliveredAt: string; deliveryMethod: string; imageUrl: string;
};

const formatDate = (value: string) => new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const statusText: Record<OrderDocumentRow["status"], string> = { draft: "مسودة", generated: "تم الإنشاء", final: "أصلي ومعتمد", superseded: "إصدار سابق", cancelled: "ملغي" };
const nowLocal = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

function PdfSheet({ data, reference = "bl-ORD-000000-V1" }: { data: PreviewData; reference?: string }) {
  const info = [
    ["رقم الطلب", `#${data.orderNumber || "000000"}`], ["تاريخ الطلب والموافقة", data.orderApprovedAt ? formatDate(data.orderApprovedAt) : "—"],
    ["المنتج", data.productName || "Google Gemini – رابط تفعيل عرض 18 شهرًا"], ["السعر المدفوع", `${data.price || "24.99"} ر.س`],
    ["اسم العميل", data.customerName || "اسم العميل"], ["رقم الجوال", data.customerPhone || "0551234821"],
    ["حالة الدفع والموافقة", "مدفوع · تمت الموافقة ✓"], ["حالة التسليم", "تم التسليم ✓"],
  ];
  return (
    <article className="pdf-sheet" dir="rtl">
      <header className="pdf-header">
        <div className="pdf-logo"><img src="/blontix-logo-v1.png" alt="شعار blontix" /></div>
        <div className="pdf-title"><h2>إقرار شراء وتسليم منتج رقمي</h2><p>تاريخ الإصدار: {formatDate(new Date().toISOString())}</p></div>
        <strong className="pdf-reference">{reference}</strong>
      </header>
      <div className="pdf-blue-line" />
      <section className="pdf-info-grid">{info.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</section>
      {[
        ["إقرار العميل", CUSTOMER_DECLARATION],
        ["توضيح الضمان", WARRANTY_TEXT],
        ["سياسة المنتج الرقمي", DIGITAL_POLICY],
      ].map(([title, text]) => <section className="pdf-legal" key={title}><h3>{title}</h3><p>«{text}»</p></section>)}
      <section className="pdf-delivery">
        <strong>حالة التسليم: تم التسليم ✓</strong><span>طريقة التسليم: {data.deliveryMethod || "واتساب"}</span><span>تاريخ ووقت التسليم: {data.deliveredAt ? formatDate(data.deliveredAt) : "—"}</span>
      </section>
      <section className="pdf-description">
        <h3>الوصف الذي كان ظاهرًا للعميل وقت الشراء</h3>
        <div className="pdf-image-frame">{data.imageUrl ? <img src={data.imageUrl} alt="صورة وصف المنتج وقت الشراء" /> : <div className="pdf-image-placeholder"><ImageUp /><span>ستظهر صورة الوصف هنا دون قص</span></div>}</div>
      </section>
      <footer className="pdf-footer">
        <p>هذا المستند تم إنشاؤه إلكترونيًا لتوثيق بيانات الطلب والشروط التي وافق عليها العميل قبل إتمام عملية الشراء.</p>
        <div><span>Document Reference: {reference}</span><span>تاريخ ووقت الإنشاء: {formatDate(new Date().toISOString())}</span></div>
      </footer>
    </article>
  );
}

export default function OrderDocumentsClient() {
  const [documents, setDocuments] = useState<OrderDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadError, setLoadError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const [snapshotMeta, setSnapshotMeta] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingForm, setPendingForm] = useState<FormData | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEvents, setAuditEvents] = useState<Array<Record<string, unknown>>>([]);
  const [reissueDoc, setReissueDoc] = useState<OrderDocumentRow | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData>({ orderNumber: "", customerName: "", customerPhone: "0551234821", productName: "Google Gemini – رابط تفعيل عرض 18 شهرًا", price: "24.99", orderApprovedAt: nowLocal(), deliveredAt: nowLocal(), deliveryMethod: "واتساب", imageUrl: "" });
  const formRef = useRef<HTMLFormElement>(null);
  const latestRequest = useRef(0);

  const loadDocuments = async (reference = searchTerm) => {
    const requestId = ++latestRequest.current;
    if (reference) setSearching(true); else setLoading(true);
    setLoadError("");
    try {
      const query = reference ? `?reference=${encodeURIComponent(reference)}` : "";
      const response = await fetch(`/api/documents${query}`, { cache: "no-store" });
      const data = await response.json() as { documents: OrderDocumentRow[]; error?: string };
      if (!response.ok) throw new Error(data.error || "تعذر تحميل المستندات.");
      if (requestId === latestRequest.current) setDocuments(data.documents);
    } catch (error) {
      if (requestId === latestRequest.current) setLoadError(error instanceof Error ? error.message : "تعذر تحميل المستندات.");
    } finally {
      if (requestId === latestRequest.current) { setLoading(false); setSearching(false); }
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDocuments(searchTerm); }, searchTerm ? 180 : 0);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "start_order_document_creation",
      title: "بدء إنشاء مستند طلب",
      description: "يفتح نموذج إنشاء مستند توثيق طلب جديد في الواجهة.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async () => { setCreateOpen(true); return { opened: true }; },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const readForm = () => {
    const form = formRef.current;
    if (!form) return preview;
    const fd = new FormData(form);
    const image = fd.get("image");
    if (preview.imageUrl.startsWith("blob:")) URL.revokeObjectURL(preview.imageUrl);
    const imageUrl = image instanceof File && image.size ? URL.createObjectURL(image) : preview.imageUrl;
    return {
      orderNumber: String(fd.get("orderNumber") || ""),
      customerName: String(fd.get("customerName") || ""),
      customerPhone: String(fd.get("customerPhone") || ""),
      productName: String(fd.get("productName") || ""),
      price: String(fd.get("price") || ""),
      orderApprovedAt: String(fd.get("orderApprovedAt") || ""),
      deliveredAt: String(fd.get("deliveredAt") || ""),
      deliveryMethod: String(fd.get("deliveryMethod") || ""),
      imageUrl,
    };
  };

  const showDraftPreview = () => { setPreview(readForm()); setPreviewOpen(true); };

  const submitDocument = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("idempotencyKey", crypto.randomUUID());
    setPendingForm(form);
    setConfirmOpen(true);
  };

  const confirmSubmission = async () => {
    if (!pendingForm) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/documents", { method: "POST", body: pendingForm });
      const data = await response.json() as { document: OrderDocumentRow; error?: string };
      if (!response.ok) throw new Error(data.error || "تعذر إنشاء المستند.");
      setDocuments((items) => [data.document, ...items]);
      setCreateOpen(false);
      setConfirmOpen(false);
      setPendingForm(null);
      toast.success(`تم اعتماد ${data.document.documentReference} وحفظ ملف PDF`);
      formRef.current?.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء المستند.");
    } finally { setSubmitting(false); }
  };

  const showAudit = async (id: string) => {
    setAuditEvents([]); setAuditOpen(true);
    try {
      const response = await fetch(`/api/documents/${id}/audit`, { cache: "no-store" });
      const data = await response.json() as { events: Array<Record<string, unknown>>; error?: string };
      if (!response.ok) throw new Error(data.error);
      setAuditEvents(data.events);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحميل سجل التدقيق."); setAuditOpen(false); }
  };

  const showSnapshot = async (id: string) => {
    setSnapshot(null); setSnapshotMeta(null); setSnapshotOpen(true);
    try {
      const response = await fetch(`/api/documents/${id}`);
      const data = await response.json() as { snapshot: Record<string, unknown>; error?: string; [key: string]: unknown };
      if (!response.ok) throw new Error(data.error);
      setSnapshot(data.snapshot);
      setSnapshotMeta(data);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحميل Snapshot."); setSnapshotOpen(false); }
  };

  const openPdf = (id: string) => { setPdfUrl(`/api/documents/${id}/pdf`); setPdfOpen(true); };

  const copyVerification = async (url?: string) => {
    if (!url) return toast.error("رابط التحقق غير متاح لهذا الإصدار.");
    await navigator.clipboard.writeText(url);
    toast.success("تم نسخ رابط التحقق.");
  };

  const logout = async () => { await fetch("/api/access/logout", { method: "POST" }); window.location.assign("/login"); };

  const cancelDocument = async () => {
    if (!cancelId) return;
    const response = await fetch(`/api/documents/${cancelId}/cancel`, { method: "POST" });
    const data = await response.json() as { error?: string };
    if (!response.ok) return toast.error(data.error || "تعذر إلغاء المستند.");
    setCancelId(null); await loadDocuments(); toast.success("تم إلغاء هذا الإصدار مع الاحتفاظ بنسخته الأصلية.");
  };

  return (
    <main className="min-h-screen bg-[#f3f7fb]" dir="rtl">
      <Toaster richColors position="top-center" />
      <header className="border-b border-[#dbe5ef] bg-white">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-5 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-white"><img src="/blontix-logo-v1.png" alt="شعار blontix" className="size-10 object-contain" /></div>
            <div><p className="text-lg font-bold text-[#0b2f55]">blontix</p><p className="text-sm text-[#64748b]">مستندات توثيق الطلبات</p></div>
          </div>
          <div className="flex items-center gap-2"><Button variant="outline" onClick={() => void logout()}><LogOut /> تسجيل الخروج</Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button onClick={() => setReissueDoc(null)} className="h-10 rounded-lg bg-[#0b2f55] px-5 hover:bg-[#123f6d]"><Plus /> إنشاء مستند جديد</Button></DialogTrigger>
            <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-[#d5e1ec] p-0" dir="rtl">
              <DialogHeader className="border-b border-[#e1eaf2] px-6 py-5 text-right">
                <DialogTitle className="text-xl text-[#0b2f55]">إنشاء مستند طلب</DialogTitle>
                <DialogDescription>تُحفظ هذه البيانات كنسخة Snapshot مستقلة وتصبح غير قابلة للتعديل بعد الاعتماد.</DialogDescription>
              </DialogHeader>
              <form key={reissueDoc?.id ?? "new"} ref={formRef} onSubmit={submitDocument} className="grid gap-5 px-6 pb-6 sm:grid-cols-2">
                <Field label="رقم الطلب"><Input name="orderNumber" placeholder="45821" defaultValue={reissueDoc?.orderNumber} required /></Field>
                <Field label="اسم العميل"><Input name="customerName" placeholder="اسم العميل" defaultValue={reissueDoc?.customerName} required /></Field>
                <Field label="رقم الجوال"><Input name="customerPhone" inputMode="tel" placeholder="0551234821" required /><p className="mt-1 text-xs text-[#64748b]">سيظهر الرقم كاملًا داخل PDF، ولن يظهر في صفحة التحقق العامة.</p></Field>
                <Field label="المنتج"><Input name="productName" defaultValue={reissueDoc?.productName ?? "Google Gemini – رابط تفعيل عرض 18 شهرًا"} required /></Field>
                <Field label="السعر المدفوع"><div className="relative"><Input name="price" defaultValue={reissueDoc?.price ?? "24.99"} inputMode="decimal" className="pl-14" required /><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#64748b]">ر.س</span></div></Field>
                <Field label="طريقة التسليم"><Input name="deliveryMethod" defaultValue="واتساب" required /></Field>
                <Field label="تاريخ ووقت الطلب والموافقة"><Input type="datetime-local" name="orderApprovedAt" defaultValue={nowLocal()} required /></Field>
                <Field label="تاريخ ووقت التسليم"><Input type="datetime-local" name="deliveredAt" defaultValue={nowLocal()} required /></Field>
                <Field label="إصدار الشروط"><Input name="termsVersion" defaultValue="1" required /></Field>
                <Field label="سبب إصدار نسخة جديدة"><Input name="reissueReason" placeholder="يُطلب فقط إذا كان للطلب إصدار سابق" defaultValue={reissueDoc ? "تصحيح بيانات المستند السابق" : ""} /></Field>
                <Field label="صورة وصف المنتج"><Input type="file" name="image" accept="image/png,image/jpeg" required className="file:ml-3 file:rounded-md file:border-0 file:bg-[#edf6fc] file:px-3 file:py-1 file:text-[#245b8a]" /><p className="mt-1 text-xs text-[#64748b]">PNG أو JPEG بحد أقصى 8 ميجابايت، وتُحفظ النسخة الأصلية.</p></Field>
                <Field label="وصف المنتج النصي وقت الشراء" className="sm:col-span-2"><Textarea name="productDescriptionText" placeholder="اختياري — يُحفظ داخل Snapshot التاريخي." rows={3} /></Field>
                <div className="rounded-lg border border-[#cfe0ef] bg-[#f1f7fc] p-4 sm:col-span-2">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-[#0b2f55]"><LockKeyhole className="size-4" /> بيانات ثابتة تُملأ تلقائيًا</div>
                  <p className="text-sm leading-6 text-[#52677a]">إقرار العميل، توضيح الضمان، سياسة المنتج الرقمي، حالة الدفع والموافقة والتسليم. تُخزّن جميعها حرفيًا داخل Snapshot المستند.</p>
                </div>
                <DialogFooter className="gap-2 border-t border-[#e1eaf2] pt-5 sm:col-span-2 sm:justify-start">
                  <Button type="submit" disabled={submitting} className="bg-[#0b2f55] hover:bg-[#123f6d]">{submitting ? <Loader2 className="animate-spin" /> : <FileCheck2 />} اعتماد وإنشاء PDF</Button>
                  <Button type="button" variant="outline" onClick={showDraftPreview}><Eye /> معاينة المستند</Button>
                </DialogFooter>
              </form>
              <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader className="text-right sm:text-right">
                    <AlertDialogTitle className="text-[#0b2f55]">تأكيد اعتماد المستند النهائي</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2 text-right leading-7">
                      <span className="block">بعد الاعتماد سيُنشأ Snapshot وPDF نهائيان برقم إصدار مستقل، ولن يمكن استبدال النسخة الأصلية.</span>
                      <span className="block">✓ راجعت بيانات الطلب والعميل والسعر والتواريخ.</span>
                      <span className="block">✓ صورة وصف المنتج هي النسخة التي ظهرت وقت الشراء.</span>
                      <span className="block">✓ أفهم أن أي تصحيح لاحق سينشئ إصدارًا جديدًا.</span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="sm:justify-start">
                    <AlertDialogAction onClick={() => void confirmSubmission()} disabled={submitting} className="bg-[#0b2f55] hover:bg-[#123f6d]">{submitting ? <Loader2 className="animate-spin" /> : <FileCheck2 />} اعتماد نهائي</AlertDialogAction>
                    <AlertDialogCancel disabled={submitting}>العودة للمراجعة</AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1480px] px-5 py-7 lg:px-10">
        <div className="mb-6"><h1 className="text-2xl font-bold tracking-tight text-[#12263a] sm:text-3xl">مستندات الطلبات</h1><p className="mt-2 text-base text-[#64748b]">أنشئ المستند، راجع بياناته، ثم حمّل النسخة الأصلية لإرسالها للعميل.</p></div>
        <div className="mb-5 rounded-xl border border-[#dbe5ef] bg-white p-4 sm:p-5">
          <Label htmlFor="document-reference-search" className="mb-2 block font-semibold text-[#12263a]">البحث بالرقم المرجعي للمستند</Label>
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-[#64748b]" />
            <Input id="document-reference-search" dir="ltr" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="bl-ORD-45821-V1" className="h-11 px-11 text-left font-mono" autoComplete="off" />
            {searchTerm && <button type="button" onClick={() => setSearchTerm("")} aria-label="مسح البحث" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#64748b] hover:bg-[#edf6fc]"><X className="size-4" /></button>}
          </div>
          <p className="mt-2 text-xs text-[#64748b]">تظهر النتائج مباشرة أثناء كتابة الرقم المرجعي، بما فيها الإصدارات السابقة.</p>
        </div>
        {loadError && <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#f0c8c3] bg-[#fff5f4] p-4 text-sm text-[#9f2d23]"><span>{loadError}</span><Button variant="outline" size="sm" onClick={() => void loadDocuments()}><RefreshCw /> إعادة المحاولة</Button></div>}
        <div className="overflow-hidden rounded-xl border border-[#dbe5ef] bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-[#e5edf5] px-5 py-4"><div><h2 className="font-bold text-[#12263a]">سجل المستندات</h2><p className="mt-1 text-sm text-[#64748b]">الملفات المعتمدة وبيانات الـ Snapshot المرتبطة بها</p></div>{searching && <span className="flex items-center gap-2 text-xs text-[#64748b]"><Loader2 className="size-4 animate-spin" /> بحث…</span>}</div>
          {loading ? <div className="grid place-items-center py-20 text-[#64748b]"><Loader2 className="mb-3 animate-spin" /> جاري تحميل السجل…</div> : documents.length === 0 ? (
            <div className="grid place-items-center px-5 py-20 text-center"><div className="mb-4 grid size-12 place-items-center rounded-xl bg-[#edf6fc] text-[#2f6fa8]"><FileText /></div><h3 className="font-bold text-[#12263a]">{searchTerm ? "لم نجد مستندًا بهذا الرقم المرجعي" : "لا توجد مستندات بعد"}</h3><p className="mt-2 text-sm text-[#64748b]">{searchTerm ? "راجع الرقم المرجعي أو اكتب جزءًا منه للبحث." : "أنشئ أول مستند طلب وسيظهر هنا مع ملفه المعتمد."}</p>{!searchTerm && <Button onClick={() => setCreateOpen(true)} className="mt-5 bg-[#0b2f55]"><Plus /> إنشاء مستند طلب</Button>}</div>
          ) : <div className="overflow-x-auto"><Table>
            <TableHeader className="bg-[#f7fafc]"><TableRow>{["رقم الطلب","العميل","المنتج","السعر","التاريخ","الحالة","الإصدار","الإجراءات"].map((head) => <TableHead key={head} className="h-12 px-4 text-right text-[#475569]">{head}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{documents.map((doc) => <TableRow key={doc.id} className="hover:bg-[#f8fbfe]">
              <TableCell className="px-4 py-4 font-bold text-[#0b2f55]">#{doc.orderNumber}</TableCell><TableCell className="px-4 py-4 font-medium">{doc.customerName}</TableCell><TableCell className="max-w-[260px] truncate px-4 py-4">{doc.productName}</TableCell><TableCell className="px-4 py-4 font-mono text-sm">{doc.price} ر.س</TableCell><TableCell className="px-4 py-4 text-[#64748b]">{formatDate(doc.orderApprovedAt)}</TableCell>
              <TableCell className="px-4 py-4"><Badge className={doc.status === "final" ? "border border-[#b9dec8] bg-[#eaf8ef] text-[#17613a]" : doc.status === "cancelled" ? "border border-[#efc3c3] bg-[#fff1f1] text-[#9f2929]" : "border border-[#ead9a5] bg-[#fff9e8] text-[#7a5b10]"}><Check /> {statusText[doc.status]}</Badge></TableCell>
              <TableCell className="px-4 py-4 font-mono text-xs text-[#475569]">{doc.documentReference}<span className="mr-1 text-[#8a9aab]">V{doc.documentVersion}</span></TableCell>
              <TableCell className="px-4 py-4"><div className="flex min-w-[620px] gap-2"><Button variant="outline" size="sm" onClick={() => openPdf(doc.id)}><Eye /> عرض</Button><Button variant="outline" size="sm" asChild><a href={`/api/documents/${doc.id}/pdf?download=1`} download={`${doc.documentReference}.pdf`}><Download /> تحميل PDF</a></Button><Button variant="ghost" size="sm" onClick={() => void copyVerification(doc.verificationUrl)}><Copy /> نسخ رابط التحقق</Button><Button variant="ghost" size="sm" onClick={() => { setReissueDoc(doc); setCreateOpen(true); }}><Plus /> إنشاء V{doc.documentVersion + 1}</Button><Button variant="ghost" size="sm" onClick={() => void showSnapshot(doc.id)}>Snapshot</Button><Button variant="ghost" size="sm" onClick={() => void showAudit(doc.id)}><History /> التدقيق</Button><Button variant="ghost" size="sm" className="text-[#a23a30]" onClick={() => setCancelId(doc.id)}>إلغاء</Button></div></TableCell>
            </TableRow>)}</TableBody>
          </Table></div>}
        </div>
      </section>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}><DialogContent className="max-h-[95vh] max-w-[900px] overflow-auto bg-[#dde5ec] p-5" dir="rtl"><DialogHeader className="sr-only"><DialogTitle>معاينة المستند</DialogTitle><DialogDescription>معاينة قبل الاعتماد</DialogDescription></DialogHeader><PdfSheet data={preview} reference={preview.orderNumber ? `bl-ORD-${preview.orderNumber}-V${reissueDoc ? reissueDoc.documentVersion + 1 : 1}` : undefined} /></DialogContent></Dialog>
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}><DialogContent className="h-[94vh] max-w-5xl p-0" dir="rtl"><DialogHeader className="border-b px-5 py-4 text-right"><DialogTitle>معاينة PDF المعتمد</DialogTitle><DialogDescription>هذه هي النسخة المحفوظة نهائيًا دون إعادة إنشاء.</DialogDescription></DialogHeader>{pdfUrl && <iframe title="معاينة PDF" src={pdfUrl} className="h-full min-h-0 w-full rounded-b-lg" />}</DialogContent></Dialog>
      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" dir="rtl"><DialogHeader className="text-right"><DialogTitle className="flex items-center gap-2 text-[#0b2f55]"><LockKeyhole className="size-5" /> بيانات Snapshot</DialogTitle><DialogDescription>النسخة التاريخية التي يعتمد عليها المستند المعتمد حصريًا.</DialogDescription></DialogHeader>{!snapshot ? <div className="grid place-items-center py-16"><Loader2 className="animate-spin" /></div> : <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{Object.entries(snapshot).map(([key, value]) => <div key={key} className="rounded-lg border bg-[#f8fbfe] p-3"><p className="text-xs font-semibold text-[#60758a]">{key}</p><p className="mt-1 break-words text-sm text-[#172b3d]">{String(value || "—")}</p></div>)}</div><div className="rounded-lg border border-[#cfe0ef] bg-[#edf6fc] p-4"><p className="font-semibold text-[#0b2f55]">SHA-256</p><code className="mt-2 block break-all text-xs text-[#245b8a]">{String(snapshotMeta?.snapshotHash || "")}</code><p className="mt-3 flex items-center gap-2 text-sm text-[#315f87]"><LockKeyhole className="size-4" /> Snapshot معتمد للقراءة فقط — الإصدار {String(snapshotMeta?.documentVersion || "")}</p></div></div>}</DialogContent></Dialog>
      <Dialog open={auditOpen} onOpenChange={setAuditOpen}><DialogContent className="max-w-2xl" dir="rtl"><DialogHeader className="text-right"><DialogTitle className="flex items-center gap-2 text-[#0b2f55]"><History className="size-5" /> سجل التدقيق</DialogTitle><DialogDescription>سلسلة أحداث مترابطة ببصمات SHA-256، للقراءة فقط.</DialogDescription></DialogHeader>{auditEvents.length === 0 ? <div className="grid place-items-center py-12"><Loader2 className="animate-spin" /></div> : <div className="max-h-[55vh] space-y-3 overflow-y-auto">{auditEvents.map((event) => <div key={String(event.id)} className="rounded-lg border bg-[#f8fbfe] p-3"><div className="flex justify-between gap-3"><strong className="text-sm text-[#18354f]">{String(event.event_type)}</strong><span className="text-xs text-[#64748b]">{formatDate(String(event.created_at))}</span></div><code className="mt-2 block break-all text-[11px] text-[#416784]">{String(event.event_hash)}</code></div>)}</div>}</DialogContent></Dialog>
      <AlertDialog open={Boolean(cancelId)} onOpenChange={(open) => !open && setCancelId(null)}><AlertDialogContent dir="rtl"><AlertDialogHeader className="text-right"><AlertDialogTitle>إلغاء هذا الإصدار؟</AlertDialogTitle><AlertDialogDescription>ستظهر حالة «ملغي» في صفحة التحقق، مع بقاء ملف PDF الأصلي محفوظًا للتدقيق.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="sm:justify-start"><AlertDialogAction onClick={() => void cancelDocument()} className="bg-[#a23a30]">تأكيد الإلغاء</AlertDialogAction><AlertDialogCancel>تراجع</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </main>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={className}><Label className="mb-2 block text-sm font-semibold text-[#283f53]">{label}</Label>{children}</div>;
}
