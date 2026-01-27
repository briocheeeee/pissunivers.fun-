import { QueryTypes } from 'sequelize';
import sequelize from '../../../data/sql/sequelize.js';
import { getPastWeeks, getPastWeeksCount, getWeekById } from '../../../data/sql/TOTWWeek.js';
import { getWinnersForWeek } from '../../../data/sql/TOTWWinner.js';

export default async (req, res) => {
  try {
    const { page = 1, limit = 10, weekId } = req.query;

    if (weekId) {
      const week = await getWeekById(parseInt(weekId, 10));
      if (!week) {
        return res.status(404).json({ errors: ['Week not found'] });
      }

      const winners = await getWinnersForWeek(week.id);

      if (winners.length > 0) {
        const factionIds = [...new Set(winners.map((w) => w.factionId))];
        const factions = await sequelize.query(
          'SELECT id, name, tag, avatar FROM Factions WHERE id IN (?)',
          {
            replacements: [factionIds],
            type: QueryTypes.SELECT,
          },
        );

        const factionMap = new Map(factions.map((f) => [f.id, f]));

        for (const winner of winners) {
          const faction = factionMap.get(winner.factionId) || {};
          winner.factionName = faction.name;
          winner.factionTag = faction.tag;
          winner.factionAvatar = faction.avatar;
        }
      }

      return res.json({ week, winners });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);
    const offset = (pageNum - 1) * limitNum;

    const [weeks, totalCount] = await Promise.all([
      getPastWeeks(limitNum, offset),
      getPastWeeksCount(),
    ]);

    res.json({
      weeks,
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error('Error getting week history:', error);
    res.status(500).json({ errors: ['Failed to get week history'] });
  }
};
