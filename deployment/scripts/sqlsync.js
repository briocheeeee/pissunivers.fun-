/*
 * This script syncs the sql database and also DELETES AND ALTERS tables
 * it thinks are off.
 * This is not suitable for production, unless you make sure you got a backup
 */
import { sequelize, sync as syncSql } from '../../src/data/sql/index.js';
import { DailyCron, HourlyCron } from '../../src/utils/cron.js';

const LOG_QUERY = true;

async function initialize() {
  await syncSql(true);
}

async function destruct() {
  await sequelize.close();
  DailyCron.destructor();
  HourlyCron.destructor();
}

(async () => {
  sequelize.options.logging = (sql) => {
    if (LOG_QUERY) {
      console.log(sql);
    }
  };

  await initialize();

  await destruct();
})();
