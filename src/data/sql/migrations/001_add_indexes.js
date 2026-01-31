import { QueryTypes } from 'sequelize';
import sequelize from '../sequelize.js';

export async function up() {
  const indexes = [
    {
      table: 'Sessions',
      name: 'idx_sessions_uid',
      columns: 'uid',
    },
    {
      table: 'Bans',
      name: 'idx_bans_expires',
      columns: 'expires',
    },
    {
      table: 'UserBans',
      name: 'idx_userbans_uid',
      columns: 'uid',
    },
    {
      table: 'UserBans',
      name: 'idx_userbans_bid',
      columns: 'bid',
    },
    {
      table: 'ThreePIDs',
      name: 'idx_threepids_uid',
      columns: 'uid',
    },
    {
      table: 'ThreePIDs',
      name: 'idx_threepids_provider_normalized',
      columns: 'provider, normalizedTpid',
    },
    {
      table: 'FactionMembers',
      name: 'idx_factionmembers_fid',
      columns: 'fid',
    },
    {
      table: 'Messages',
      name: 'idx_messages_cid_createdat',
      columns: 'cid, createdAt',
    },
  ];

  for (const idx of indexes) {
    try {
      const [existing] = await sequelize.query(
        `SHOW INDEX FROM ${idx.table} WHERE Key_name = ?`,
        { replacements: [idx.name], type: QueryTypes.SELECT },
      );
      if (!existing) {
        await sequelize.query(
          `CREATE INDEX ${idx.name} ON ${idx.table} (${idx.columns})`,
        );
        console.log(`Created index ${idx.name} on ${idx.table}`);
      } else {
        console.log(`Index ${idx.name} already exists on ${idx.table}`);
      }
    } catch (error) {
      console.error(`Failed to create index ${idx.name}: ${error.message}`);
    }
  }
}

export async function down() {
  const indexes = [
    { table: 'Sessions', name: 'idx_sessions_uid' },
    { table: 'Bans', name: 'idx_bans_expires' },
    { table: 'UserBans', name: 'idx_userbans_uid' },
    { table: 'UserBans', name: 'idx_userbans_bid' },
    { table: 'ThreePIDs', name: 'idx_threepids_uid' },
    { table: 'ThreePIDs', name: 'idx_threepids_provider_normalized' },
    { table: 'FactionMembers', name: 'idx_factionmembers_fid' },
    { table: 'Messages', name: 'idx_messages_cid_createdat' },
  ];

  for (const idx of indexes) {
    try {
      await sequelize.query(`DROP INDEX ${idx.name} ON ${idx.table}`);
      console.log(`Dropped index ${idx.name} from ${idx.table}`);
    } catch (error) {
      console.error(`Failed to drop index ${idx.name}: ${error.message}`);
    }
  }
}
