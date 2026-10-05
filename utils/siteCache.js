// Tiny in-memory TTL cache. Used for data that is read on every page view but
// changes rarely (site settings, categories, homepage blocks, sitemap).
// The admin panel calls clear() after any change so edits show up immediately.
const store = new Map();

async function cached(key, ttlMs, loader) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.value !== undefined && hit.expires > now) return hit.value;
  if (hit && hit.pending) return hit.pending; // de-duplicate concurrent loads

  const pending = Promise.resolve()
    .then(loader)
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .catch((err) => {
      store.delete(key);
      throw err;
    });
  store.set(key, { pending, expires: 0 });
  return pending;
}

function clear() {
  store.clear();
}

module.exports = { cached, clear };
