import { getFactionById, FACTION_ACCESS } from '../../../data/sql/Faction.js';
import {
  getUserFaction,
  addFactionMember,
  isFactionMember,
} from '../../../data/sql/FactionMember.js';
import {
  createJoinRequest,
  hasJoinRequest,
  getUserPendingRequest,
} from '../../../data/sql/FactionRequest.js';

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

  const existingFaction = await getUserFaction(user.id);
  if (existingFaction) {
    res.status(400).json({ errors: [t`You are already a member of a faction`] });
    return;
  }

  const alreadyMember = await isFactionMember(factionId, user.id);
  if (alreadyMember) {
    res.status(400).json({ errors: [t`You are already a member of this faction`] });
    return;
  }

  if (faction.access === FACTION_ACCESS.CLOSED) {
    res.status(403).json({ errors: [t`This faction is not accepting new members`] });
    return;
  }

  if (faction.access === FACTION_ACCESS.REQUEST) {
    const pendingRequest = await getUserPendingRequest(user.id);
    if (pendingRequest) {
      res.status(400).json({ errors: [t`You already have a pending request to another faction`] });
      return;
    }

    const alreadyRequested = await hasJoinRequest(factionId, user.id);
    if (alreadyRequested) {
      res.status(400).json({ errors: [t`You already have a pending request to this faction`] });
      return;
    }

    const success = await createJoinRequest(factionId, user.id);
    if (!success) {
      res.status(500).json({ errors: [t`Failed to create join request`] });
      return;
    }

    res.json({ success: true, requestSent: true });
    return;
  }

  const success = await addFactionMember(factionId, user.id);
  if (!success) {
    res.status(500).json({ errors: [t`Failed to join faction`] });
    return;
  }

  res.json({
    success: true,
    joined: true,
    faction: {
      id: faction.id,
      name: faction.name,
      tag: faction.tag,
    },
  });
};
