import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import sharp from "sharp";

const pdf = resolve(process.env.QA_PDF || "tmp/qa-blontix-v1.pdf");
const pngPrefix = resolve("tmp/qa-blontix-v1-page");
const pdftoppm = process.env.PDFTOPPM || "pdftoppm";
const pdfinfo = process.env.PDFINFO || "pdfinfo";
const info = execFileSync(pdfinfo, [pdf], { encoding: "utf8" });
assert.match(info, /Pages:\s+1\b/);
assert.match(info, /Page size:\s+595\.28 x 841\.89 pts/);
execFileSync(pdftoppm, ["-f", "1", "-singlefile", "-png", "-r", "110", pdf, pngPrefix]);

const { data, info: image } = await sharp(`${pngPrefix}.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
assert.ok(Math.abs(image.width / image.height - 210 / 297) < 0.006, "A4 page ratio changed");

const rgbAt = (x, y) => {
  const offset = (y * image.width + x) * 3;
  return [data[offset], data[offset + 1], data[offset + 2]];
};
function countPixels(rect, predicate) {
  const [left, top, right, bottom] = rect;
  let count = 0;
  for (let y = Math.floor(top * image.height); y < Math.floor(bottom * image.height); y += 2) for (let x = Math.floor(left * image.width); x < Math.floor(right * image.width); x += 2) {
    if (predicate(rgbAt(x, y))) count++;
  }
  return count;
}
const cyan = ([r, g, b]) => g > 115 && b > 145 && r < 115 && b > r + 40;
const navy = ([r, g, b]) => b > 55 && b < 160 && r < 70 && g < 110;
const dark = ([r, g, b]) => r < 105 && g < 105 && b < 125;
const ink = ([r, g, b]) => r < 190 && g < 190 && b < 190;
const white = ([r, g, b]) => r > 245 && g > 245 && b > 245;
const watermarkTint = ([r, g, b]) => r >= 243 && r <= 247 && g >= 250 && b >= 251 && b > r + 5;
const headerLogo = [0.84, 0.012, 0.96, 0.105];
const watermark = [0.40, 0.43, 0.60, 0.53];
const descriptionImage = [0.27, 0.54, 0.50, 0.77];
const qrSeal = [0.78, 0.59, 0.93, 0.70];
const phoneCell = [0.28, 0.155, 0.51, 0.225];
const footer = [0.04, 0.79, 0.96, 0.91];
const blankBottom = [0.03, 0.94, 0.97, 0.99];
assert.ok(countPixels(headerLogo, cyan) > 25 && countPixels(headerLogo, navy) > 25, "blontix header logo missing");
assert.ok(countPixels(watermark, watermarkTint) > 50, "premium watermark missing or too faint");
assert.ok(countPixels(descriptionImage, cyan) > 180 && countPixels(descriptionImage, navy) > 180, "description image cropped or missing");
assert.ok(countPixels(qrSeal, dark) > 170, "QR/seal missing");
assert.ok(countPixels(phoneCell, dark) > 30, "customer phone/data region empty");
assert.ok(countPixels(footer, ink) > 50, "reference footer missing");
assert.ok(countPixels(blankBottom, white) > 1400, "page overflow or content under footer");
console.log(JSON.stringify({ result: "pass", visualChecks: ["A4 one page", "blontix header logo", "premium watermark", "description image", "QR seal", "phone data", "footer", "no page overflow"], png: `${pngPrefix}.png` }));
