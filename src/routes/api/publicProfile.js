import { getPublicProfile } from '../../data/sql/User.js';
import { getUserRanks } from '../../data/redis/ranks.js';
import { USER_FLAGS } from '../../core/constants.js';
import socketEvents from '../../socket/socketEvents.js';

export default async (req, res) => {
  const { t } = req.ttag;
  const uid = parseInt(req.params.uid, 10);

  if (Number.isNaN(uid)) {
    res.status(400).json({ errors: [t`Invalid user id`] });
    return;
  }

  const profile = await getPublicProfile(uid);

  if (!profile) {
    res.status(404).json({ errors: [t`User not found`] });
    return;
  }

  const isPrivate = (profile.flags & (0x01 << USER_FLAGS.PRIV)) !== 0;

  let onlineConnections = 0;
  let activeConnections = 0;
  try {
    const presence = await socketEvents.reqAll('userPresence', uid);
    onlineConnections = presence?.onlineConnections || 0;
    activeConnections = presence?.activeConnections || 0;
  } catch {
    onlineConnections = 0;
    activeConnections = 0;
  }
  let status = 'offline';
  if (activeConnections > 0) {
    status = 'online';
  } else if (onlineConnections > 0) {
    status = 'idle';
  }

  const [totalPixels, dailyPixels, totalRanking, dailyRanking] = await getUserRanks(uid);

  res.status(200).json({
    id: profile.id,
    name: profile.name,
    username: profile.username,
    userlvl: profile.userlvl,
    avatar: profile.avatar || null,
    banner: profile.banner || null,
    description: profile.description || null,
    createdAt: profile.createdAt,
    lastSeen: profile.lastSeen,
    isOnline: activeConnections > 0,
    isIdle: status === 'idle',
    status,
    isPrivate,
    totalPixels: totalPixels || 0,
    dailyPixels: dailyPixels || 0,
    totalRanking: totalRanking || 0,
    dailyRanking: dailyRanking || 0,
  });
};
