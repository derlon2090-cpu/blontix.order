import { env } from "cloudflare:workers";
import { DIGITAL_POLICY, CUSTOMER_DECLARATION, WARRANTY_TEXT, canonicalStringify, maskPhone, sha256Bytes, sha256Hex, type OrderSnapshot } from "@/lib/order-document";
import { generateOrderPdf } from "@/lib/pdf";
import { auditHash, secureToken, verificationId } from "@/lib/security";
import { signPdfWithManagedService } from "@/lib/signing";

function clean(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} مطلوب.`);
  return text;
}

function requireActor(request: Request) {
  const actorId = request.headers.get("oai-authenticated-user-id");
  if (!actorId) throw new Error("AUTH_REQUIRED");
  return actorId;
}

function publicRow(row: Record<string, unknown>) {
  return {
    id: row.id, orderNumber: row.order_number, customerName: row.customer_name,
    maskedPhone: row.masked_phone, productName: row.product_name, price: row.price,
    orderApprovedAt: row.order_approved_at, deliveredAt: row.delivered_at,
    deliveryMethod: row.delivery_method, status: row.lifecycle_status || row.status,
    documentReference: row.document_reference, documentVersion: row.document_version,
    termsVersion: row.terms_version, snapshotHash: row.snapshot_hash, pdfSha256: row.pdf_sha256,
    verificationId: row.verification_id, templateVersion: row.template_version,
    signatureStatus: row.signature_status, timestampStatus: row.timestamp_status,
    createdAt: row.created_at, generatedAt: row.generated_at,
  };
}

export async function GET(request: Request) {
  try {
    requireActor(request);
    if (!env.DB) throw new Error("قاعدة البيانات غير متاحة.");
    const result = await env.DB.prepare(
      "SELECT id, order_number, customer_name, masked_phone, product_name, price, order_approved_at, delivered_at, delivery_method, status, lifecycle_status, document_reference, document_version, terms_version, snapshot_hash, pdf_sha256, verification_id, template_version, signature_status, timestamp_status, created_at, generated_at FROM order_documents ORDER BY created_at DESC LIMIT 100"
    ).all();
    return Response.json({ documents: result.results.map((row) => publicRow(row as Record<string, unknown>)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحميل المستندات.";
    return Response.json({ error: message === "AUTH_REQUIRED" ? "يلزم تسجيل الدخول لعرض لوحة المستندات." : message }, { status: message === "AUTH_REQUIRED" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  let imageKey = "";
  let pdfKey = "";
  try {
    const actorId = requireActor(request);
    if (!env.DB || !env.BUCKET) throw new Error("خدمة الحفظ غير متاحة حاليًا.");
    const form = await request.formData();
    const idempotencyKey = clean(form.get("idempotencyKey"), "مفتاح العملية");
    const duplicate = await env.DB.prepare(
      "SELECT id, order_number, customer_name, masked_phone, product_name, price, order_approved_at, delivered_at, delivery_method, lifecycle_status, document_reference, document_version, terms_version, snapshot_hash, pdf_sha256, verification_id, template_version, signature_status, timestamp_status, created_at, generated_at FROM order_documents WHERE idempotency_key = ?"
    ).bind(idempotencyKey).first<Record<string, unknown>>();
    if (duplicate) return Response.json({ document: publicRow(duplicate), idempotent: true });

    const image = form.get("image");
    if (!(image instanceof File) || image.size === 0) throw new Error("صورة وصف المنتج مطلوبة.");
    if (!["image/png", "image/jpeg"].includes(image.type)) throw new Error("الصورة يجب أن تكون PNG أو JPEG.");
    if (image.size > 8 * 1024 * 1024) throw new Error("حجم الصورة يجب ألا يتجاوز 8 ميجابايت.");

    const orderNumber = clean(form.get("orderNumber"), "رقم الطلب").replace(/^#/, "");
    const customerPhone = clean(form.get("customerPhone"), "رقم الجوال");
    const phoneDigits = customerPhone.replace(/\D/g, "");
    if (phoneDigits.length < 9 || phoneDigits.length > 15) throw new Error("رقم الجوال يجب أن يكون بين 9 و15 رقمًا.");
    const productName = clean(form.get("productName"), "المنتج");
    const price = clean(form.get("price"), "السعر");
    const orderApprovedAt = clean(form.get("orderApprovedAt"), "تاريخ الطلب والموافقة");
    const deliveredAt = clean(form.get("deliveredAt"), "تاريخ التسليم");
    if (Number.isNaN(Date.parse(orderApprovedAt)) || Number.isNaN(Date.parse(deliveredAt))) throw new Error("صيغة التاريخ غير صحيحة.");
    if (Date.parse(deliveredAt) < Date.parse(orderApprovedAt)) throw new Error("وقت التسليم لا يمكن أن يسبق وقت الموافقة.");

    const latest = await env.DB.prepare(
      "SELECT id, document_version, document_reference FROM order_documents WHERE order_number = ? ORDER BY document_version DESC LIMIT 1"
    ).bind(orderNumber).first<{ id: string; document_version: number; document_reference: string }>();
    const reissueReason = typeof form.get("reissueReason") === "string" ? String(form.get("reissueReason")).trim() : "";
    if (latest && !reissueReason) {
      return Response.json({
        error: "يوجد مستند معتمد لهذا الطلب بالفعل. أدخل سبب إنشاء إصدار جديد إذا كان التصحيح مقصودًا.",
        existingDocumentId: latest.id,
        existingReference: latest.document_reference,
      }, { status: 409 });
    }

    const documentVersion = Number(latest?.document_version ?? 0) + 1;
    const safeOrder = orderNumber.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
    if (!safeOrder) throw new Error("رقم الطلب غير صالح.");
    const documentReference = `AP-ORD-${safeOrder}-V${documentVersion}`;
    const createdAt = new Date().toISOString();
    const finalizedAt = createdAt;
    const id = crypto.randomUUID();
    const token = secureToken(32);
    const verifyId = verificationId();
    const verificationUrl = `${new URL(request.url).origin}/verify/${token}`;
    const imageBytes = new Uint8Array(await image.arrayBuffer());
    const snapshot: OrderSnapshot = {
      orderNumber,
      customerName: clean(form.get("customerName"), "اسم العميل"),
      customerPhone,
      maskedPhone: maskPhone(customerPhone),
      productName,
      productId: (typeof form.get("productId") === "string" && String(form.get("productId")).trim()) || "gemini-18m",
      productSku: (typeof form.get("productSku") === "string" && String(form.get("productSku")).trim()) || "GEMINI-18M",
      price,
      currency: "SAR",
      customerDeclaration: CUSTOMER_DECLARATION,
      warrantyText: WARRANTY_TEXT,
      digitalPolicy: DIGITAL_POLICY,
      productDescriptionText: typeof form.get("productDescriptionText") === "string" ? String(form.get("productDescriptionText")).trim() : "",
      deliveryMethod: clean(form.get("deliveryMethod"), "طريقة التسليم"),
      orderApprovedAt,
      deliveredAt,
      termsVersion: (typeof form.get("termsVersion") === "string" && String(form.get("termsVersion")).trim()) || "GEMINI-18M-V1",
      descriptionVersion: (typeof form.get("descriptionVersion") === "string" && String(form.get("descriptionVersion")).trim()) || "1",
      templateVersion: "AP-DOC-V1",
      brandingVersion: "AP-BRAND-V1",
      paymentStatus: "paid",
      consentStatus: "approved",
      deliveryStatus: "delivered",
      snapshotTakenAt: createdAt,
      imageOriginalName: image.name,
      imageContentType: image.type,
      imageSha256: await sha256Bytes(imageBytes),
    };
    const snapshotJson = canonicalStringify(snapshot);
    const snapshotHash = await sha256Hex(snapshotJson);
    const unsignedPdf = await generateOrderPdf({
      snapshot, reference: documentReference, generatedAt: createdAt, imageBytes,
      origin: request.url, verificationUrl, verificationId: verifyId, documentVersion,
    });
    const signing = await signPdfWithManagedService(unsignedPdf, documentReference);
    const pdfSha256 = await sha256Bytes(signing.bytes);

    const date = new Date(createdAt);
    const prefix = `order-documents/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${safeOrder}/V${documentVersion}/${id}`;
    imageKey = `${prefix}/description-original${image.type === "image/png" ? ".png" : ".jpg"}`;
    pdfKey = `${prefix}/${documentReference}.pdf`;
    if (await env.BUCKET.head(imageKey) || await env.BUCKET.head(pdfKey)) throw new Error("تم رفض محاولة استبدال ملف Master موجود.");
    await env.BUCKET.put(imageKey, imageBytes, {
      httpMetadata: { contentType: image.type },
      customMetadata: { orderNumber, snapshotHash, immutable: "true" },
    });
    await env.BUCKET.put(pdfKey, signing.bytes, {
      httpMetadata: { contentType: "application/pdf", contentDisposition: `attachment; filename="${documentReference}.pdf"` },
      customMetadata: { documentReference, snapshotHash, pdfSha256, immutable: "true", documentVersion: String(documentVersion) },
    });

    const auditCreatedAt = new Date().toISOString();
    const auditInput = { documentId: id, eventType: "document_finalized", result: "success", actorId, previousHash: "", createdAt: auditCreatedAt };
    const eventHash = await auditHash(auditInput);
    const statements = [
      env.DB.prepare(
        `INSERT INTO order_documents (
          id, order_number, customer_name, customer_phone, masked_phone, product_name, price,
          order_approved_at, delivered_at, delivery_method, status, document_reference,
          document_version, terms_version, snapshot_json, snapshot_hash, image_key,
          image_content_type, pdf_key, created_at, generated_at, finalized_at,
          verification_token, verification_id, pdf_sha256, template_version, branding_version,
          logo_asset_sha256, lifecycle_status, supersedes_document_id, reissue_reason,
          idempotency_key, signed_at, certificate_fingerprint, certificate_serial,
          signature_status, timestamp_status, timestamp_authority_result
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'final', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, orderNumber, snapshot.customerName, customerPhone, snapshot.maskedPhone, productName, price,
        orderApprovedAt, deliveredAt, snapshot.deliveryMethod, documentReference, documentVersion,
        snapshot.termsVersion, snapshotJson, snapshotHash, imageKey, image.type, pdfKey, createdAt,
        createdAt, finalizedAt, token, verifyId, pdfSha256, snapshot.templateVersion,
        snapshot.brandingVersion, "", "final", latest?.id ?? null, reissueReason || null,
        idempotencyKey, signing.signedAt, signing.certificateFingerprint, signing.certificateSerial,
        signing.signatureStatus, signing.timestampStatus, signing.timestampAuthorityResult
      ),
      env.DB.prepare(
        "INSERT INTO document_audit_logs (id, document_id, event_type, result, actor_id, previous_hash, event_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(crypto.randomUUID(), id, auditInput.eventType, auditInput.result, actorId, "", eventHash, auditCreatedAt),
    ];
    if (latest) {
      statements.push(env.DB.prepare("UPDATE order_documents SET lifecycle_status = 'superseded' WHERE id = ? AND lifecycle_status = 'final'").bind(latest.id));
    }
    await env.DB.batch(statements);

    return Response.json({
      document: {
        id, orderNumber, customerName: snapshot.customerName, maskedPhone: snapshot.maskedPhone,
        productName, price, orderApprovedAt, deliveredAt, deliveryMethod: snapshot.deliveryMethod,
        status: "final", documentReference, documentVersion, termsVersion: snapshot.termsVersion,
        snapshotHash, pdfSha256, verificationId: verifyId, templateVersion: snapshot.templateVersion,
        signatureStatus: signing.signatureStatus, timestampStatus: signing.timestampStatus,
        createdAt, generatedAt: createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    if (env.BUCKET) {
      if (imageKey) await env.BUCKET.delete(imageKey).catch(() => undefined);
      if (pdfKey) await env.BUCKET.delete(pdfKey).catch(() => undefined);
    }
    const message = error instanceof Error ? error.message : "تعذر إنشاء المستند.";
    return Response.json({ error: message === "AUTH_REQUIRED" ? "يلزم تسجيل الدخول لاعتماد المستند." : message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 });
  }
}
