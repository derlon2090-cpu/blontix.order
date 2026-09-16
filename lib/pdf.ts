import {documentFontkit} from './pdf-fontkit';
import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { getFontBytes } from "@/lib/pdf-assets";
import type { OrderSnapshot } from "./order-document";
import { shortFingerprint } from "./security";
import {pdfTextRuns} from './pdf-text';
import {addIntegrityMetadata} from './pdf-integrity';
import {INTEGRITY_NOTICE_TITLE,INTEGRITY_NOTICE,AUTOMATION_NOTICE_TITLE,AUTOMATION_NOTICE,QR_INTEGRITY_NOTICE} from './document-integrity';

const navy = rgb(11 / 255, 47 / 255, 85 / 255);
const blue = rgb(47 / 255, 111 / 255, 168 / 255);
const pale = rgb(240 / 255, 247 / 255, 252 / 255);
const line = rgb(220 / 255, 230 / 255, 239 / 255);
const ink = rgb(25 / 255, 43 / 255, 61 / 255);
const muted = rgb(90 / 255, 108 / 255, 124 / 255);

const measurements=new WeakMap<PDFFont,Map<string,number>>();
function textWidth(text:string,font:PDFFont,size:number){
  let cache=measurements.get(font);
  if(!cache){cache=new Map();measurements.set(font,cache);}
  const key=`${size}:${text}`;
  let width=cache.get(key);
  if(width===undefined){width=pdfTextRuns(text).reduce((sum,run)=>sum+font.widthOfTextAtSize(run,size),0);cache.set(key,width);}
  return width;
}

function drawRtl(page: PDFPage, text: string, xRight: number, y: number, font: PDFFont, size: number, color = ink) {
  let x=xRight-textWidth(text,font,size);
  for(const run of pdfTextRuns(text)){
    page.drawText(run,{x,y,font,size,color});
    x+=font.widthOfTextAtSize(run,size);
  }
}

function wrapRtl(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (textWidth(word,font,size) > maxWidth) {
      if (current) { lines.push(current); current = ""; }
      for (const character of word) {
        const candidate = current + character;
        if (current && textWidth(candidate,font,size) > maxWidth) {
          lines.push(current); current = character;
        } else { current = candidate; }
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate,font,size) <= maxWidth || !current) current = candidate;
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

export async function generateOrderPdf(args: {
  snapshot: OrderSnapshot;
  reference: string;
  generatedAt: string;
  imageBytes: Uint8Array;
  logoBytes: Uint8Array;
  origin: string;
  verificationUrl: string;
  verificationId: string;
  documentVersion: number;
  snapshotHash: string;
}) {
  const { snapshot, generatedAt, imageBytes, logoBytes, verificationUrl, snapshotHash } = args;
  if((snapshot.documentReference!==undefined && snapshot.documentReference!==args.reference)||(snapshot.documentVersion!==undefined && snapshot.documentVersion!==args.documentVersion)||(snapshot.verificationId!==undefined && snapshot.verificationId!==args.verificationId))throw new Error('Document snapshot identity mismatch');
  const reference=snapshot.documentReference ?? args.reference;
  const verificationId=snapshot.verificationId ?? args.verificationId;
  const documentVersion=snapshot.documentVersion ?? args.documentVersion;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(documentFontkit);
  const [regularBytes, semiboldBytes] = await Promise.all([
    getFontBytes("Regular"),
    getFontBytes("SemiBold"),
  ]);
  const regular = await pdf.embedFont(regularBytes, { subset: true });
  const semibold = await pdf.embedFont(semiboldBytes, { subset: true });
  const page = pdf.addPage([595.28, 841.89]);
  const logo = await pdf.embedPng(logoBytes);

  page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(1, 1, 1) });
  page.drawImage(logo, { x: 192, y: 360, width: 206, height: 206, opacity: 0.04 });
  page.drawImage(logo, { x: 501, y: 775, width: 60, height: 60 });
  drawRtl(page, "إقرار شراء وتسليم منتج رقمي", 489, 796, semibold, 16, navy);
  page.drawText(reference, { x: 34, y: 797, size: 8, font: semibold, color: navy });
  drawRtl(page, `تاريخ الإصدار: ${new Date(generatedAt).toLocaleString("ar-SA")}`, 489, 781, regular, 7.5, muted);
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
    ["رقم الجوال", snapshot.customerPhone],
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
  wrapRtl(reference, semibold, 5.8, 94).slice(0, 2).forEach((item, index) => {
    page.drawText(item, { x: 458, y: 254 - index * 7, size: 5.8, font: semibold, color: navy });
  });
  page.drawText(`V${documentVersion} · ${verificationId}`, { x: 460, y: 238, size: 5.6, font: regular, color: muted });
  drawRtl(page, "بصمة بيانات المستند", 552, 231, regular, 5.7, muted);
  page.drawText(shortFingerprint(snapshotHash), { x: 460, y: 220, size: 5.4, font: semibold, color: navy });
  const qrNotice=wrapRtl(QR_INTEGRITY_NOTICE,regular,5.7,94);
  if(qrNotice.length>3)throw new Error('QR integrity notice overflow');
  qrNotice.forEach((item,index)=>drawRtl(page,item,552,207-index*7,regular,5.7,muted));

  // Visible decorative watermark, painted over the body and outside the QR.
  // This is a version identifier, not a hidden instruction to any processor.
  const watermark=`ORIGINAL VERIFIED DOCUMENT • ${reference}`;
  for(const y of [738,628,568,508,370,306,228])for(const x of [38,241]){
    wrapRtl(watermark,regular,5.2,194).forEach((text,index)=>page.drawText(text,{x,y:y-index*6.5,font:regular,size:5.2,color:blue,opacity:0.055}));
  }
  page.drawRectangle({x:34,y:99,width:527,height:75,color:pale,borderColor:line,borderWidth:0.65});
  drawRtl(page,INTEGRITY_NOTICE_TITLE,547,160,semibold,8.4,navy);
  const integrityLines=wrapRtl(INTEGRITY_NOTICE,regular,7.1,499);
  if(integrityLines.length>4)throw new Error('Document integrity notice overflow');
  integrityLines.forEach((text,index)=>drawRtl(page,text,547,147-index*10,regular,7.1));
  drawRtl(page,'أي تعديل على الملف ينتج بصمة مختلفة. بصمة الملف النهائي متاحة عبر التحقق باستخدام QR.',547,106,regular,6.2,muted);
  drawRtl(page,AUTOMATION_NOTICE_TITLE,561,88,semibold,6.8,navy);
  const automationLines=wrapRtl(AUTOMATION_NOTICE,regular,6.2,527);
  if(automationLines.length>3)throw new Error('Automation footer notice overflow');
  automationLines.forEach((text,index)=>drawRtl(page,text,561,77-index*9,regular,6.2,muted));
  page.drawText(`Document Reference: ${reference} · V${documentVersion} · Verification ID: ${verificationId}`,{x:34,y:41,size:6.2,font:regular,color:muted});
  drawRtl(page,`تاريخ ووقت الإنشاء: ${new Date(generatedAt).toLocaleString('ar-SA')} · GMT+3`,561,28,regular,6.2,muted);
  for(let x=34;x<561;x+=26)page.drawRectangle({x,y:18,width:13,height:1.2,color:blue,opacity:0.06});
  addIntegrityMetadata(pdf,{reference,verificationId,version:documentVersion,snapshotHash,generatedAt});
  return pdf.save();
}
