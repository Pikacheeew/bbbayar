// Run: node supabase/functions/_shared/qris.test.ts   (or: deno run qris.test.ts)
import assert from "node:assert/strict";
import { crc16, isValidQris, parseTlv, toDynamic } from "./qris.ts";

// Real QRIS string returned by Xendit's API (public docs) — known-good CRC "63CC".
const known =
  "00020101021226570011ID.DANA.WWW011893600915015706056102091570605610303UME51440014ID.CO.QRIS.WWW0215ID20210807329890303UME520489315303360540410005802ID5906XENDIT6015Kota Jakarta Se61051219062720115QjZudXMDN7Zn5eR60490011ID.DANA.WWW0425MER202107140077450960864105011630463CC";
assert.equal(crc16(known.slice(0, -4)), "63CC", "CRC matches a real issuer-generated QRIS");
assert.ok(isValidQris(known));

// Build a static version of it (01=11, no amount) to simulate a merchant's printed QR.
const staticItems = parseTlv(known).filter(([t]) => t !== "54" && t !== "63")
  .map(([t, v]) => (t === "01" ? ["01", "11"] : [t, v]) as [string, string]);
const staticBody = staticItems.map(([t, v]) => t + String(v.length).padStart(2, "0") + v).join("") + "6304";
const staticQris = staticBody + crc16(staticBody);
assert.ok(isValidQris(staticQris));

// Convert back with the original amount → must reproduce the issuer's exact string.
assert.equal(toDynamic(staticQris, 1000), known, "round-trips to the issuer's own dynamic QRIS");

// New amount: valid CRC, method 12, amount present, merchant data untouched.
const dyn = toDynamic(staticQris, 150237);
assert.ok(isValidQris(dyn));
const tags = Object.fromEntries(parseTlv(dyn));
assert.equal(tags["01"], "12");
assert.equal(tags["54"], "150237");
assert.equal(tags["59"], "XENDIT");

// Rejects bad input.
assert.throws(() => toDynamic(staticQris.slice(0, -1) + "0", 1000), /invalid/);
assert.throws(() => toDynamic(staticQris, 0));
assert.throws(() => toDynamic(staticQris, 1.5));
assert.throws(() => toDynamic(staticQris, 10_000_001));

console.log("qris: all checks passed");
