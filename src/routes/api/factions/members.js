import { getFactionById } from '../../../data/sql/Faction.js';
import { getFactionMembers, getFactionMemberCount } from '../../../data/sql/FactionMember.js';

export default async (req, res) => {
  const { t } = req.ttag;
  const { id } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  const factionId = parseInt(id, 10);
  if (Number.isNaN(factionId)) {
    res.status(400).json({ errors: [t`Invalid faction ID`] });
    return;
  }

  const faction = await getFactionById(factionId);
  if (!faction) {
    res.status(404).json({ errors: [t`Faction not found`] });
    return;
  }

  const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 50), 100);
  const offsetNum = Math.max(0, parseInt(offset, 10) || 0);

  const [members, totalCount] = await Promise.all([
    getFactionMembers(factionId, limitNum, offsetNum),
    getFactionMemberCount(factionId),
  ]);

  res.json({
    members,
    total: totalCount,
    limit: limitNum,
    offset: offsetNum,
  });
};
