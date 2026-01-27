import { getFactionById, FACTION_ROLE } from '../../../data/sql/Faction.js';
import {
  getUserFaction,
  removeFactionMember,
  getFactionMemberRole,
} from '../../../data/sql/FactionMember.js';

import { deleteJoinRequest } from '../../../data/sql/FactionRequest.js';

export default async (req, res) => {
  const { t } = req.ttag;
  const { user } = req;
  const { id } = req.params;

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

  const userFaction = await getUserFaction(user.id);
  if (!userFaction || userFaction.id !== factionId) {
    await deleteJoinRequest(factionId, user.id);
    res.json({ success: true, leftRequest: true });
    return;
  }

  const userRole = await getFactionMemberRole(factionId, user.id);
  if (userRole === FACTION_ROLE.OWNER) {
    res.status(400).json({ errors: [t`Owner cannot leave the faction. Transfer ownership or delete the faction.`] });
    return;
  }

  const success = await removeFactionMember(factionId, user.id);
  if (!success) {
    res.status(500).json({ errors: [t`Failed to leave faction`] });
    return;
  }

  res.json({ success: true });
};
