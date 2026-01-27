import { getUserFaction, getFactionMembers, getFactionMemberCount } from '../../../data/sql/FactionMember.js';
import { getJoinRequestCount, getJoinRequests } from '../../../data/sql/FactionRequest.js';
import { getFactionRanks } from '../../../data/redis/factionRanks.js';
import { FACTION_ROLE } from '../../../data/sql/Faction.js';

export default async (req, res) => {
  const { t } = req.ttag;
  const { user } = req;

  const faction = await getUserFaction(user.id);
  if (!faction) {
    res.status(404).json({ errors: [t`You are not a member of any faction`] });
    return;
  }

  const isOwner = faction.role === FACTION_ROLE.OWNER;

  const promises = [
    getFactionMemberCount(faction.id),
    getFactionMembers(faction.id, 50, 0),
    getFactionRanks(faction.id),
  ];

  if (isOwner) {
    promises.push(getJoinRequestCount(faction.id));
    promises.push(getJoinRequests(faction.id, 20, 0));
  }

  const [memberCount, members, ranks, requestCount, requests] = await Promise.all(promises);

  res.json({
    id: faction.id,
    name: faction.name,
    tag: faction.tag,
    avatar: faction.avatar,
    access: faction.access,
    role: faction.role,
    joinedAt: faction.joinedAt,
    memberCount,
    members,
    totalPixels: ranks.totalPixels,
    dailyPixels: ranks.dailyPixels,
    rank: ranks.totalRank,
    ...(isOwner && {
      requestCount: requestCount || 0,
      requests: requests || [],
    }),
  });
};
