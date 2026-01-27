import {
  getFactionById,
  updateFaction,
  checkFactionNameExists,
  checkFactionTagExists,
  FACTION_ACCESS,
  FACTION_ROLE } from '../../../data/sql/Faction.js';
import { getFactionMemberRole } from '../../../data/sql/FactionMember.js';

export default async (req, res) => {
  const { t } = req.ttag;
  const { user } = req;
  const { id } = req.params;
  const { name, tag, access, avatar } = req.body;

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
    res.status(403).json({ errors: [t`Only the owner can update the faction`] });
    return;
  }

  const updates = {};
  const errors = [];

  if (name !== undefined) {
    const trimmedName = name.trim();
    if (trimmedName.length < 3 || trimmedName.length > 32) {
      errors.push(t`Faction name must be between 3 and 32 characters`);
    } else if (!/^[a-zA-Z0-9\s_-]+$/.test(trimmedName)) {
      errors.push(t`Faction name can only contain letters, numbers, spaces, underscores and hyphens`);
    } else if (trimmedName !== faction.name) {
      const nameExists = await checkFactionNameExists(trimmedName, factionId);
      if (nameExists) {
        errors.push(t`Faction name is already taken`);
      } else {
        updates.name = trimmedName;
      }
    }
  }

  if (tag !== undefined) {
    const trimmedTag = tag.trim().toUpperCase();
    if (trimmedTag.length < 2 || trimmedTag.length > 8) {
      errors.push(t`Faction tag must be between 2 and 8 characters`);
    } else if (!/^[a-zA-Z0-9]+$/.test(trimmedTag)) {
      errors.push(t`Faction tag can only contain letters and numbers`);
    } else if (trimmedTag !== faction.tag) {
      const tagExists = await checkFactionTagExists(trimmedTag, factionId);
      if (tagExists) {
        errors.push(t`Faction tag is already taken`);
      } else {
        updates.tag = trimmedTag;
      }
    }
  }

  if (access !== undefined) {
    const accessNum = Number(access);
    if (Number.isNaN(accessNum) || !Object.values(FACTION_ACCESS).includes(accessNum)) {
      errors.push(t`Invalid access mode`);
    } else {
      updates.access = accessNum;
    }
  }

  if (avatar !== undefined) {
    updates.avatar = avatar || null;
  }

  if (errors.length) {
    res.status(400).json({ errors });
    return;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ errors: [t`No changes provided`] });
    return;
  }

  const success = await updateFaction(factionId, updates);
  if (!success) {
    res.status(500).json({ errors: [t`Failed to update faction`] });
    return;
  }

  res.json({ success: true, updates });
};
