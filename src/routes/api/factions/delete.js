import { getFactionById, deleteFaction, FACTION_ROLE } from '../../../data/sql/Faction.js';
import { getFactionMemberRole } from '../../../data/sql/FactionMember.js';

import { removeFactionFromRanks } from '../../../data/redis/factionRanks.js';
import { compareToHash } from '../../../utils/hash.js';

export default async (req, res) => {
  const { t } = req.ttag;
  const { user } = req;
  const { id } = req.params;
  const { password } = req.body;

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
    res.status(403).json({ errors: [t`Only the owner can delete the faction`] });
    return;
  }

  if (!password) {
    res.status(400).json({ errors: [t`Password is required to delete faction`] });
    return;
  }

  const { data } = user;
  if (!data.password || !compareToHash(password, data.password)) {
    res.status(403).json({ errors: [t`Invalid password`] });
    return;
  }

  const success = await deleteFaction(factionId);
  if (!success) {
    res.status(500).json({ errors: [t`Failed to delete faction`] });
    return;
  }

  await removeFactionFromRanks(factionId);

  res.json({ success: true });
};
