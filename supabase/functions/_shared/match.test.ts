// Run: node supabase/functions/_shared/match.test.ts
import assert from "node:assert/strict";
import { matchTxns } from "./match.ts";

const t = (id: string, amount: number, paidAtSec: number, success = true) => ({ id, amount, paidAtSec, success, raw: {} });
const created = 1_000_000;
const txns = [
  t("ok", 150237, created + 30),
  t("wrong-amount", 150238, created + 30),
  t("before-qr", 150237, created - 3600),     // same amount, paid for an older order
  t("failed", 150237, created + 40, false),
  t("skew", 150237, created - 20),            // within clock-skew margin
];
assert.deepEqual(matchTxns(150237, created, txns).map((x) => x.id), ["ok", "skew"]);
assert.deepEqual(matchTxns(999, created, txns), []);
console.log("match: all checks passed");
