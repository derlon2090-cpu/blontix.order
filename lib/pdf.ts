import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb } from "pdf-lib";
import QRCode from "qrcode";
import regularFontUrl from "@ibm/plex/IBM-Plex-Sans-Arabic/fonts/complete/woff/IBMPlexSansArabic-Regular.woff?url";
import semiboldFontUrl from "@ibm/plex/IBM-Plex-Sans-Arabic/fonts/complete/woff/IBMPlexSansArabic-SemiBold.woff?url";
import type { OrderSnapshot } from "./order-document";

const navy = rgb(11 / 255, 47 / 255, 85 / 255);
const blue = rgb(47 / 255, 111 / 255, 168 / 255);
const pale = rgb(240 / 255, 247 / 255, 252 / 255);
const line = rgb(220 / 255, 230 / 255, 239 / 255);
const ink = rgb(25 / 255, 43 / 255, 61 / 255);
const muted = rgb(90 / 255, 108 / 255, 124 / 255);

function visualRtl(input: string) {
  if (!/[\u0600-\u06ff]/.test(input)) return input;
  return input.replace(/[0-9٠-٩۰-۹][0-9٠-٩۰-۹:/.،-]*/g, (run) =>
    run.split("").reverse().join("")
  );
}

function drawRtl(page: PDFPage, text: string, xRight: number, y: number, font: PDFFont, size: number, color = ink) {
  const visual = visualRtl(text);
  page.drawText(visual, { x: xRight - font.widthOfTextAtSize(visual, size), y, font, size, color });
}

function wrapRtl(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(visualRtl(candidate), size) <= maxWidth || !current) current = candidate;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}

function drawLegalSection(page: PDFPage, y: number, title: string, text: string, regular: PDFFont, semibold: PDFFont) {
  page.drawRectangle({ x: 34, y: y - 43, width: 527, height: 49, color: pale, borderColor: line, borderWidth: 0.7 });
  drawRtl(page, title, 547, y - 8, semibold, 9.2, navy);
  const lines = wrapRtl(text, regular, 8.2, 492).slice(0, 2);
  lines.forEach((item, index) => drawRtl(page, item, 547, y - 23 - index * 11, regular, 8.2));
}

function drawInfoCell(page: PDFPage, x: number, y: number, width: number, label: string, value: string, regular: PDFFont, semibold: PDFFont) {
  page.drawRectangle({ x, y: y - 42, width, height: 42, color: rgb(249 / 255, 251 / 255, 253 / 255), borderColor: line, borderWidth: 0.65 });
  drawRtl(page, label, x + width - 9, y - 13, regular, 7.2, muted);
  const valueSize = value.length > 26 ? 7.1 : 8.6;
  wrapRtl(value, semibold, valueSize, width - 18).slice(0, 2).forEach((item, index) => {
    drawRtl(page, item, x + width - 9, y - 27 - index * 9, semibold, valueSize, navy);
  });
}

function drawCheck(page: PDFPage, x: number, y: number) {
  page.drawLine({ start: { x, y }, end: { x: x + 3, y: y - 3 }, thickness: 1.2, color: rgb(27 / 255, 116 / 255, 70 / 255) });
  page.drawLine({ start: { x: x + 3, y: y - 3 }, end: { x: x + 8, y: y + 4 }, thickness: 1.2, color: rgb(27 / 255, 116 / 255, 70 / 255) });
}

async function loadFont(assetUrl: string, origin: string) {
  const response = await fetch(new URL(assetUrl, origin));
  if (!response.ok) throw new Error("تعذر تحميل الخط المضمّن.");
  return response.arrayBuffer();
}

