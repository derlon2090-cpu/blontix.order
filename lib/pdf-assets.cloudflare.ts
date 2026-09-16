import regular from "@ibm/plex/IBM-Plex-Sans-Arabic/fonts/complete/woff/IBMPlexSansArabic-Regular.woff?inline";
import semibold from "@ibm/plex/IBM-Plex-Sans-Arabic/fonts/complete/woff/IBMPlexSansArabic-SemiBold.woff?inline";
import logo from "../public/blontix-logo-v1.png?inline";

function decode(data: string) {
  const offset = data.indexOf(";base64,");
  if (!data.startsWith("data:") || offset < 0) throw new Error("ASSET_UNAVAILABLE");
  return Uint8Array.from(atob(data.slice(offset + 8)), (character) => character.charCodeAt(0));
}
export async function getLogoBytes() { return decode(logo); }
export async function getFontBytes(weight: "Regular" | "SemiBold") { return decode(weight === "Regular" ? regular : semibold); }
