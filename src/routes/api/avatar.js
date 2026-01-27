import fetch from 'node-fetch';
import { setAvatar } from '../../data/sql/User.js';
import { IMGBB_KEY } from '../../core/config.js';

export default async (req, res) => {
  const { t } = req.ttag;
  const { user } = req;
  const { image } = req.body;

  if (!user) {
    res.status(401).json({ errors: [t`You are not logged in`] });
    return;
  }

  if (!IMGBB_KEY) {
    res.status(500).json({ errors: [t`Image upload is not configured`] });
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

    const success = await setAvatar(user.id, avatarUrl);
    if (!success) {
      res.status(500).json({ errors: [t`Failed to save avatar`] });
      return;
    }

    res.json({ success: true, avatar: avatarUrl });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ errors: [t`Failed to upload image`] });
  }
};
