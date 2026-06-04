/**
 * IndexedDB cache for the decrypted Nostr secret key.
 *
 * After login, we keep the raw secret key bytes here so subsequent signing
 * operations (product creates, profile updates, order events) don't have
 * to prompt for the password again. Cleared on logout.
 *
 * Trade-off: a successful XSS on maya.com can exfiltrate the key. This
 * matches what every other browser-based Nostr identity does (Damus web,
 * Iris, Snort). Mitigations live at the network and CSP layer.
 *
 * Browser-only. SSR-safe guards throw a clear error rather than misbehave.
 */

const DB_NAME = 'maya-auth';
const DB_VERSION = 1;
const STORE = 'keys';

interface KeyRecord {
  npub: string;
  secretKey: Uint8Array;
  unlockedAt: number;
}

function ensureBrowser(): void {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB unavailable — auth storage requires the browser');
  }
}

function openDb(): Promise<IDBDatabase> {
  ensureBrowser();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'npub' });
      }
    };
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const store = transaction.objectStore(STORE);
        const req = op(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function putSecretKey(npub: string, secretKey: Uint8Array): Promise<void> {
  const record: KeyRecord = { npub, secretKey, unlockedAt: Date.now() };
  await tx('readwrite', store => store.put(record));
}

export async function getSecretKey(npub: string): Promise<Uint8Array | null> {
  const record = (await tx('readonly', store => store.get(npub))) as KeyRecord | undefined;
  return record ? record.secretKey : null;
}

export async function getUnlockedAt(npub: string): Promise<number | null> {
  const record = (await tx('readonly', store => store.get(npub))) as KeyRecord | undefined;
  return record ? record.unlockedAt : null;
}

export async function clearSecretKey(npub: string): Promise<void> {
  await tx('readwrite', store => store.delete(npub));
}

export async function clearAll(): Promise<void> {
  await tx('readwrite', store => store.clear());
}
