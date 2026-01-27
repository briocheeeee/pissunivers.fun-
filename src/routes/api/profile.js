/*
 * get profile information of user
 */
import { getFishesOfUser } from '../../data/sql/Fish.js';
import { getBadgesOfUser } from '../../data/sql/Badge.js';

export default async (req, res) => {
  const { user: { id: uid } } = req;
  const fishes = await getFishesOfUser(uid);
  const badges = await getBadgesOfUser(uid);
  res.status(200).json({ fishes, badges });
};
