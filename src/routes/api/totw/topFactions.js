import { getTopFactions } from '../../../data/sql/TOTWWinner.js';

export default async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);

    const topFactions = await getTopFactions(limitNum);

    res.json({
      topFactions,
    });
  } catch (error) {
    console.error('Error getting top factions:', error);
    res.status(500).json({ errors: ['Failed to get top factions'] });
  }
};
