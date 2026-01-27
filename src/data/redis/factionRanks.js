import client from './client.js';
import { RANKED_KEY, DAILY_RANKED_KEY } from './ranks.js';

const FACTION_RANKED_KEY = 'frankd';
const FACTION_DAILY_RANKED_KEY = 'frankdd';
const FACTION_MEMBER_COUNT_KEY = 'fmemcnt';

export async function updateFactionRanks(factionId, memberIds) {
  if (!memberIds.length) {
    return { totalPixels: 0, dailyPixels: 0 };
  }

  const [totalScores, dailyScores] = await Promise.all([
    client.zmScore(RANKED_KEY, memberIds.map(String)),
    client.zmScore(DAILY_RANKED_KEY, memberIds.map(String)),
  ]);

  let totalPixels = 0;
  let dailyPixels = 0;

  for (let i = 0; i < memberIds.length; i += 1) {
    totalPixels += totalScores[i] || 0;
    dailyPixels += dailyScores[i] || 0;
  }

  await Promise.all([
    client.zAdd(FACTION_RANKED_KEY, { score: totalPixels, value: String(factionId) }),
    client.zAdd(FACTION_DAILY_RANKED_KEY, { score: dailyPixels, value: String(factionId) }),
    client.hSet(FACTION_MEMBER_COUNT_KEY, String(factionId), String(memberIds.length)),
  ]);

  return { totalPixels, dailyPixels };
}

export async function getFactionRanks(factionId) {
  const [totalPixels, dailyPixels, totalRank, dailyRank] = await Promise.all([
    client.zScore(FACTION_RANKED_KEY, String(factionId)),
    client.zScore(FACTION_DAILY_RANKED_KEY, String(factionId)),
    client.zRevRank(FACTION_RANKED_KEY, String(factionId)),
    client.zRevRank(FACTION_DAILY_RANKED_KEY, String(factionId)),
  ]);

  return {
    totalPixels: totalPixels || 0,
    dailyPixels: dailyPixels || 0,
    totalRank: totalRank !== null ? totalRank + 1 : null,
    dailyRank: dailyRank !== null ? dailyRank + 1 : null,
  };
}

export async function getFactionRankings(daily, start, amount) {
  start -= 1;
  amount -= 1;
  const key = daily ? FACTION_DAILY_RANKED_KEY : FACTION_RANKED_KEY;
  const oKey = daily ? FACTION_RANKED_KEY : FACTION_DAILY_RANKED_KEY;

  const ranks = await client.zRangeWithScores(key, start, start + amount, {
    REV: true,
  });

  const fids = ranks.map((r) => r.value);
  if (!fids.length) {
    return [];
  }

  const [oScores, memberCounts] = await Promise.all([
    client.zmScore(oKey, fids),
    client.hmGet(FACTION_MEMBER_COUNT_KEY, fids),
  ]);

  const ret = [];
  for (let i = 0; i < ranks.length; i += 1) {
    ret.push({
      id: Number(fids[i]),
      totalPixels: daily ? (oScores[i] || 0) : ranks[i].score,
      dailyPixels: daily ? ranks[i].score : (oScores[i] || 0),
      rank: start + i + 1,
      memberCount: Number(memberCounts[i]) || 0,
    });
  }

  return ret;
}

export async function removeFactionFromRanks(factionId) {
  await Promise.all([
    client.zRem(FACTION_RANKED_KEY, String(factionId)),
    client.zRem(FACTION_DAILY_RANKED_KEY, String(factionId)),
    client.hDel(FACTION_MEMBER_COUNT_KEY, String(factionId)),
  ]);
}

export async function getFactionCount() {
  return client.zCard(FACTION_RANKED_KEY);
}
