import { QueryTypes } from 'sequelize';
import sequelize from '../../../data/sql/sequelize.js';

export default async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ errors: ['Not logged in'] });
    }

    const factionMembership = await sequelize.query(
      'SELECT fid FROM FactionMembers WHERE uid = ?',
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    if (!factionMembership) {
      return res.json({
        hasFaction: false,
        nominations: 0,
        wins: 0,
        history: [],
      });
    }

    const factionId = factionMembership.fid;

    const nominations = await sequelize.query(
      'SELECT COUNT(*) as count FROM TOTWNominees WHERE factionId = ?',
      {
        replacements: [factionId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    const wins = await sequelize.query(
      'SELECT COUNT(*) as count FROM TOTWWinners WHERE factionId = ?',
      {
        replacements: [factionId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    const history = await sequelize.query(
      `SELECT 
        tw.weekNumber, tw.year, 
        tn.category, tn.awardType, tn.pixelsCaptured, tn.isWinner,
        twr.awardType as winAwardType
       FROM TOTWNominees tn
       JOIN TOTWWeeks tw ON tn.weekId = tw.id
       LEFT JOIN TOTWWinners twr ON twr.nomineeId = tn.id
       WHERE tn.factionId = ?
       ORDER BY tw.year DESC, tw.weekNumber DESC
       LIMIT 20`,
      {
        replacements: [factionId],
        type: QueryTypes.SELECT,
      },
    );

    const faction = await sequelize.query(
      'SELECT name, tag FROM Factions WHERE id = ?',
      {
        replacements: [factionId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    return res.json({
      hasFaction: true,
      factionId,
      factionName: faction?.name,
      factionTag: faction?.tag,
      nominations: nominations?.count || 0,
      wins: wins?.count || 0,
      history,
    });
  } catch (error) {
    console.error(`Error fetching TOTW my history: ${error.message}`);
    return res.status(500).json({ errors: ['Internal server error'] });
  }
};
