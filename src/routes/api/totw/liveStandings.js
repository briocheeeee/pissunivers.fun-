import { QueryTypes } from 'sequelize';
import sequelize from '../../../data/sql/sequelize.js';
import { getFactionRankings } from '../../../data/redis/factionRanks.js';
import { getCurrentWeek } from '../../../data/sql/TOTWWeek.js';
import { getRecentWinners } from '../../../data/sql/TOTWNominee.js';

const ANTI_MONOPOLE_WEEKS = 3;
const FACTION_SIZE_THRESHOLDS = {
  SMALL_MAX: 10,
  MEDIUM_MAX: 30,
};

function getFactionCategory(memberCount) {
  if (memberCount <= FACTION_SIZE_THRESHOLDS.SMALL_MAX) return 0;
  if (memberCount <= FACTION_SIZE_THRESHOLDS.MEDIUM_MAX) return 1;
  return 2;
}

export default async (req, res) => {
  try {
    const week = await getCurrentWeek();

    if (week.votingOpen || week.finalized) {
      return res.json({
        available: false,
        message: 'Live standings not available during voting or after finalization',
      });
    }

    const recentWinners = await getRecentWinners(ANTI_MONOPOLE_WEEKS);

    const factions = await sequelize.query(
      `SELECT f.id, f.name, f.tag, f.avatar,
              (SELECT COUNT(*) FROM FactionMembers fm WHERE fm.fid = f.id) as memberCount
       FROM Factions f
       WHERE (SELECT COUNT(*) FROM FactionMembers fm WHERE fm.fid = f.id) >= 2`,
      { type: QueryTypes.SELECT },
    );

    const rankings = await getFactionRankings(1, 1000, true);
    const rankMap = new Map();
    if (rankings && rankings.rankings) {
      rankings.rankings.forEach((r) => {
        rankMap.set(r.id, r.dailyPixels || 0);
      });
    }

    const standings = {
      0: [],
      1: [],
      2: [],
    };

    for (const faction of factions) {
      if (recentWinners.has(faction.id)) continue;

      const category = getFactionCategory(faction.memberCount);
      const dailyPixels = rankMap.get(faction.id) || 0;

      standings[category].push({
        factionId: faction.id,
        factionName: faction.name,
        factionTag: faction.tag,
        factionAvatar: faction.avatar,
        memberCount: faction.memberCount,
        pixelsCaptured: dailyPixels,
      });
    }

    for (const category of [0, 1, 2]) {
      standings[category].sort((a, b) => b.pixelsCaptured - a.pixelsCaptured);
      standings[category] = standings[category].slice(0, 5);
    }

    return res.json({
      available: true,
      week: {
        weekNumber: week.weekNumber,
        year: week.year,
      },
      standings,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error(`Error fetching live standings: ${error.message}`);
    return res.status(500).json({ errors: ['Internal server error'] });
  }
};
