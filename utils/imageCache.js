// Small in-memory LRU for hot product photos so the same image isn't re-read
// from MongoDB for every visitor. Bounded by total bytes.
const MAX_BYTES = 48 * 1024 * 1024;
const cache = new Map();
let total = 0;

function get(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  cache.delete(key);
  cache.set(key, entry); // mark as most recently used
  return entry;
}

function set(key, buffer) {
  if (buffer.length > MAX_BYTES / 4) return;
  const old = cache.get(key);
  if (old) total -= old.length;
  cache.set(key, buffer);
  total += buffer.length;
  while (total > MAX_BYTES) {
    const oldestKey = cache.keys().next().value;
    total -= cache.get(oldestKey).length;
    cache.delete(oldestKey);
  }
}

function drop(key) {
  const old = cache.get(key);
  if (old) total -= old.length;
  cache.delete(key);
}

module.exports = { get, set, drop };
