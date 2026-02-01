import client from './client.js';

const TOTW_CACHE_PREFIX = 'totw:';
const CACHE_TTL = 300;

export async function getCachedNominees(weekId) {
  const key = `${TOTW_CACHE_PREFIX}nominees:${weekId}`;
  const cached = await client.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  return null;
}

export async function setCachedNominees(weekId, nominees) {
  const key = `${TOTW_CACHE_PREFIX}nominees:${weekId}`;
  await client.setEx(key, CACHE_TTL, JSON.stringify(nominees));
}

export async function getCachedLiveStandings() {
  const key = `${TOTW_CACHE_PREFIX}live-standings`;
  const cached = await client.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  return null;
}

export async function setCachedLiveStandings(standings) {
  const key = `${TOTW_CACHE_PREFIX}live-standings`;
  await client.setEx(key, 60, JSON.stringify(standings));
}

export async function getCachedHallOfFame(page, limit) {
  const key = `${TOTW_CACHE_PREFIX}hof:${page}:${limit}`;
  const cached = await client.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  return null;
}

export async function setCachedHallOfFame(page, limit, data) {
  const key = `${TOTW_CACHE_PREFIX}hof:${page}:${limit}`;
  await client.setEx(key, CACHE_TTL, JSON.stringify(data));
}

export async function invalidateTOTWCache(weekId = null) {
  const pattern = weekId
    ? `${TOTW_CACHE_PREFIX}nominees:${weekId}`
    : `${TOTW_CACHE_PREFIX}*`;

  if (weekId) {
    await client.del(pattern);
  } else {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  }
}

export async function invalidateLiveStandings() {
  const key = `${TOTW_CACHE_PREFIX}live-standings`;
  await client.del(key);
}
