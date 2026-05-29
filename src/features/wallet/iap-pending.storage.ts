import type {
  PendingIapRecord,
  PendingIapStatus,
} from "@/src/features/wallet/iap.types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const IAP_PENDING_RECORDS_KEY = "iap_pending_records";

function isPendingIapRecord(value: unknown): value is PendingIapRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as PendingIapRecord;
  return (
    typeof record.id === "string" &&
    typeof record.storeProductId === "string" &&
    typeof record.status === "string" &&
    typeof record.createdAt === "string" &&
    record.intent != null &&
    typeof record.intent === "object" &&
    typeof (record.intent as { kind?: unknown }).kind === "string"
  );
}

export async function loadPendingIapRecords(): Promise<PendingIapRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(IAP_PENDING_RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPendingIapRecord);
  } catch {
    return [];
  }
}

async function savePendingIapRecords(records: PendingIapRecord[]): Promise<void> {
  await AsyncStorage.setItem(IAP_PENDING_RECORDS_KEY, JSON.stringify(records));
}

export async function upsertPendingIapRecord(
  record: PendingIapRecord,
): Promise<void> {
  const records = await loadPendingIapRecords();
  const index = records.findIndex((item) => item.id === record.id);
  if (index >= 0) {
    records[index] = record;
  } else {
    records.push(record);
  }
  await savePendingIapRecords(records);
}

export async function removePendingIapRecord(id: string): Promise<void> {
  const records = await loadPendingIapRecords();
  await savePendingIapRecords(records.filter((item) => item.id !== id));
}

export async function updatePendingIapRecord(
  id: string,
  patch: Partial<Pick<PendingIapRecord, "status" | "purchaseDedupeKey" | "lastError" | "retryCount">>,
): Promise<PendingIapRecord | null> {
  const records = await loadPendingIapRecords();
  const index = records.findIndex((item) => item.id === id);
  if (index < 0) return null;
  records[index] = { ...records[index], ...patch };
  await savePendingIapRecords(records);
  return records[index];
}

export async function getActivePendingIapRecord(): Promise<PendingIapRecord | null> {
  const records = await loadPendingIapRecords();
  const activeStatuses: PendingIapStatus[] = [
    "awaiting_store",
    "awaiting_verify",
    "pending_approval",
  ];
  return (
    records.find((record) => activeStatuses.includes(record.status)) ?? null
  );
}

export async function getFailedPendingIapRecords(): Promise<PendingIapRecord[]> {
  const records = await loadPendingIapRecords();
  return records.filter((record) => record.status === "failed");
}

export async function findPendingIapRecordByDedupeKey(
  dedupeKey: string,
): Promise<PendingIapRecord | null> {
  const records = await loadPendingIapRecords();
  return records.find((record) => record.purchaseDedupeKey === dedupeKey) ?? null;
}

export async function findPendingIapRecordForPurchase(
  productId: string,
  dedupeKey?: string | null,
): Promise<PendingIapRecord | null> {
  const records = await loadPendingIapRecords();
  const activeStatuses: PendingIapStatus[] = [
    "awaiting_store",
    "awaiting_verify",
    "pending_approval",
    "failed",
  ];

  if (dedupeKey) {
    const byDedupe = records.find(
      (record) =>
        record.purchaseDedupeKey === dedupeKey &&
        activeStatuses.includes(record.status),
    );
    if (byDedupe) return byDedupe;
  }

  return (
    records.find(
      (record) =>
        record.storeProductId === productId &&
        activeStatuses.includes(record.status),
    ) ?? null
  );
}

export async function clearIapPendingStorage(): Promise<void> {
  await AsyncStorage.removeItem(IAP_PENDING_RECORDS_KEY);
}
