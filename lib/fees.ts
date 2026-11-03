import type { ShippingMethod } from "./types";

// Flat admin fee for Pledge campaigns only. Bulk Sell uses a price-tiered fee
// computed server-side (see compute_admin_fee in Postgres) — 1.000 up to
// Rp35.000, 2.000 up to Rp85.000, 5.000 above that (capped).
export const ADMIN_FEE = 3000;

// ponytail: flat-rate mock, not distance-based. Campaigns now store an
// origin_address/city/postal_code pickup point — once a maps/geocoding API
// key is available, compute instant (Grab/GoSend) fare from that point to
// each buyer's address instead of this flat rate.
export const SHIPPING_FEE: Record<ShippingMethod, number> = {
  instant: 15000,
  jnt: 10000,
};

export const SHIPPING_LABEL: Record<ShippingMethod, string> = {
  instant: "Instant (GoSend / Grab)",
  jnt: "JNT (regular shipping)",
};
