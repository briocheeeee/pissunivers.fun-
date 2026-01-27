import { sequelize, sync as syncSql, cleanDB } from '../../src/data/sql/index.js';
import { DailyCron, HourlyCron } from '../../src/utils/cron.js';

async function initialize() {
  await syncSql();
}

async function destruct() {
  await sequelize.close();
}

(async () => {
  DailyCron.destructor();
  HourlyCron.destructor();

  console.log('This migration script can potentially destroy your database! You have 15s to cancel by Ctrl-C before it starts.');
  await new Promise((res) => setTimeout(res, 15000));

  console.log(`Moving and cleaning up old data... this can take a LONG time!`);

  await sequelize.query(`DELETE m FROM Messages m LEFT JOIN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY cid ORDER BY id DESC) as rn FROM Messages) ranked WHERE rn <= 1000) keep ON m.id = keep.id WHERE keep.id IS NULL;

DELETE FROM Channels WHERE id NOT IN (SELECT ChannelId FROM UserChannels GROUP BY ChannelId HAVING COUNT(UserId) >= 2);`,{
    type: sequelize.QueryTypes.RAW,
    multipleStatements: true,
  });

  await sequelize.query(
`DROP TABLE Bans;
DROP TABLE IPInfos;
ALTER TABLE Channels RENAME OLD_Channels;
ALTER TABLE Fishes RENAME OLD_Fishes;
ALTER TABLE Messages RENAME OLD_Messages;
ALTER TABLE UserBlocks RENAME OLD_UserBlocks;
ALTER TABLE UserChannels RENAME OLD_UserChannels;
ALTER TABLE Users RENAME OLD_Users;
ALTER TABLE Whitelists RENAME OLD_Whitelists;`,{
    type: sequelize.QueryTypes.RAW,
    multipleStatements: true,
  });

  console.log('Syncing the database and creating the new layout!')
  await initialize();

  console.log('Populating Data...')
  await sequelize.query(`DROP TRIGGER set_username;

INSERT INTO Users (id, name, username, createdAt, password, userlvl, flags, lastSeen) SELECT id, name, CONCAT('pp_', id), createdAt, password, CASE WHEN roles = 1 THEN 80 WHEN verified > 0 THEN 20 ELSE 10 END, (priv << 1) | blocks, COALESCE(lastLogIn, NOW()) FROM OLD_Users ON DUPLICATE KEY UPDATE Users.id = Users.id;`, {
    type: sequelize.QueryTypes.RAW,
    multipleStatements: true,
  });

  await sequelize.query(`INSERT INTO IPs (ip, uuid, lastSeen) SELECT IP_TO_BIN(w.ip), UUID_TO_BIN(UUID()), NOW() FROM OLD_Whitelists w;

INSERT IGNORE INTO ProxyWhitelists (ip, createdAt) SELECT IP_TO_BIN(w.ip), NOW() FROM OLD_Whitelists w;

DELETE FROM Channels;`, {
    type: sequelize.QueryTypes.RAW,
    multipleStatements: true,
  });

  await sequelize.query(`INSERT IGNORE INTO Channels (id, name, type, lastMessage, createdAt) SELECT id, name, type, lastMessage, createdAt FROM OLD_Channels;

INSERT IGNORE INTO Messages (id, cid, uid, flag, message, createdAt) SELECT id, cid, uid, flag, message, createdAt FROM OLD_Messages;

INSERT IGNORE INTO UserChannels (uid, cid, lastRead) SELECT UserId, ChannelId, COALESCE(lastRead, NOW()) FROM OLD_UserChannels;

INSERT IGNORE INTO UserBlocks (uid, buid) SELECT uid, buid FROM OLD_UserBlocks;`, {
    type: sequelize.QueryTypes.RAW,
    multipleStatements: true,
  });

  await sequelize.query(`INSERT IGNORE INTO Fishes (id, uid, type, size, createdAt) SELECT id, uid, type, size, createdAt from OLD_Fishes;

INSERT IGNORE INTO ThreePIDs (provider, tpid, verified, lastSeen, createdAt, uid) SELECT 1, email, verified & 1, COALESCE(lastLogIn, NOW()), createdAt, id FROM OLD_Users o WHERE o.email IS NOT NULL;

INSERT IGNORE INTO ThreePIDs (provider, tpid, verified, lastSeen, createdAt, uid) SELECT 2, discordid, 1, COALESCE(lastLogIn, NOW()), createdAt, id FROM OLD_Users WHERE discordid IS NOT NULL;

INSERT IGNORE INTO ThreePIDs (provider, tpid, verified, lastSeen, createdAt, uid) SELECT 3, redditid, 0, COALESCE(lastLogIn, NOW()), createdAt, id FROM OLD_Users WHERE redditid IS NOT NULL;`, {
    type: sequelize.QueryTypes.RAW,
    multipleStatements: true,
  });

    await sequelize.query(`DROP Table OLD_Fishes;
DROP Table OLD_Messages;
DROP Table OLD_UserBlocks;
DROP Table OLD_UserChannels;
DROP Table OLD_Channels;
DROP Table OLD_Users;
DROP Table OLD_Whitelists;
`,{
    type: sequelize.QueryTypes.RAW,
    multipleStatements: true,
  });

  await sequelize.query(
    `CREATE TRIGGER IF NOT EXISTS set_username
BEFORE INSERT ON Users FOR EACH ROW
BEGIN
  IF NEW.username IS NULL OR NEW.username = '=' THEN
    SET NEW.username = CONCAT('pp_', (
      SELECT AUTO_INCREMENT FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'Users' AND TABLE_SCHEMA = DATABASE()
    ));
  ELSE
    SET NEW.username = REGEXP_REPLACE(NEW.username, '[^a-zA-Z0-9._-]', '');
  END IF;
END`);

  console.log('Done!');

  await destruct();
})();
