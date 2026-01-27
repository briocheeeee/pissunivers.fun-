import { QueryTypes } from 'sequelize';
import sequelize from '../../../data/sql/sequelize.js';
import { getCurrentWeek, TOTW_CATEGORY, TOTW_AWARD_TYPE } from '../../../data/sql/TOTWWeek.js';
import { getNomineesForWeek } from '../../../data/sql/TOTWNominee.js';

export default async (req, res) => {
  try {
    const { weekId, category, awardType } = req.query;

    let week;
    if (weekId) {
      week = { id: parseInt(weekId, 10) };
    } else {
      week = await getCurrentWeek();
    }

    const categoryFilter = category !== undefined ? parseInt(category, 10) : null;
    const awardFilter = awardType !== undefined ? parseInt(awardType, 10) : null;

    const nominees = await getNomineesForWeek(week.id, categoryFilter, awardFilter);

    if (nominees.length === 0) {
      return res.json({
        week,
        nominees: [],
        categories: {
          [TOTW_CATEGORY.SMALL]: [],
          [TOTW_CATEGORY.MEDIUM]: [],
          [TOTW_CATEGORY.LARGE]: [],
        },
        specialAwards: [],
      });
    }

    const factionIds = [...new Set(nominees.map((n) => n.factionId))];
    const factions = await sequelize.query(
      'SELECT id, name, tag, avatar FROM Factions WHERE id IN (?)',
      {
        replacements: [factionIds],
        type: QueryTypes.SELECT,
      },
    );

    const factionMap = new Map(factions.map((f) => [f.id, f]));

    const enrichedNominees = nominees.map((n) => {
      const faction = factionMap.get(n.factionId) || {};
      return {
        ...n,
        factionName: faction.name,
        factionTag: faction.tag,
        factionAvatar: faction.avatar,
      };
    });

    const categories = {
      [TOTW_CATEGORY.SMALL]: enrichedNominees.filter(
        (n) => n.category === TOTW_CATEGORY.SMALL && n.awardType === TOTW_AWARD_TYPE.MAIN,
      ),
      [TOTW_CATEGORY.MEDIUM]: enrichedNominees.filter(
        (n) => n.category === TOTW_CATEGORY.MEDIUM && n.awardType === TOTW_AWARD_TYPE.MAIN,
      ),
      [TOTW_CATEGORY.LARGE]: enrichedNominees.filter(
        (n) => n.category === TOTW_CATEGORY.LARGE && n.awardType === TOTW_AWARD_TYPE.MAIN,
      ),
    };

    const specialAwards = enrichedNominees.filter(
      (n) => n.awardType !== TOTW_AWARD_TYPE.MAIN,
    );

    res.json({
      week,
      nominees: enrichedNominees,
      categories,
      specialAwards,
    });
  } catch (error) {
    console.error('Error getting nominees:', error);
    res.status(500).json({ errors: ['Failed to get nominees'] });
  }
};
