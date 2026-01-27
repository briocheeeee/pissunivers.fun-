import { getFactionById, FACTION_ROLE } from '../../../data/sql/Faction.js';
import {
  getFactionMemberRole,
  removeFactionMember,
  isFactionMember,
} from '../../../data/sql/FactionMember.js';

export default async (req, res) => {
  const { t } = req.ttag;
  const { user } = req;
  const { id } = req.params;
  const { userId } = req.body;

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
    res.status(403).json({ errors: [t`Only the owner can kick members`] });
    return;
  }

  const targetId = parseInt(userId, 10);
  if (Number.isNaN(targetId)) {
    res.status(400).json({ errors: [t`Invalid user ID`] });
    return;
  }

  if (targetId === user.id) {
    res.status(400).json({ errors: [t`You cannot kick yourself`] });
    return;
  }

  const isMember = await isFactionMember(factionId, targetId);
  if (!isMember) {
    res.status(400).json({ errors: [t`User is not a member of this faction`] });
    return;
  }

  const success = await removeFactionMember(factionId, targetId);
  if (!success) {
    res.status(500).json({ errors: [t`Failed to kick member`] });
    return;
  }

  res.json({ success: true });
};
