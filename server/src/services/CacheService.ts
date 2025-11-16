import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // 5 min TTL

export function getCached(key: string) {
  return cache.get(key);
}

export function setCached(key: string, value: any, ttl?: number) {
  if (ttl !== undefined) {
    cache.set(key, value, ttl);
  } else {
    cache.set(key, value);
  }
}
export function delCached(key: string) {
  cache.del(key);
}

export default cache;
