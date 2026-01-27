import { QueryTypes } from 'sequelize';
import sequelize from '../../../data/sql/sequelize.js';
import { getFactionById } from '../../../data/sql/Faction.js';
import { getFactionMemberRole, getFactionMembers } from '../../../data/sql/FactionMember.js';
import { getUserRanks } from '../../../data/redis/ranks.js';

export default async (req, res) => {
  const { id } = req.params;
  const factionId = parseInt(id, 10);

  if (Number.isNaN(factionId)) {
    res.status(400).json({ error: 'Invalid faction ID' });
    return;
  }

  const faction = await getFactionById(factionId);
  if (!faction) {
    res.status(404).json({ error: 'Faction not found' });
    return;
  }

  let isMember = false;
  if (req.user) {
    const role = await getFactionMemberRole(factionId, req.user.id);
    isMember = role !== null;
  }

  if (!isMember) {
    res.status(403).json({ error: 'You must be a member to view stats' });
    return;
  }

  try {
    const members = await getFactionMembers(factionId);

    const memberStatsPromises = members.map(async (member) => {
      const ranks = await getUserRanks(member.id);
      return {
        id: member.id,
        name: member.name,
        totalPixels: ranks[0] || 0,
        dailyPixels: ranks[1] || 0,
        totalRank: ranks[2] || 0,
        dailyRank: ranks[3] || 0,
      };
    });

    const memberStats = await Promise.all(memberStatsPromises);
    memberStats.sort((a, b) => b.totalPixels - a.totalPixels);

    const totalFactionPixels = memberStats.reduce((sum, m) => sum + m.totalPixels, 0);
    const dailyFactionPixels = memberStats.reduce((sum, m) => sum + m.dailyPixels, 0);

    res.json({
      factionId,
      factionName: faction.name,
      totalPixels: totalFactionPixels,
      dailyPixels: dailyFactionPixels,
      memberCount: memberStats.length,
      memberStats: memberStats.slice(0, 50),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};
