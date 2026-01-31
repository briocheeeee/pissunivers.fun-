import express from 'express';
import sequelize from '../data/sql/sequelize.js';
import client from '../data/redis/client.js';
import logger from '../core/logger.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      mysql: 'unknown',
      redis: 'unknown',
    },
  };

  let allHealthy = true;

  try {
    await sequelize.authenticate();
    health.services.mysql = 'ok';
  } catch (error) {
    health.services.mysql = 'error';
    allHealthy = false;
    logger.error(`HEALTH: MySQL check failed: ${error.message}`);
  }

  try {
    await client.ping();
    health.services.redis = 'ok';
  } catch (error) {
    health.services.redis = 'error';
    allHealthy = false;
    logger.error(`HEALTH: Redis check failed: ${error.message}`);
  }

  if (!allHealthy) {
    health.status = 'degraded';
    res.status(503).json(health);
    return;
  }

  res.status(200).json(health);
});

export default router;
