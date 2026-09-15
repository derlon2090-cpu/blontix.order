"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CUSTOMER_DECLARATION, DIGITAL_POLICY, WARRANTY_TEXT, type OrderDocumentRow } from "@/lib/order-document";
import { Check, Download, Eye, FileCheck2, FileText, History, ImageUp, Loader2, LockKeyhole, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { toast, Toaster } from "sonner";

type PreviewData = {
  orderNumber: string; customerName: string; maskedPhone: string; productName: string; price: string;
  orderApprovedAt: string; deliveredAt: string; deliveryMethod: string; imageUrl: string;
};

const formatDate = (value: string) => new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const statusText: Record<OrderDocumentRow["status"], string> = { draft: "مسودة", generated: "تم الإنشاء", final: "أصلي ومعتمد", superseded: "إصدار سابق", cancelled: "ملغي" };
const nowLocal = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `${"*".repeat(Math.max(6, digits.length - 4))}${digits.slice(-4)}` : "******0000";
}

function PdfSheet({ data, reference = "AP-ORD-000000" }: { data: PreviewData; reference?: string }) {
  const info = [
    ["رقم الطلب", `#${data.orderNumber || "000000"}`], ["تاريخ الطلب والموافقة", data.orderApprovedAt ? formatDate(data.orderApprovedAt) : "—"],
    ["المنتج", data.productName || "Google Gemini – رابط تفعيل عرض 18 شهرًا"], ["السعر المدفوع", `${data.price || "24.99"} ر.س`],
    ["اسم العميل", data.customerName || "اسم العميل"], ["رقم الجوال", data.maskedPhone],
    ["حالة الدفع والموافقة", "مدفوع · تمت الموافقة ✓"], ["حالة التسليم", "تم التسليم ✓"],
  ];
  return (
    <article className="pdf-sheet" dir="rtl">
      <header className="pdf-header">
        <div className="pdf-logo">AP</div>
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
  const [preview, setPreview] = useState<PreviewData>({ orderNumber: "", customerName: "", maskedPhone: "******0000", productName: "Google Gemini – رابط تفعيل عرض 18 شهرًا", price: "24.99", orderApprovedAt: nowLocal(), deliveredAt: nowLocal(), deliveryMethod: "واتساب", imageUrl: "" });
  const formRef = useRef<HTMLFormElement>(null);

  const loadDocuments = async () => {
    setLoading(true); setLoadError("");
    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحميل المستندات.");
      setDocuments(data.documents);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "تعذر تحميل المستندات.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadDocuments(); }, []);

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

  const stats = useMemo(() => ({
    all: documents.length,
    final: documents.filter((item) => item.status === "final").length,
    versions: documents.length,
  }), [documents]);

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
      maskedPhone: maskPhone(String(fd.get("customerPhone") || "")),
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
      const data = await response.json();
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAuditEvents(data.events);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحميل سجل التدقيق."); setAuditOpen(false); }
  };

  const showSnapshot = async (id: string) => {
    setSnapshot(null); setSnapshotMeta(null); setSnapshotOpen(true);
    try {
      const response = await fetch(`/api/documents/${id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSnapshot(data.snapshot);
      setSnapshotMeta(data);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحميل Snapshot."); setSnapshotOpen(false); }
  };

  const openPdf = (id: string) => { setPdfUrl(`/api/documents/${id}/pdf`); setPdfOpen(true); };

  return (
    <main className="min-h-screen bg-[#f3f7fb]" dir="rtl">
      <Toaster richColors position="top-center" />
      <header className="border-b border-[#dbe5ef] bg-white">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-5 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-[#0b2f55] text-white"><FileCheck2 className="size-5" /></div>
            <div><p className="text-lg font-bold text-[#0b2f55]">مستندات توثيق الطلبات</p><p className="text-sm text-[#64748b]">سجل المستندات القانونية المعتمدة</p></div>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button className="h-10 rounded-lg bg-[#0b2f55] px-5 hover:bg-[#123f6d]"><Plus /> إنشاء مستند طلب</Button></DialogTrigger>
            <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-[#d5e1ec] p-0" dir="rtl">
              <DialogHeader className="border-b border-[#e1eaf2] px-6 py-5 text-right">
                <DialogTitle className="text-xl text-[#0b2f55]">إنشاء مستند طلب</DialogTitle>
                <DialogDescription>تُحفظ هذه البيانات كنسخة Snapshot مستقلة وتصبح غير قابلة للتعديل بعد الاعتماد.</DialogDescription>
              </DialogHeader>
              <form ref={formRef} onSubmit={submitDocument} className="grid gap-5 px-6 pb-6 sm:grid-cols-2">
                <Field label="رقم الطلب"><Input name="orderNumber" placeholder="45821" required /></Field>
                <Field label="اسم العميل"><Input name="customerName" placeholder="اسم العميل" required /></Field>
                <Field label="رقم الجوال"><Input name="customerPhone" inputMode="tel" placeholder="0551234821" required /><p className="mt-1 text-xs text-[#64748b]">سيظهر آخر 4 أرقام فقط داخل PDF.</p></Field>
                <Field label="المنتج"><Input name="productName" defaultValue="Google Gemini – رابط تفعيل عرض 18 شهرًا" required /></Field>
                <Field label="السعر المدفوع"><div className="relative"><Input name="price" defaultValue="24.99" inputMode="decimal" className="pl-14" required /><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#64748b]">ر.س</span></div></Field>
                <Field label="طريقة التسليم"><Input name="deliveryMethod" defaultValue="واتساب" required /></Field>
                <Field label="تاريخ ووقت الطلب والموافقة"><Input type="datetime-local" name="orderApprovedAt" defaultValue={nowLocal()} required /></Field>
                <Field label="تاريخ ووقت التسليم"><Input type="datetime-local" name="deliveredAt" defaultValue={nowLocal()} required /></Field>
                <Field label="إصدار الشروط"><Input name="termsVersion" defaultValue="1" required /></Field>
                <Field label="سبب إصدار نسخة جديدة"><Input name="reissueReason" placeholder="يُطلب فقط إذا كان للطلب إصدار سابق" /></Field>
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
      </header>

      <section className="mx-auto max-w-[1480px] px-5 py-7 lg:px-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div><p className="mb-1 text-sm font-semibold text-[#2f6fa8]">التوثيق الرقمي</p><h1 className="text-2xl font-bold tracking-tight text-[#12263a] sm:text-3xl">مستندات الطلبات</h1><p className="mt-2 max-w-2xl text-base leading-7 text-[#64748b]">كل ملف PDF معتمد مرتبط بلقطة مستقلة من البيانات والصورة والشروط وقت الشراء.</p></div>
          <div className="flex items-center gap-2 rounded-lg border border-[#cfe0ef] bg-[#edf6fc] px-3 py-2 text-sm font-medium text-[#245b8a]"><ShieldCheck className="size-4" /> النسخ المعتمدة محمية من التعديل</div>
        </div>
        {loadError && <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#f0c8c3] bg-[#fff5f4] p-4 text-sm text-[#9f2d23]"><span>{loadError}</span><Button variant="outline" size="sm" onClick={() => void loadDocuments()}><RefreshCw /> إعادة المحاولة</Button></div>}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["إجمالي المستندات", stats.all, FileText], ["المستندات المعتمدة", stats.final, FileCheck2], ["الإصدارات المحفوظة", stats.versions, ShieldCheck],
          ].map(([label, value, Icon]) => <div key={String(label)} className="rounded-xl border border-[#dbe5ef] bg-white p-5"><div className="mb-3 grid size-9 place-items-center rounded-lg bg-[#edf6fc] text-[#2f6fa8]"><Icon className="size-4" /></div><p className="text-2xl font-bold text-[#0b2f55]">{String(value)}</p><p className="mt-1 text-sm text-[#64748b]">{String(label)}</p></div>)}
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-[#dbe5ef] bg-white">
          <div className="border-b border-[#e5edf5] px-5 py-4"><h2 className="font-bold text-[#12263a]">سجل المستندات</h2><p className="mt-1 text-sm text-[#64748b]">الملفات المعتمدة وبيانات الـ Snapshot المرتبطة بها</p></div>
          {loading ? <div className="grid place-items-center py-20 text-[#64748b]"><Loader2 className="mb-3 animate-spin" /> جاري تحميل السجل…</div> : documents.length === 0 ? (
            <div className="grid place-items-center px-5 py-20 text-center"><div className="mb-4 grid size-12 place-items-center rounded-xl bg-[#edf6fc] text-[#2f6fa8]"><FileText /></div><h3 className="font-bold text-[#12263a]">لا توجد مستندات بعد</h3><p className="mt-2 text-sm text-[#64748b]">أنشئ أول مستند طلب وسيظهر هنا مع ملفه المعتمد.</p><Button onClick={() => setCreateOpen(true)} className="mt-5 bg-[#0b2f55]"><Plus /> إنشاء مستند طلب</Button></div>
          ) : <Table>
            <TableHeader className="bg-[#f7fafc]"><TableRow>{["رقم الطلب","العميل","المنتج","آخر 4 أرقام","التاريخ","الحالة","الرقم المرجعي","الإجراءات"].map((head) => <TableHead key={head} className="h-12 px-4 text-right text-[#475569]">{head}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{documents.map((doc) => <TableRow key={doc.id} className="hover:bg-[#f8fbfe]">
              <TableCell className="px-4 py-4 font-bold text-[#0b2f55]">#{doc.orderNumber}</TableCell><TableCell className="px-4 py-4 font-medium">{doc.customerName}</TableCell><TableCell className="max-w-[260px] truncate px-4 py-4">{doc.productName}</TableCell><TableCell className="px-4 py-4 font-mono text-sm">{doc.maskedPhone}</TableCell><TableCell className="px-4 py-4 text-[#64748b]">{formatDate(doc.orderApprovedAt)}</TableCell>
              <TableCell className="px-4 py-4"><Badge className={doc.status === "final" ? "border border-[#b9dec8] bg-[#eaf8ef] text-[#17613a]" : doc.status === "cancelled" ? "border border-[#efc3c3] bg-[#fff1f1] text-[#9f2929]" : "border border-[#ead9a5] bg-[#fff9e8] text-[#7a5b10]"}><Check /> {statusText[doc.status]}</Badge></TableCell>
              <TableCell className="px-4 py-4 font-mono text-xs text-[#475569]">{doc.documentReference}<span className="mr-1 text-[#8a9aab]">v{doc.documentVersion}</span></TableCell>
              <TableCell className="px-4 py-4"><div className="flex min-w-[410px] gap-2"><Button variant="outline" size="sm" onClick={() => openPdf(doc.id)}><Eye /> معاينة PDF</Button><Button variant="outline" size="sm" asChild><a href={`/api/documents/${doc.id}/pdf?download=1`}><Download /> تحميل</a></Button><Button variant="ghost" size="sm" onClick={() => void showSnapshot(doc.id)}>عرض Snapshot</Button><Button variant="ghost" size="sm" onClick={() => void showAudit(doc.id)}><History /> سجل التدقيق</Button></div></TableCell>
            </TableRow>)}</TableBody>
          </Table>}
        </div>
      </section>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}><DialogContent className="max-h-[95vh] max-w-[900px] overflow-auto bg-[#dde5ec] p-5" dir="rtl"><DialogHeader className="sr-only"><DialogTitle>معاينة المستند</DialogTitle><DialogDescription>معاينة قبل الاعتماد</DialogDescription></DialogHeader><PdfSheet data={preview} reference={preview.orderNumber ? `AP-ORD-${preview.orderNumber}` : undefined} /></DialogContent></Dialog>
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}><DialogContent className="h-[94vh] max-w-5xl p-0" dir="rtl"><DialogHeader className="border-b px-5 py-4 text-right"><DialogTitle>معاينة PDF المعتمد</DialogTitle><DialogDescription>هذه هي النسخة المحفوظة نهائيًا دون إعادة إنشاء.</DialogDescription></DialogHeader>{pdfUrl && <iframe title="معاينة PDF" src={pdfUrl} className="h-full min-h-0 w-full rounded-b-lg" />}</DialogContent></Dialog>
      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" dir="rtl"><DialogHeader className="text-right"><DialogTitle className="flex items-center gap-2 text-[#0b2f55]"><LockKeyhole className="size-5" /> بيانات Snapshot</DialogTitle><DialogDescription>النسخة التاريخية التي يعتمد عليها المستند المعتمد حصريًا.</DialogDescription></DialogHeader>{!snapshot ? <div className="grid place-items-center py-16"><Loader2 className="animate-spin" /></div> : <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{Object.entries(snapshot).map(([key, value]) => <div key={key} className="rounded-lg border bg-[#f8fbfe] p-3"><p className="text-xs font-semibold text-[#60758a]">{key}</p><p className="mt-1 break-words text-sm text-[#172b3d]">{String(value || "—")}</p></div>)}</div><div className="rounded-lg border border-[#cfe0ef] bg-[#edf6fc] p-4"><p className="font-semibold text-[#0b2f55]">SHA-256</p><code className="mt-2 block break-all text-xs text-[#245b8a]">{String(snapshotMeta?.snapshotHash || "")}</code><p className="mt-3 flex items-center gap-2 text-sm text-[#315f87]"><LockKeyhole className="size-4" /> Snapshot معتمد للقراءة فقط — الإصدار {String(snapshotMeta?.documentVersion || "")}</p></div></div>}</DialogContent></Dialog>
      <Dialog open={auditOpen} onOpenChange={setAuditOpen}><DialogContent className="max-w-2xl" dir="rtl"><DialogHeader className="text-right"><DialogTitle className="flex items-center gap-2 text-[#0b2f55]"><History className="size-5" /> سجل التدقيق</DialogTitle><DialogDescription>سلسلة أحداث مترابطة ببصمات SHA-256، للقراءة فقط.</DialogDescription></DialogHeader>{auditEvents.length === 0 ? <div className="grid place-items-center py-12"><Loader2 className="animate-spin" /></div> : <div className="max-h-[55vh] space-y-3 overflow-y-auto">{auditEvents.map((event) => <div key={String(event.id)} className="rounded-lg border bg-[#f8fbfe] p-3"><div className="flex justify-between gap-3"><strong className="text-sm text-[#18354f]">{String(event.event_type)}</strong><span className="text-xs text-[#64748b]">{formatDate(String(event.created_at))}</span></div><code className="mt-2 block break-all text-[11px] text-[#416784]">{String(event.event_hash)}</code></div>)}</div>}</DialogContent></Dialog>
    </main>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={className}><Label className="mb-2 block text-sm font-semibold text-[#283f53]">{label}</Label>{children}</div>;
}
