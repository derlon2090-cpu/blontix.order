export const CUSTOMER_DECLARATION =
  "أقر بأنني قرأت وصف المنتج وأفهم أن ضمان المتجر يشمل التفعيل فقط، وأوافق على الشراء وفقًا لذلك.";
export const WARRANTY_TEXT =
  "ضمان المتجر يقتصر على صلاحية رابط التفعيل ونجاح التفعيل وقت التسليم فقط، ولا يشمل ضمان استمرار الاشتراك لمدة 18 شهرًا كاملة.";
export const DIGITAL_POLICY =
  "بعد نجاح التفعيل لا يمكن استرجاع أو استبدال المنتج، مع مراعاة الحقوق التي تكفلها الأنظمة المعمول بها.";

export type OrderSnapshot = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  maskedPhone: string;
  productName: string;
  productId: string;
  productSku: string;
  price: string;
  currency: string;
  customerDeclaration: string;
  warrantyText: string;
  digitalPolicy: string;
  productDescriptionText: string;
  deliveryMethod: string;
  orderApprovedAt: string;
  deliveredAt: string;
  termsVersion: string;
  descriptionVersion: string;
  templateVersion: string;
  brandingVersion: string;
  paymentStatus: "paid";
  consentStatus: "approved";
  deliveryStatus: "delivered";
  snapshotTakenAt: string;
  imageOriginalName: string;
  imageContentType: string;
  imageSha256: string;
};

export type OrderDocumentRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  maskedPhone: string;
  productName: string;
  price: string;
  orderApprovedAt: string;
  deliveredAt: string;
  deliveryMethod: string;
  status: "draft" | "generated" | "final" | "superseded" | "cancelled";
  documentReference: string;
  documentVersion: number;
  termsVersion: string;
  snapshotHash: string;
  pdfSha256?: string;
  verificationId?: string;
  templateVersion?: string;
  signatureStatus?: string;
  timestampStatus?: string;
  createdAt: string;
  generatedAt: string;
};

export function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) throw new Error("رقم الجوال يجب أن يحتوي على 4 أرقام على الأقل.");
  return `${"*".repeat(Math.max(6, digits.length - 4))}${digits.slice(-4)}`;
}

export function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Bytes(value: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
