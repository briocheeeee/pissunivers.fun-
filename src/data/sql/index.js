import { QueryTypes } from 'sequelize';
import sequelize, { sync } from './sequelize.js';
import User, { USERLVL } from './User.js';
import Channel, { CHANNEL_TYPES } from './Channel.js';
import Message from './Message.js';
import Session from './Session.js';
import Device from './Device.js';
import IP from './IP.js';
import ProxyData from './Proxy.js';
import RangeData from './Range.js';
import Ban, { cleanBans } from './Ban.js';
import BanHistory from './BanHistory.js';
import WhoisReferral from './WhoisReferral.js';
import RangeBan, { cleanRangeBans } from './RangeBan.js';
import RangeBanHistory from './RangeBanHistory.js';
import ProxyWhitelist from './ProxyWhitelist.js';
import ThreePID, { THREEPID_PROVIDERS } from './ThreePID.js';
import ThreePIDHistory from './ThreePIDHistory.js';
import Fish from './Fish.js';
import Badge from './Badge.js';
import UserIP from './association_models/UserIP.js';
import UserBlock from './association_models/UserBlock.js';
import UserChannel from './association_models/UserChannel.js';
import UserBadge from './association_models/UserBadge.js';
import IPBan from './association_models/IPBan.js';
import UserBan from './association_models/UserBan.js';
import ThreePIDBan from './association_models/ThreePIDBan.js';
import IPBanHistory from './association_models/IPBanHistory.js';
import UserBanHistory from './association_models/UserBanHistory.js';
import ThreePIDBanHistory from './association_models/ThreePIDBanHistory.js';
import OIDCClient from './OIDCClient.js';
import OIDCAuthCode from './OIDCAuthCode.js';
import OIDCAccessToken from './OIDCAccessToken.js';
import OIDCRefreshToken from './OIDCRefreshToken.js';
import OIDCConsent from './OIDCConsent.js';
import Media from './Media.js';
import ImageHash from './ImageHash.js';
import UserMedia from './association_models/UserMedia.js';
import IPMedia from './association_models/IPMedia.js';
import MediaBan from './MediaBan.js';
import Faction, { FACTION_ACCESS, FACTION_ROLE } from './Faction.js';
import FactionMember from './FactionMember.js';
import FactionRequest from './FactionRequest.js';
import ModAction from './ModAction.js';
import BotDetection from './BotDetection.js';
import Donation from './Donation.js';
import TOTWWeek from './TOTWWeek.js';
import TOTWNominee from './TOTWNominee.js';
import TOTWVote from './TOTWVote.js';
import TOTWWinner from './TOTWWinner.js';
import MessageReaction from './MessageReaction.js';
import { HourlyCron } from '../../utils/cron.js';

/*
 * clean the database of crap
 */
export async function cleanDB() {
  const queries = [
    'DELETE FROM Ranges WHERE expires < NOW()',
    'DELETE FROM Proxies WHERE expires < NOW()',
    'DELETE FROM Sessions WHERE expires < NOW()',
    'DELETE FROM WhoisReferrals WHERE expires < NOW()',
    'DELETE FROM OIDCConsents WHERE expires < NOW()',
    'DELETE FROM OIDCAccessTokens WHERE expires < NOW()',
    'DELETE FROM OIDCAuthCodes WHERE expires < NOW()',
    'DELETE FROM OIDCRefreshTokens WHERE expires < NOW()',
    // eslint-disable-next-line
    'DELETE c FROM Channels c WHERE c.type = 1 AND (SELECT COUNT(*) FROM UserChannels uc WHERE uc.cid =c.id) <= 1',
  ];
  const functions = [
    cleanBans,
    cleanRangeBans,
  ];
  for (let i = 0; i < queries.length; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sequelize.query(queries[i], {
        raw: true,
        type: QueryTypes.DELETE,
      });
    } catch (error) {
      console.error(
        `SQL Error on clean-up query ${queries[i]}: ${error.message}`,
      );
    }
  }
  if (Math.random() < 0.1) {
    /*
     * delete all messages except the most recent 1000 per channel,
     * this is highly database specific, that query is for MySQL 8+ and
     * seems to work on MariaDB as well
     */
    try {
      await sequelize.query(`DELETE m FROM Messages m
LEFT JOIN (
  SELECT id FROM (
    SELECT id,
    ROW_NUMBER() OVER (PARTITION BY cid ORDER BY id DESC) as rn
    FROM Messages
  ) ranked WHERE rn <= 1000
) keep ON m.id = keep.id
WHERE keep.id IS NULL`, {
        raw: true,
        type: QueryTypes.DELETE,
      });
    } catch (error) {
      console.error(
        `SQL Error on clean-up messages : ${error.message}`,
      );
    }
  }
  for (let i = 0; i < functions.length; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await functions[i]();
    } catch (error) {
      console.error(
        `SQL Error on clean-up job ${functions[i].name}: ${error.message}`,
      );
    }
  }
}
HourlyCron.hook(cleanDB);

