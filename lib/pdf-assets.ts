import { readFile } from "node:fs/promises";
import { join } from "node:path";

let logo:Promise<Uint8Array>|undefined;
export function getLogoBytes() {
  return logo ??= readFile(join(process.cwd(), "public/blontix-logo-v1.png")).then(bytes=>new Uint8Array(bytes)).catch(error=>{logo=undefined;throw error;});
}

const fonts=new Map<string,Promise<Uint8Array>>();
export function getFontBytes(weight: "Regular" | "SemiBold") {
  let pending=fonts.get(weight);
  if(!pending){pending=readFile(join(process.cwd(), "node_modules/@ibm/plex/IBM-Plex-Sans-Arabic/fonts/complete/woff", `IBMPlexSansArabic-${weight}.woff`)).then(bytes=>new Uint8Array(bytes)).catch(error=>{fonts.delete(weight);throw error;});fonts.set(weight,pending);}
  return pending;
}
