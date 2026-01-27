import { getHallOfFame, getHallOfFameCount } from '../../../data/sql/TOTWWinner.js';

export default async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
    const offset = (pageNum - 1) * limitNum;

    const [winners, totalCount] = await Promise.all([
      getHallOfFame(limitNum, offset),
      getHallOfFameCount(),
    ]);

    res.json({
      winners,
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    });
  } catch (error) {
    console.error('Error getting hall of fame:', error);
    res.status(500).json({ errors: ['Failed to get hall of fame'] });
  }
};