/*
 * Channels
 */
User.belongsToMany(Channel, {
  as: 'channels',
  through: UserChannel,
  foreignKey: 'uid',
});
Channel.belongsToMany(User, {
  as: 'users',
  through: UserChannel,
  foreignKey: 'cid',
});

/*
 * Fish
 */
Fish.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
  onDelete: 'CASCADE',
});

/*
 * Badges
 */
Badge.belongsToMany(User, {
  as: 'users',
  through: UserBadge,
  foreignKey: 'bid',
});
User.belongsToMany(Badge, {
  as: 'badges',
  through: UserBadge,
  foreignKey: 'uid',
});

/*
 * ip informations of user
 */
IP.belongsToMany(User, {
  as: 'users',
  through: UserIP,
  foreignKey: 'ip',
});
User.belongsToMany(IP, {
  as: 'ips',
  through: UserIP,
  foreignKey: 'uid',
});

/*
 * user sessions
 */
Session.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
  onDelete: 'CASCADE',
});
User.hasMany(Session, {
  as: 'sessions',
  foreignKey: 'uid',
});
Session.belongsTo(IP, {
  as: 'ipinfo',
  foreignKey: 'ip',
});
IP.hasMany(Session, {
  as: 'sessions',
  foreignKey: 'ip',
});
Session.belongsTo(Device, {
  as: 'device',
  foreignKey: 'did',
});
Device.hasMany(Session, {
  as: 'sessions',
  foreignKey: 'did',
});

/*
 * proxy information of ip
 */
ProxyData.belongsTo(IP, {
  as: 'ipinfo',
  foreignKey: 'ip',
  onDelete: 'CASCADE',
});
IP.hasOne(ProxyData, {
  as: 'proxy',
  foreignKey: 'ip',
});

/*
 * third party ids for oauth login
 */
ThreePID.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
});
User.hasMany(ThreePID, {
  as: 'tpids',
  foreignKey: 'uid',
});


/*
 * third party ids history
 */
ThreePIDHistory.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
  onDelete: 'CASCADE',
});
User.hasMany(ThreePIDHistory, {
  as: 'tpidsHistory',
  foreignKey: 'uid',
});

/*
 * ip range with whois info for ip
 */
IP.belongsTo(RangeData, {
  as: 'range',
  foreignKey: 'rid',
});

RangeData.hasMany(IP, {
  as: 'ips',
  foreignKey: 'rid',
});
/*
 * generic ban by threepid, userid and ip
 */
