import { getFactionById, FACTION_ROLE } from '../../../data/sql/Faction.js';
import {
  getFactionMemberRole,
  isFactionMember,
  transferOwnership,
} from '../../../data/sql/FactionMember.js';

export default async (req, res) => {
  const { t } = req.ttag;
  const { user } = req;
  const { id } = req.params;
  const { newOwnerId } = req.body;

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
    res.status(403).json({ errors: [t`Only the owner can transfer ownership`] });
    return;
  }

  const targetId = parseInt(newOwnerId, 10);
  if (Number.isNaN(targetId)) {
    res.status(400).json({ errors: [t`Invalid user ID`] });
    return;
  }

  if (targetId === user.id) {
    res.status(400).json({ errors: [t`You are already the owner`] });
    return;
  }

  const isMember = await isFactionMember(factionId, targetId);
  if (!isMember) {
    res.status(400).json({ errors: [t`Target user is not a member of this faction`] });
    return;
  }

  const success = await transferOwnership(factionId, user.id, targetId);
  if (!success) {
    res.status(500).json({ errors: [t`Failed to transfer ownership`] });
    return;
  }

  res.json({ success: true });
};
