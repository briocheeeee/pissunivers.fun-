import fetch from 'node-fetch';
import { getFactionById, updateFaction, FACTION_ROLE } from '../../../data/sql/Faction.js';
import { getFactionMemberRole } from '../../../data/sql/FactionMember.js';

import { IMGBB_KEY } from '../../../core/config.js';

export default async (req, res) => {
  const { t } = req.ttag;
  const { user } = req;
  const { id } = req.params;
  const { image } = req.body;

  if (!IMGBB_KEY) {
    res.status(500).json({ errors: [t`Image upload is not configured`] });
    return;
  }

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
    res.status(403).json({ errors: [t`Only the owner can update the faction avatar`] });
    return;
  }

  if (!image) {
    res.status(400).json({ errors: [t`Image is required`] });
    return;
  }

  try {
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const formData = new URLSearchParams();
    formData.append('key', IMGBB_KEY);
    formData.append('image', base64Data);

    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!result.success) {
      res.status(500).json({ errors: [t`Failed to upload image`] });
      return;
    }

    const avatarUrl = result.data.url;

    await updateFaction(factionId, { avatar: avatarUrl });

    res.json({ success: true, avatar: avatarUrl });
  } catch (error) {
    console.error('IMGBB upload error:', error);
    res.status(500).json({ errors: [t`Failed to upload image`] });
  }
};
