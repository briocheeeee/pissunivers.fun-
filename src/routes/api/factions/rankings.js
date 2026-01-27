import { QueryTypes } from 'sequelize';
import { getFactionRankings, getFactionCount } from '../../../data/redis/factionRanks.js';
import sequelize from '../../../data/sql/sequelize.js';

export default async (req, res) => {
  const { t } = req.ttag;
  const { page = 1, limit = 20, daily = false } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
  const isDaily = daily === 'true' || daily === '1';

  const start = (pageNum - 1) * limitNum + 1;

  const [rankings, totalCount] = await Promise.all([
    getFactionRankings(isDaily, start, limitNum),
    getFactionCount(),
  ]);

  if (rankings.length > 0) {
    const factionIds = rankings.map((r) => r.id);
    const factions = await sequelize.query(
      'SELECT id, name, tag, avatar FROM Factions WHERE id IN (?)',
      {
        replacements: [factionIds],
        type: QueryTypes.SELECT,
      },
    );

    const factionMap = new Map(factions.map((f) => [f.id, f]));

    for (const rank of rankings) {
      const faction = factionMap.get(rank.id);
      if (faction) {
        rank.name = faction.name;
        rank.tag = faction.tag;
        rank.avatar = faction.avatar;
      }
    }
  }

  res.json({
    rankings,
    total: totalCount,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(totalCount / limitNum),
  });
};
