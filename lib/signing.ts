import { env } from "@/lib/runtime";

export type SigningResult = {
  bytes: Uint8Array;
  signatureStatus: "not_configured" | "valid";
  timestampStatus: "not_configured" | "valid";
  signedAt: string | null;
  certificateFingerprint: string | null;
  certificateSerial: string | null;
  timestampAuthorityResult: string | null;
};

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function signPdfWithManagedService(pdfBytes: Uint8Array, reference: string): Promise<SigningResult> {
  if (!env.PDF_SIGNING_SERVICE_URL) {
    return {
      bytes: pdfBytes,
      signatureStatus: "not_configured",
      timestampStatus: "not_configured",
      signedAt: null,
      certificateFingerprint: null,
      certificateSerial: null,
      timestampAuthorityResult: null,
    };
  }

  const response = await fetch(env.PDF_SIGNING_SERVICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.PDF_SIGNING_SERVICE_TOKEN ? { Authorization: `Bearer ${env.PDF_SIGNING_SERVICE_TOKEN}` } : {}),
    },
    body: JSON.stringify({
      profile: "PAdES-B-LT",
      trusted_timestamp: { protocol: "RFC3161", required: true },
      document_reference: reference,
      pdf_base64: toBase64(pdfBytes),
    }),
  });
  if (!response.ok) throw new Error("فشل توقيع PDF عبر خدمة التوقيع المُدارة.");
  const result = await response.json() as {
    signed_pdf_base64?: string;
    signed_at?: string;
    certificate_fingerprint?: string;
    certificate_serial?: string;
    timestamp_authority_result?: string;
  };
  if (!result.signed_pdf_base64 || !result.signed_at || !result.certificate_fingerprint) {
    throw new Error("استجابة خدمة التوقيع غير مكتملة.");
  }
  const bytes = fromBase64(result.signed_pdf_base64);
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("خدمة التوقيع لم تُرجع ملف PDF صالحًا.");
  return {
    bytes,
    signatureStatus: "valid",
    timestampStatus: result.timestamp_authority_result ? "valid" : "not_configured",
    signedAt: result.signed_at,
    certificateFingerprint: result.certificate_fingerprint,
    certificateSerial: result.certificate_serial ?? null,
    timestampAuthorityResult: result.timestamp_authority_result ?? null,
  };
}
