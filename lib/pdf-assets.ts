import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function getLogoBytes() {
  return new Uint8Array(await readFile(join(process.cwd(), "public/blontix-logo-v1.png")));
}

export async function getFontBytes(weight: "Regular" | "SemiBold") {
  return new Uint8Array(await readFile(join(process.cwd(), "node_modules/@ibm/plex/IBM-Plex-Sans-Arabic/fonts/complete/woff", `IBMPlexSansArabic-${weight}.woff`)));
}
