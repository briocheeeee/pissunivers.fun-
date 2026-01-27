import { getFactionWins, getFactionWinCount } from '../../../data/sql/TOTWWinner.js';
import { getFactionById } from '../../../data/sql/Faction.js';

export default async (req, res) => {
  try {
    const { factionId } = req.params;
    const { limit = 10 } = req.query;

    const fid = parseInt(factionId, 10);
    if (Number.isNaN(fid)) {
      return res.status(400).json({ errors: ['Invalid faction ID'] });
    }

    const faction = await getFactionById(fid);
    if (!faction) {
      return res.status(404).json({ errors: ['Faction not found'] });
    }

    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);

    const [wins, totalWins] = await Promise.all([
      getFactionWins(fid, limitNum),
      getFactionWinCount(fid),
    ]);

    res.json({
      faction: {
        id: faction.id,
        name: faction.name,
        tag: faction.tag,
        avatar: faction.avatar,
      },
      wins,
      totalWins,
    });
  } catch (error) {
    console.error('Error getting faction history:', error);
    res.status(500).json({ errors: ['Failed to get faction history'] });
  }
};
