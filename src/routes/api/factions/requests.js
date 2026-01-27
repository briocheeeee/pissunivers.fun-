import { QueryTypes } from 'sequelize';
import { getFactionById, FACTION_ROLE } from '../../../data/sql/Faction.js';
import { getFactionMemberRole, addFactionMember } from '../../../data/sql/FactionMember.js';
import {
  getJoinRequests,
  getJoinRequestCount,
  deleteJoinRequestById,
} from '../../../data/sql/FactionRequest.js';
import sequelize from '../../../data/sql/sequelize.js';

export default async (req, res) => {
  const { t } = req.ttag;
  const { user } = req;
  const { id, requestId } = req.params;
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

  const userRole = await getFactionMemberRole(factionId, user.id);
  if (userRole !== FACTION_ROLE.OWNER) {
    res.status(403).json({ errors: [t`Only the owner can manage join requests`] });
    return;
  }

  if (req.method === 'GET') {
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 50), 100);
    const offsetNum = Math.max(0, parseInt(offset, 10) || 0);

    const [requests, totalCount] = await Promise.all([
      getJoinRequests(factionId, limitNum, offsetNum),
      getJoinRequestCount(factionId),
    ]);

    res.json({
      requests,
      total: totalCount,
      limit: limitNum,
      offset: offsetNum,
    });
    return;
  }

  if (req.method === 'POST') {
    const reqId = parseInt(requestId, 10);
    if (Number.isNaN(reqId)) {
      res.status(400).json({ errors: [t`Invalid request ID`] });
      return;
    }

    const request = await sequelize.query(
      'SELECT * FROM FactionRequests WHERE id = ? AND fid = ?',
      {
        replacements: [reqId, factionId],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );

    if (!request) {
      res.status(404).json({ errors: [t`Join request not found`] });
      return;
    }

    const isAccept = req.path.includes('/accept');

    if (isAccept) {
      const success = await addFactionMember(factionId, request.uid);
      if (!success) {
        res.status(500).json({ errors: [t`Failed to add member`] });
        return;
      }
    }

    await deleteJoinRequestById(reqId);

    res.json({
      success: true,
      action: isAccept ? 'accepted' : 'rejected',
    });
  }
};
