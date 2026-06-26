/**
 * MPN enrichment cache — avoids repeat OpenRouter calls for duplicate part numbers.
 */

import fs from 'fs';
import path from 'path';

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normMpn(mpn) {
  return String(mpn || '').replace(/\s+/g, '').toLowerCase();
}

export function createEnrichmentCache(rootDir, promptVersion, options = {}) {
  const cachePath = path.resolve(
    rootDir,
    options.cachePath || 'config/.enrichment-cache.json',
  );
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  let data = {};

  function load() {
    try {
      if (fs.existsSync(cachePath)) {
        data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      }
    } catch {
      data = {};
    }
  }

  function persist() {
    try {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(data));
    } catch {
      // non-fatal
    }
  }

  load();

  function key(mpn, profile, identityKey) {
    const identity = identityKey ? String(identityKey).slice(0, 64) : '_';
    return `${normMpn(mpn)}|${promptVersion}|${profile}|${identity}`;
  }

  return {
    get(mpn, profile, identityKey) {
      if (!normMpn(mpn)) return null;
      const k = key(mpn, profile, identityKey);
      const hit = data[k];
      if (!hit) return null;
      if (Date.now() - hit.cachedAt > ttlMs) {
        delete data[k];
        return null;
      }
      return hit.item;
    },
    set(mpn, profile, item, identityKey) {
      if (!normMpn(mpn) || !item) return;
      data[key(mpn, profile, identityKey)] = { item, cachedAt: Date.now() };
      persist();
    },
    stats() {
      return { entries: Object.keys(data).length, path: cachePath };
    },
  };
}