Ban.belongsToMany(IP, {
  as: 'ips',
  through: IPBan,
  foreignKey: 'bid',
});
IP.belongsToMany(Ban, {
  as: 'bans',
  through: IPBan,
  foreignKey: 'ip',
});
// tpid
Ban.belongsToMany(ThreePID, {
  as: 'tpids',
  through: ThreePIDBan,
  foreignKey: 'bid',
});
ThreePID.belongsToMany(Ban, {
  as: 'bans',
  through: ThreePIDBan,
  foreignKey: 'tid',
});
// user
Ban.belongsToMany(User, {
  as: 'users',
  through: UserBan,
  foreignKey: 'bid',
});
User.belongsToMany(Ban, {
  as: 'bans',
  through: UserBan,
  foreignKey: 'uid',
});
// mods
Ban.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
});
User.hasMany(Ban, {
  as: 'banActions',
  foreignKey: 'muid',
});
/*
 * history of past bans
 */
BanHistory.belongsToMany(IP, {
  as: 'ips',
  through: IPBanHistory,
  foreignKey: 'bid',
});
IP.belongsToMany(BanHistory, {
  as: 'banHistory',
  through: IPBanHistory,
  foreignKey: 'ip',
});
// tpid
BanHistory.belongsToMany(ThreePID, {
  as: 'tpids',
  through: ThreePIDBanHistory,
  foreignKey: 'bid',
});
ThreePID.belongsToMany(BanHistory, {
  as: 'banHistory',
  through: ThreePIDBanHistory,
  foreignKey: 'tid',
});
// user
BanHistory.belongsToMany(User, {
  as: 'users',
  through: UserBanHistory,
  foreignKey: 'bid',
});
User.belongsToMany(BanHistory, {
  as: 'banHistory',
  through: UserBanHistory,
  foreignKey: 'uid',
});
// mods
BanHistory.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
});
User.hasMany(BanHistory, {
  as: 'banActionHistory',
  foreignKey: 'muid',
});
BanHistory.belongsTo(User, {
  as: 'lmod',
  foreignKey: 'lmuid',
});
User.hasMany(BanHistory, {
  as: 'banLiftingHistory',
  foreignKey: 'lmuid',
});

/*
 * ip whitelist
 */
ProxyWhitelist.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
});
User.hasMany(ProxyWhitelist, {
  as: 'ipWhitelistActions',
  foreignKey: 'muid',
});
ProxyWhitelist.belongsTo(IP, {
  as: 'ipinfo',
  foreignKey: 'ip',
  onDelete: 'CASCADE',
});
IP.hasOne(ProxyWhitelist, {
  as: 'whitelist',
  foreignKey: 'ip',
});

/*
 * range ban
 */
RangeBan.belongsTo(RangeData, {
  as: 'iprange',
  foreignKey: 'rid',
  onDelete: 'CASCADE',
});
RangeData.hasOne(RangeBan, {
  as: 'bans',
  foreignKey: 'rid',
});
RangeBan.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
});
User.hasMany(RangeBan, {
  as: 'rangeBanActions',
  foreignKey: 'muid',
});

/*
 * ip range ban history
 */
RangeBanHistory.belongsTo(RangeData, {
  as: 'iprange',
  foreignKey: 'rid',
  onDelete: 'CASCADE',
});
RangeData.hasMany(RangeBanHistory, {
  as: 'banHistory',
  foreignKey: 'rid',
});
RangeBanHistory.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
});
User.hasMany(RangeBanHistory, {
  as: 'rangeBanActionHistory',
  foreignKey: 'muid',
});
RangeBanHistory.belongsTo(User, {
  as: 'lmod',
  foreignKey: 'lmuid',
});
User.hasMany(RangeBanHistory, {
  as: 'rangeBanLiftingHistory',
  foreignKey: 'lmuid',
});

/*
 * chat messages
 */
Message.belongsTo(Channel, {
  as: 'channel',
  foreignKey: 'cid',
  onDelete: 'CASCADE',
});
Message.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
  onDelete: 'CASCADE',
});

/*
 * User blocks of other user
 *
 * uid: User that blocks
 * buid: User that is blocked
 */
