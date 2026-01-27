import { getCurrentTOTWStatus } from '../../../core/TOTWService.js';

export default async (req, res) => {
  try {
    const status = await getCurrentTOTWStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting TOTW status:', error);
    res.status(500).json({ errors: ['Failed to get current TOTW status'] });
  }
};
