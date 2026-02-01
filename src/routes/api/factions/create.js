import {
  createFaction,
  checkFactionNameExists,
  checkFactionTagExists,
  FACTION_ACCESS,
} from '../../../data/sql/Faction.js';
import { getUserFaction } from '../../../data/sql/FactionMember.js';
import { getUserPendingRequest } from '../../../data/sql/FactionRequest.js';
import { awardBadge } from '../../../data/sql/awardBadge.js';

function validateName(name) {
  if (!name || typeof name !== 'string') {
    return 'Faction name is required';
  }
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 32) {
    return 'Faction name must be between 3 and 32 characters';
  }
  if (!/^[a-zA-Z0-9\s_-]+$/.test(trimmed)) {
    return 'Faction name can only contain letters, numbers, spaces, underscores and hyphens';
  }
  return null;
}

function validateTag(tag) {
  if (!tag || typeof tag !== 'string') {
    return 'Faction tag is required';
  }
  const trimmed = tag.trim();
  if (trimmed.length < 2 || trimmed.length > 8) {
    return 'Faction tag must be between 2 and 8 characters';
  }
  if (!/^[a-zA-Z0-9]+$/.test(trimmed)) {
    return 'Faction tag can only contain letters and numbers';
  }
  return null;
}

function validateAccess(access) {
  if (access === undefined || access === null) {
    return null;
  }
  const accessNum = Number(access);
  if (Number.isNaN(accessNum) || !Object.values(FACTION_ACCESS).includes(accessNum)) {
    return 'Invalid access mode';
  }
  return null;
}

export default async (req, res) => {
  const { t } = req.ttag;
  const { user } = req;
  const { name, tag, access, avatar } = req.body;

  const errors = [];

  const nameError = validateName(name);
  if (nameError) errors.push(nameError);

  const tagError = validateTag(tag);
  if (tagError) errors.push(tagError);

  const accessError = validateAccess(access);
  if (accessError) errors.push(accessError);

  if (errors.length) {
    res.status(400).json({ errors });
    return;
  }

  const existingFaction = await getUserFaction(user.id);
  if (existingFaction) {
    res.status(400).json({ errors: [t`You are already a member of a faction`] });
    return;
  }

  const pendingRequest = await getUserPendingRequest(user.id);
  if (pendingRequest) {
    res.status(400).json({ errors: [t`You have a pending join request. Cancel it first.`] });
    return;
  }

  const trimmedName = name.trim();
  const trimmedTag = tag.trim().toUpperCase();

  const [nameExists, tagExists] = await Promise.all([
    checkFactionNameExists(trimmedName),
    checkFactionTagExists(trimmedTag),
  ]);

  if (nameExists) {
    res.status(400).json({ errors: [t`Faction name is already taken`] });
    return;
  }

  if (tagExists) {
    res.status(400).json({ errors: [t`Faction tag is already taken`] });
    return;
  }

  try {
    const faction = await createFaction(
      trimmedName,
      trimmedTag,
      user.id,
      access !== undefined ? Number(access) : FACTION_ACCESS.OPEN,
      avatar || null,
    );

    awardBadge(user.id, 'Faction Leader', `Created faction: ${trimmedName}`);

    res.status(201).json({
      success: true,
      faction: {
        id: faction.id,
        name: faction.name,
        tag: faction.tag,
        access: faction.access,
        avatar: faction.avatar,
      },
    });
  } catch (error) {
    console.error(`Error creating faction: ${error.message}`);
    res.status(500).json({ errors: [t`Failed to create faction`] });
  }
};