User.belongsToMany(User, {
  as: 'blocked',
  through: UserBlock,
  foreignKey: 'uid',
});
User.belongsToMany(User, {
  as: 'blockedBy',
  through: UserBlock,
  foreignKey: 'buid',
});

/*
 * OpenID Connect
 */
OIDCConsent.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
  onDelete: 'CASCADE',
});
User.hasMany(OIDCConsent, {
  as: 'oicdRefreshTokens',
  foreignKey: 'uid',
});
OIDCClient.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
  onDelete: 'CASCADE',
});
User.hasMany(OIDCClient, {
  as: 'oicdClients',
  foreignKey: 'uid',
});
OIDCConsent.belongsTo(OIDCClient, {
  as: 'client',
  foreignKey: 'cid',
  onDelete: 'CASCADE',
});
OIDCClient.hasMany(OIDCConsent, {
  as: 'refreshTokens',
  foreignKey: 'cid',
});

OIDCAuthCode.belongsTo(OIDCConsent, {
  as: 'consent',
  foreignKey: 'cid',
  onDelete: 'CASCADE',
});
OIDCConsent.hasMany(OIDCAuthCode, {
  as: 'authCodes',
  foreignKey: 'cid',
});

OIDCAccessToken.belongsTo(OIDCConsent, {
  as: 'consent',
  foreignKey: 'cid',
  onDelete: 'CASCADE',
});
OIDCConsent.hasMany(OIDCAccessToken, {
  as: 'accessTokens',
  foreignKey: 'cid',
});

OIDCRefreshToken.belongsTo(OIDCConsent, {
  as: 'consent',
  foreignKey: 'cid',
  onDelete: 'CASCADE',
});
OIDCConsent.hasMany(OIDCRefreshToken, {
  as: 'refreshTokens',
  foreignKey: 'cid',
});

/*
 * Media repository
 */
Media.belongsTo(ImageHash, {
  as: 'imagedata',
  foreignKey: 'mid',
  onDelete: 'CASCADE',
});
ImageHash.hasOne(Media, {
  as: 'media',
  foreignKey: 'mid',
});
Media.belongsToMany(User, {
  as: 'users',
  through: UserMedia,
  foreignKey: 'mid',
});
User.belongsToMany(Media, {
  as: 'medias',
  through: UserMedia,
  foreignKey: 'uid',
});
Media.belongsToMany(IP, {
  as: 'ips',
  through: IPMedia,
  foreignKey: 'mid',
});
IP.belongsToMany(Media, {
  as: 'medias',
  through: IPMedia,
  foreignKey: 'ip',
});
MediaBan.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
});
User.hasMany(MediaBan, {
  as: 'mediaBanActions',
  foreignKey: 'muid',
});

Faction.belongsTo(User, {
  as: 'owner',
  foreignKey: 'ownerId',
  onDelete: 'CASCADE',
});
User.hasOne(Faction, {
  as: 'ownedFaction',
  foreignKey: 'ownerId',
});

FactionMember.belongsTo(Faction, {
  as: 'faction',
  foreignKey: 'fid',
  onDelete: 'CASCADE',
});
Faction.hasMany(FactionMember, {
  as: 'members',
  foreignKey: 'fid',
});

FactionMember.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
  onDelete: 'CASCADE',
});
User.hasOne(FactionMember, {
  as: 'factionMembership',
  foreignKey: 'uid',
});

FactionRequest.belongsTo(Faction, {
  as: 'faction',
  foreignKey: 'fid',
  onDelete: 'CASCADE',
});
Faction.hasMany(FactionRequest, {
  as: 'requests',
  foreignKey: 'fid',
});

FactionRequest.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
  onDelete: 'CASCADE',
});
User.hasMany(FactionRequest, {
  as: 'factionRequests',
  foreignKey: 'uid',
});

ModAction.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
  onDelete: 'SET NULL',
});
User.hasMany(ModAction, {
  as: 'modActions',
  foreignKey: 'muid',
});

