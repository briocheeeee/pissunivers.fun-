import { QueryTypes } from 'sequelize';
import sequelize from '../data/sql/sequelize.js';
import { updateFactionRanks } from '../data/redis/factionRanks.js';
import { FiveMinCron } from '../utils/cron.js';

async function updateAllFactionRanks() {
  try {
    const factions = await sequelize.query(
      'SELECT id FROM Factions',
      { type: QueryTypes.SELECT },
    );

    for (const faction of factions) {
      const members = await sequelize.query(
        'SELECT uid FROM FactionMembers WHERE fid = ?',
        {
          replacements: [faction.id],
          type: QueryTypes.SELECT,
        },
      );

      const memberIds = members.map((m) => m.uid);
      // eslint-disable-next-line no-await-in-loop
      await updateFactionRanks(faction.id, memberIds);
    }

    console.log(`Updated ranks for ${factions.length} factions`);
  } catch (error) {
    console.error(`Error updating faction ranks: ${error.message}`);
  }
}

FiveMinCron.hook(updateAllFactionRanks);

export { updateAllFactionRanks };