export async function generateOrderPdf(args: {
  snapshot: OrderSnapshot;
  reference: string;
  generatedAt: string;
  imageBytes: Uint8Array;
  origin: string;
  verificationUrl: string;
  verificationId: string;
  documentVersion: number;
}) {
  const { snapshot, reference, generatedAt, imageBytes, origin, verificationUrl, verificationId, documentVersion } = args;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regularBytes, semiboldBytes] = await Promise.all([
    loadFont(regularFontUrl, origin),
    loadFont(semiboldFontUrl, origin),
  ]);
  const regular = await pdf.embedFont(regularBytes, { subset: true });
  const semibold = await pdf.embedFont(semiboldBytes, { subset: true });
  const page = pdf.addPage([595.28, 841.89]);

  page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(1, 1, 1) });
  page.drawText("AP", { x: 145, y: 350, size: 235, font: semibold, color: navy, opacity: 0.045 });
  page.drawRectangle({ x: 501, y: 779, width: 60, height: 35, color: navy });
  page.drawText("AP", { x: 516, y: 788, size: 17, font: semibold, color: rgb(1, 1, 1) });
  drawRtl(page, "إقرار شراء وتسليم منتج رقمي", 488, 796, semibold, 16, navy);
  page.drawText(reference, { x: 34, y: 797, size: 8, font: semibold, color: navy });
  drawRtl(page, `تاريخ الإصدار: ${new Date(generatedAt).toLocaleString("ar-SA")}`, 488, 781, regular, 7.5, muted);
  page.drawRectangle({ x: 34, y: 766, width: 527, height: 2, color: navy });

  const col = 527 / 4;
  const firstRow = [
    ["رقم الطلب", `#${snapshot.orderNumber}`],
    ["تاريخ الطلب والموافقة", new Date(snapshot.orderApprovedAt).toLocaleString("ar-SA")],
    ["المنتج", snapshot.productName],
    ["السعر المدفوع", `${snapshot.price} ر.س`],
  ];
  const secondRow = [
    ["اسم العميل", snapshot.customerName],
    ["رقم الجوال", snapshot.maskedPhone],
    ["حالة الدفع والموافقة", "مدفوع · تمت الموافقة"],
    ["حالة التسليم", "تم التسليم"],
  ];
  firstRow.forEach(([label, value], index) => drawInfoCell(page, 34 + index * col, 752, col, label, value, regular, semibold));
  secondRow.forEach(([label, value], index) => {
    drawInfoCell(page, 34 + index * col, 708, col, label, value, regular, semibold);
    if (index > 1) drawCheck(page, 43 + index * col, 681);
  });

  drawLegalSection(page, 650, "إقرار العميل", snapshot.customerDeclaration, regular, semibold);
  drawLegalSection(page, 590, "توضيح الضمان", snapshot.warrantyText, regular, semibold);
  drawLegalSection(page, 530, "سياسة المنتج الرقمي", snapshot.digitalPolicy, regular, semibold);

  page.drawRectangle({ x: 34, y: 435, width: 527, height: 35, color: rgb(249 / 255, 251 / 255, 253 / 255), borderColor: line, borderWidth: 0.65 });
  drawRtl(page, `طريقة التسليم: ${snapshot.deliveryMethod}`, 547, 449, semibold, 8.3, navy);
  drawRtl(page, `تاريخ ووقت التسليم: ${new Date(snapshot.deliveredAt).toLocaleString("ar-SA")}`, 339, 449, regular, 8.1);
  drawRtl(page, "تم التسليم", 139, 449, semibold, 8.3, rgb(27 / 255, 116 / 255, 70 / 255));
  drawCheck(page, 44, 452);

  drawRtl(page, "الوصف الذي كان ظاهرًا للعميل وقت الشراء", 561, 414, semibold, 10, navy);
  page.drawLine({ start: { x: 34, y: 402 }, end: { x: 561, y: 402 }, thickness: 0.65, color: line });

  let image: PDFImage;
  if (snapshot.imageContentType === "image/png") image = await pdf.embedPng(imageBytes);
  else image = await pdf.embedJpg(imageBytes);
  const bounds = image.scaleToFit(397, 192);
  const imageX = 38 + (397 - bounds.width) / 2;
  const imageY = 190 + (192 - bounds.height) / 2;
  page.drawRectangle({ x: 34, y: 185, width: 405, height: 207, color: rgb(252 / 255, 253 / 255, 254 / 255), borderColor: line, borderWidth: 0.7 });
  page.drawImage(image, { x: imageX, y: imageY, width: bounds.width, height: bounds.height });

  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { errorCorrectionLevel: "M", margin: 1, width: 256 });
  const qrBytes = Uint8Array.from(atob(qrDataUrl.split(",")[1]), (character) => character.charCodeAt(0));
  const qrImage = await pdf.embedPng(qrBytes);
  page.drawRectangle({ x: 447, y: 185, width: 114, height: 207, color: pale, borderColor: blue, borderWidth: 0.9 });
  drawRtl(page, "التحقق من أصالة المستند", 552, 373, semibold, 8.3, navy);
  page.drawImage(qrImage, { x: 468, y: 272, width: 72, height: 72 });
  page.drawText(reference, { x: 460, y: 254, size: 5.8, font: semibold, color: navy });
  page.drawText(`V${documentVersion} · ${verificationId}`, { x: 460, y: 242, size: 5.6, font: regular, color: muted });
  wrapRtl("يمكن التحقق من أصالة المستند ومطابقته للنسخة المسجلة إلكترونيًا.", regular, 5.9, 94)
    .slice(0, 3)
    .forEach((item, index) => drawRtl(page, item, 552, 224 - index * 8, regular, 5.9, muted));
  page.drawText(new URL(verificationUrl).hostname, { x: 458, y: 195, size: 5.3, font: regular, color: navy });

  page.drawLine({ start: { x: 34, y: 166 }, end: { x: 561, y: 166 }, thickness: 0.7, color: navy });
  drawRtl(page, "هذا المستند تم إنشاؤه إلكترونيًا لتوثيق بيانات الطلب والشروط التي وافق عليها العميل قبل إتمام عملية الشراء.", 561, 149, regular, 7.1, muted);
  drawRtl(page, "للتحقق من صحة المستند، امسح رمز QR وتأكد أن الصفحة تفتح على النطاق الرسمي للمنصة.", 561, 136, regular, 6.6, muted);
  page.drawText(`Document Reference: ${reference} · V${documentVersion} · Verification ID: ${verificationId}`, { x: 34, y: 119, size: 6.2, font: regular, color: muted });
  page.drawText(`${reference} · V${documentVersion} · ${verificationId}`, { x: 198, y: 97, size: 6, font: semibold, color: navy, opacity: 0.78 });
  drawRtl(page, `تاريخ ووقت الإنشاء: ${new Date(generatedAt).toLocaleString("ar-SA")} · GMT+3`, 561, 119, regular, 6.2, muted);

  pdf.setTitle(`Order Documentation ${reference}`);
  pdf.setSubject("Digital product purchase and delivery acknowledgment");
  pdf.setCreator("Order Documentation Platform");
  pdf.setCreationDate(new Date(generatedAt));
  return pdf.save();
}