BotDetection.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
  onDelete: 'SET NULL',
});
User.hasMany(BotDetection, {
  as: 'botDetections',
  foreignKey: 'uid',
});
BotDetection.belongsTo(User, {
  as: 'decider',
  foreignKey: 'decidedBy',
  onDelete: 'SET NULL',
});

Donation.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
  onDelete: 'CASCADE',
});
User.hasMany(Donation, {
  as: 'donations',
  foreignKey: 'uid',
});

TOTWNominee.belongsTo(TOTWWeek, {
  as: 'week',
  foreignKey: 'weekId',
  onDelete: 'CASCADE',
});
TOTWWeek.hasMany(TOTWNominee, {
  as: 'nominees',
  foreignKey: 'weekId',
});

TOTWNominee.belongsTo(Faction, {
  as: 'faction',
  foreignKey: 'factionId',
  onDelete: 'CASCADE',
});
Faction.hasMany(TOTWNominee, {
  as: 'totwNominations',
  foreignKey: 'factionId',
});

TOTWVote.belongsTo(TOTWWeek, {
  as: 'week',
  foreignKey: 'weekId',
  onDelete: 'CASCADE',
});
TOTWWeek.hasMany(TOTWVote, {
  as: 'votes',
  foreignKey: 'weekId',
});

TOTWVote.belongsTo(TOTWNominee, {
  as: 'nominee',
  foreignKey: 'nomineeId',
  onDelete: 'CASCADE',
});
TOTWNominee.hasMany(TOTWVote, {
  as: 'votes',
  foreignKey: 'nomineeId',
});

TOTWVote.belongsTo(User, {
  as: 'voter',
  foreignKey: 'oderId',
  onDelete: 'SET NULL',
});
User.hasMany(TOTWVote, {
  as: 'totwVotes',
  foreignKey: 'oderId',
});

TOTWWinner.belongsTo(TOTWWeek, {
  as: 'week',
  foreignKey: 'weekId',
  onDelete: 'CASCADE',
});
TOTWWeek.hasMany(TOTWWinner, {
  as: 'winners',
  foreignKey: 'weekId',
});

TOTWWinner.belongsTo(Faction, {
  as: 'faction',
  foreignKey: 'factionId',
  onDelete: 'CASCADE',
});
Faction.hasMany(TOTWWinner, {
  as: 'totwWins',
  foreignKey: 'factionId',
});

TOTWWinner.belongsTo(TOTWNominee, {
  as: 'nominee',
  foreignKey: 'nomineeId',
  onDelete: 'CASCADE',
});
TOTWNominee.hasOne(TOTWWinner, {
  as: 'winner',
  foreignKey: 'nomineeId',
});

MessageReaction.belongsTo(Message, {
  as: 'message',
  foreignKey: 'messageId',
  onDelete: 'CASCADE',
});
Message.hasMany(MessageReaction, {
  as: 'reactions',
  foreignKey: 'messageId',
});

MessageReaction.belongsTo(User, {
  as: 'user',
  foreignKey: 'oderId',
  onDelete: 'CASCADE',
});
User.hasMany(MessageReaction, {
  as: 'reactions',
  foreignKey: 'oderId',
});

export {
  sync,
  sequelize,
  // Models
  ProxyWhitelist,
  User,
  Channel,
  UserChannel,
  Message,
  UserBlock,
  RangeData,
  IP,
  Ban,
  WhoisReferral,
  ThreePID,
  Fish,
  Faction,
  FactionMember,
  FactionRequest,
  ModAction,
  BotDetection,
  TOTWWeek,
  TOTWNominee,
  TOTWVote,
  TOTWWinner,
  MessageReaction,
  // constants
  USERLVL,
  THREEPID_PROVIDERS,
  CHANNEL_TYPES,
  FACTION_ACCESS,
  FACTION_ROLE,
  Donation,
};
