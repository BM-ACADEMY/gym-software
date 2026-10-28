// Offline bill queue. When the network drops the bill is kept on the device and sent later.
// Safe to retry: every bill carries a clientId and the server returns the saved bill for a repeat (core-pos).
// Bills the server refuses (not enough stock, bad data) are NOT dropped: they move to a "rejected" list for staff to fix.
const PENDING = 'pos:pending';
const REJECTED = 'pos:rejected';

const read = (storage, key) => { try { return JSON.parse(storage.getItem(key) || '[]'); } catch { return []; } };
const write = (storage, key, list) => { try { storage.setItem(key, JSON.stringify(list)); return true; } catch { return false; } };

const newClientId = (deviceId = 'dev') => `${deviceId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createQueue = (storage) => ({
  add(bill) {
    const entry = { ...bill, clientId: bill.clientId || newClientId(bill.deviceId), queuedAt: bill.queuedAt || new Date().toISOString() };
    const list = read(storage, PENDING);
    if (!list.some((b) => b.clientId === entry.clientId)) list.push(entry);
    if (!write(storage, PENDING, list)) throw new Error('This device is out of storage. Free some space before billing offline.');
    return entry;
  },
  pending() { return read(storage, PENDING); },
  remove(clientId) { write(storage, PENDING, read(storage, PENDING).filter((b) => b.clientId !== clientId)); },
  rejected() { return read(storage, REJECTED); },
  dismiss(clientId) { write(storage, REJECTED, read(storage, REJECTED).filter((b) => b.clientId !== clientId)); },
  // send(bill) must resolve on success or throw an error that has .status (HTTP) or no status (network down).
  async flush(send) {
    const result = { sent: 0, rejected: 0, left: 0 };
    let list = read(storage, PENDING);
    const keep = [];
    for (let i = 0; i < list.length; i += 1) {
      const bill = list[i];
      try {
        await send(bill);
        result.sent += 1;
      } catch (err) {
        const status = err && err.status;
        if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
          const rej = read(storage, REJECTED);
          rej.push({ ...bill, reason: err.message || 'Refused', rejectedAt: new Date().toISOString() });
          write(storage, REJECTED, rej);
          result.rejected += 1;
        } else {
          keep.push(...list.slice(i)); // network down or server error: stop and try again later
          break;
        }
      }
    }
    write(storage, PENDING, keep);
    result.left = keep.length;
    return result;
  },
});

export { createQueue, newClientId, PENDING, REJECTED };
