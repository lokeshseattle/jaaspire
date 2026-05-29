import type { IapSkuListItem } from "@/src/services/api/api.types";
import { Platform } from "react-native";

/** Store-facing product id for the current platform (Apple SKU vs Google product id). */
export function storeProductIdFromIapSku(row: IapSkuListItem): string {
  return Platform.OS === "ios" ? row.apple_sku : row.google_product_id;
}

/** Display price from GET /iap/sku `usd_amount` (store-backed, not derived from stars). */
export function formatIapUsdAmount(
  usdAmount: string,
  currencySymbol = "$",
): string | null {
  const n = Number.parseFloat(usdAmount);
  if (!Number.isFinite(n) || n <= 0) return null;
  const formatted = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return `${currencySymbol}${formatted}`;
}

export function getStarsForWalletSku(
  storeProductId: string,
  skus: IapSkuListItem[],
): number | null {
  const row = skus.find(
    (item) =>
      item.apple_sku === storeProductId ||
      item.google_product_id === storeProductId,
  );
  return row?.stars ?? null;
}

/** Smallest consumable pack whose star count is >= `stars` (store product id for this OS). */
export function skuForStarAmount(
  stars: number,
  skus: IapSkuListItem[],
): string | null {
  const consumables = skus.filter(
    (row): row is IapSkuListItem & { category: "consumable"; stars: number } =>
      row.category === "consumable" && typeof row.stars === "number",
  );
  const ranked = consumables
    .map((row) => [row, row.stars] as const)
    .sort(([, a], [, b]) => a - b);
  const match = ranked.find(([, amount]) => amount >= stars);
  return match ? storeProductIdFromIapSku(match[0]) : null;
}

/** Default monthly tier used when subscribing to any creator via IAP. */
export const DEFAULT_SUBSCRIPTION_SKU_KEY = "G1_T1_MONTHLY";

export function pickSubscriptionSku(
  skus: IapSkuListItem[],
): IapSkuListItem | null {
  if (!skus.length) return null;
  return (
    skus.find((row) => row.sku_key === DEFAULT_SUBSCRIPTION_SKU_KEY) ??
    skus.find((row) => row.tier_key === "t1") ??
    skus[0]
  );
}

function isMonthlySubscriptionSku(row: IapSkuListItem): boolean {
  return row.sku_key.includes("MONTHLY");
}

function pickPreferredTierSku(
  existing: IapSkuListItem,
  candidate: IapSkuListItem,
): IapSkuListItem {
  const existingMonthly = isMonthlySubscriptionSku(existing);
  const candidateMonthly = isMonthlySubscriptionSku(candidate);
  if (candidateMonthly && !existingMonthly) return candidate;
  if (existingMonthly && !candidateMonthly) return existing;
  return Number.parseFloat(candidate.usd_amount) <
    Number.parseFloat(existing.usd_amount)
    ? candidate
    : existing;
}

/** One representative monthly SKU per unique `tier_key` (creator subscription pricing). */
export function uniqueSubscriptionTiersByTierKey(
  skus: IapSkuListItem[],
): IapSkuListItem[] {
  const byTier = new Map<string, IapSkuListItem>();
  for (const row of skus) {
    if (!row.tier_key) continue;
    const existing = byTier.get(row.tier_key);
    byTier.set(
      row.tier_key,
      existing ? pickPreferredTierSku(existing, row) : row,
    );
  }
  return [...byTier.values()].sort(
    (a, b) =>
      Number.parseFloat(a.usd_amount) - Number.parseFloat(b.usd_amount),
  );
}

export function findTierKeyForMonthlyPrice(
  price: number | null | undefined,
  tiers: IapSkuListItem[],
): string {
  if (price == null || !tiers.length) return "";
  const match = tiers.find(
    (row) => Math.abs(Number.parseFloat(row.usd_amount) - price) < 0.01,
  );
  return match?.tier_key ?? "";
}
