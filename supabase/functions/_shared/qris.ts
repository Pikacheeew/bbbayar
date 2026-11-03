// QRIS (EMVCo MPM) helpers: turn a static QRIS into a fixed-amount one.
// Pure TS, no deps — runs in Deno (edge functions) and Node.

export type Tlv = [tag: string, value: string];

export function parseTlv(s: string): Tlv[] {
  const out: Tlv[] = [];
  let i = 0;
  while (i < s.length) {
    const tag = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    if (tag.length < 2 || !Number.isInteger(len) || i + 4 + len > s.length) {
      throw new Error(`Malformed QRIS at position ${i}`);
    }
    out.push([tag, s.slice(i + 4, i + 4 + len)]);
    i += 4 + len;
  }
  return out;
}

export function buildTlv(items: Tlv[]): string {
  return items.map(([t, v]) => {
    if (v.length > 99) throw new Error(`Tag ${t} value too long`);
    return t + String(v.length).padStart(2, "0") + v;
  }).join("");
}

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as required by EMVCo tag 63.
export function crc16(s: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(s)) {
    crc ^= byte << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function isValidQris(s: string): boolean {
  if (!/6304[0-9A-F]{4}$/i.test(s)) return false;
  return crc16(s.slice(0, -4)) === s.slice(-4).toUpperCase();
}

const MAX_AMOUNT = 10_000_000; // BI per-transaction QRIS limit

export function toDynamic(staticQris: string, amount: number): string {
  const qris = staticQris.trim();
  if (!isValidQris(qris)) throw new Error("Static QRIS is invalid or its CRC is wrong");
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
    throw new Error(`Amount must be a whole rupiah value between 1 and ${MAX_AMOUNT}`);
  }

  const items = parseTlv(qris).filter(([t]) => t !== "63" && t !== "54");
  const out: Tlv[] = [];
  for (const [t, v] of items) {
    out.push(t === "01" ? ["01", "12"] : [t, v]); // 11 = static, 12 = dynamic
    if (t === "53") out.push(["54", String(amount)]); // amount goes right after currency
  }
  if (!out.some(([t]) => t === "54")) throw new Error("QRIS has no currency tag (53)");

  const body = buildTlv(out) + "6304";
  return body + crc16(body);
}
