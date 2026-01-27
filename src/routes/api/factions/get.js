import { getFactionWithStats } from '../../../data/sql/Faction.js';
import { getFactionMemberCount, getUserFaction, isFactionMember } from '../../../data/sql/FactionMember.js';
import { hasJoinRequest } from '../../../data/sql/FactionRequest.js';
import { getFactionRanks } from '../../../data/redis/factionRanks.js';

export default async (req, res) => {
  const { t } = req.ttag;
  const { id } = req.params;
  const userId = req.user?.id;

  const factionId = parseInt(id, 10);
  if (Number.isNaN(factionId)) {
    res.status(400).json({ errors: [t`Invalid faction ID`] });
    return;
  }

  const faction = await getFactionWithStats(factionId);
  if (!faction) {
    res.status(404).json({ errors: [t`Faction not found`] });
    return;
  }

  const [memberCount, ranks] = await Promise.all([
    getFactionMemberCount(factionId),
    getFactionRanks(factionId),
  ]);

  const response = {
    id: faction.id,
    name: faction.name,
    tag: faction.tag,
    avatar: faction.avatar,
    access: faction.access,
    memberCount,
    totalPixels: ranks.totalPixels,
    dailyPixels: ranks.dailyPixels,
    rank: ranks.totalRank,
    createdAt: faction.createdAt,
  };

  if (userId) {
    const [isMember, hasPending] = await Promise.all([
      isFactionMember(factionId, userId),
      hasJoinRequest(factionId, userId),
    ]);
    response.isMember = isMember;
    response.hasPendingRequest = hasPending;

    if (isMember) {
      const userFaction = await getUserFaction(userId);
      response.role = userFaction?.role;
    }
  }

  res.json(response);
};
