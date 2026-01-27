import express from 'express';
import fs from 'fs';

import logger from '../../core/logger.js';
import { USERLVL } from '../../data/sql/index.js';
import {
  getBotDetections,
  getBotDetectionById,
  updateBotDetectionStatus,
  getDetectionStats,
  DECISION_STATUS,
} from '../../data/sql/BotDetection.js';
import { ban } from '../../core/ban.js';
import { getBotDetectionService } from '../../core/BotDetectionService.js';
import { getBotDetectionRecorder } from '../../core/BotDetectionRecorder.js';
import { getScriptedLineDetector } from '../../core/ScriptedLineDetector.js';
import { logModAction } from '../../data/sql/ModAction.js';
import chatProvider from '../../core/ChatProvider.js';
import rollbackCanvasArea from '../../core/rollback.js';
import { getIIDPixels } from '../../core/parsePixelLog.js';
import { getIPofIID } from '../../data/sql/IP.js';

const router = express.Router();

const BOT_BAN_MESSAGE = 'Our auto-detection system has flagged you as a suspected user of an auto-placement script. A moderator reviewed a video of your suspicious placement and determined that it was an auto-placement script. If this is an unfortunate mistake on our part, please report it to us on the Discord server available on the help page.';

const BOT_BAN_DURATION = 30 * 24 * 60 * 60;

router.use(async (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not logged in' });
    return;
  }
  if (req.user.userlvl < USERLVL.MOD) {
    res.status(403).json({ error: 'Insufficient permissions' });
    return;
  }
  next();
});

router.get('/list', async (req, res) => {
  try {
    const {
      status,
      level,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = req.query;

    const result = await getBotDetections({
      status: status || null,
      level: level || null,
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      sortBy,
      sortOrder: sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
    });

    res.json(result);
  } catch (error) {
    logger.error(`BOT_DETECTION_API: Error fetching list: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch detections' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await getDetectionStats();
    res.json(stats || {});
  } catch (error) {
    logger.error(`BOT_DETECTION_API: Error fetching stats: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/detail/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const detection = await getBotDetectionById(parseInt(id, 10));

    if (!detection) {
      res.status(404).json({ error: 'Detection not found' });
      return;
    }

    let recordingData = null;
    if (detection.videoPath && fs.existsSync(detection.videoPath)) {
      try {
        const recorder = getBotDetectionRecorder();
        recordingData = await recorder.loadRecording(detection.videoPath);
      } catch (e) {
        logger.warn(`BOT_DETECTION_API: Could not load recording: ${e.message}`);
      }
    }

    res.json({
      ...detection,
      recording: recordingData,
    });
  } catch (error) {
    logger.error(`BOT_DETECTION_API: Error fetching detail: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch detection details' });
  }
});

router.post('/dismiss/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const detectionId = parseInt(id, 10);

    const detection = await getBotDetectionById(detectionId);
    if (!detection) {
      res.status(404).json({ error: 'Detection not found' });
      return;
    }

    if (detection.status !== DECISION_STATUS.PENDING) {
      res.status(400).json({ error: 'Detection already processed' });
      return;
    }

    const success = await updateBotDetectionStatus(
      detectionId,
      DECISION_STATUS.DISMISSED,
      req.user.id,
    );

    if (!success) {
      res.status(500).json({ error: 'Failed to update status' });
      return;
    }

    if (detection.videoPath) {
      const recorder = getBotDetectionRecorder();
      await recorder.cleanupRecording(detectionId, detection.videoPath);
    }

    logModAction(
      req.user.id,
      'bot_detection_dismiss',
      `detection:${detectionId}`,
      `user:${detection.uid || detection.ipString}`,
    );

    logger.info(
      `BOT_DETECTION: Detection ${detectionId} dismissed by ${req.user.name}`,
    );

    res.json({ success: true });
  } catch (error) {
    logger.error(`BOT_DETECTION_API: Error dismissing: ${error.message}`);
    res.status(500).json({ error: 'Failed to dismiss detection' });
  }
});

router.post('/ban/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const detectionId = parseInt(id, 10);

    const detection = await getBotDetectionById(detectionId);
    if (!detection) {
      res.status(404).json({ error: 'Detection not found' });
      return;
    }

    if (detection.status !== DECISION_STATUS.PENDING) {
      res.status(400).json({ error: 'Detection already processed' });
      return;
    }

    const ipStrings = detection.ipString ? [detection.ipString] : null;
    const userIds = detection.uid ? [detection.uid] : null;

    const banResult = await ban(
      ipStrings,
      userIds,
      null,
      false,
      true,
      'Bot/Script auto-placement',
      BOT_BAN_DURATION,
      req.user.id,
    );

    if (!banResult || (!banResult[0]?.length && !banResult[1]?.length)) {
      res.status(500).json({ error: 'Failed to apply ban' });
      return;
    }

    const success = await updateBotDetectionStatus(
      detectionId,
      DECISION_STATUS.BANNED,
      req.user.id,
    );

    if (!success) {
      logger.warn(`BOT_DETECTION: Ban applied but status update failed for ${detectionId}`);
    }

    if (detection.videoPath) {
      const recorder = getBotDetectionRecorder();
      await recorder.cleanupRecording(detectionId, detection.videoPath);
    }

    if (detection.uid) {
      try {
        chatProvider.sendSystemMessage(
          detection.uid,
          BOT_BAN_MESSAGE,
        );
      } catch (e) {
        logger.warn(`BOT_DETECTION: Could not send ban message: ${e.message}`);
      }
    }

    logModAction(
      req.user.id,
      'bot_detection_ban',
      `detection:${detectionId}`,
      `user:${detection.uid || detection.ipString} | 30 days`,
    );

    logger.info(
      `BOT_DETECTION: User ${detection.uid || detection.ipString} banned for 30 days by ${req.user.name}`,
    );

    res.json({ success: true, banDuration: '30 days' });
  } catch (error) {
    logger.error(`BOT_DETECTION_API: Error banning: ${error.message}`);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

router.post('/ban-rollback/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const detectionId = parseInt(id, 10);

    const detection = await getBotDetectionById(detectionId);
    if (!detection) {
      res.status(404).json({ error: 'Detection not found' });
      return;
    }

    if (detection.status !== DECISION_STATUS.PENDING) {
      res.status(400).json({ error: 'Detection already processed' });
      return;
    }

    const ipStrings = detection.ipString ? [detection.ipString] : null;
    const userIds = detection.uid ? [detection.uid] : null;

    const banResult = await ban(
      ipStrings,
      userIds,
      null,
      false,
      true,
      'Bot/Script auto-placement',
      BOT_BAN_DURATION,
      req.user.id,
    );

    if (!banResult || (!banResult[0]?.length && !banResult[1]?.length)) {
      res.status(500).json({ error: 'Failed to apply ban' });
      return;
    }

    let rollbackCount = 0;
    let rollbackError = null;

    try {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      if (detection.iid) {
        const iidHex = typeof detection.iid === 'string'
          ? detection.iid
          : Buffer.from(detection.iid).toString('hex');

        const pixelsResult = await getIIDPixels(iidHex, oneDayAgo, 5000);

        if (pixelsResult && pixelsResult.rows && pixelsResult.rows.length > 0) {
          const pixelsByCanvas = new Map();

          for (const row of pixelsResult.rows) {
            const [, canvasId, coordStr] = row;
            const [x, y] = coordStr.split(',').map(Number);

            if (!pixelsByCanvas.has(canvasId)) {
              pixelsByCanvas.set(canvasId, { minX: x, maxX: x, minY: y, maxY: y });
            } else {
              const bounds = pixelsByCanvas.get(canvasId);
              bounds.minX = Math.min(bounds.minX, x);
              bounds.maxX = Math.max(bounds.maxX, x);
              bounds.minY = Math.min(bounds.minY, y);
              bounds.maxY = Math.max(bounds.maxY, y);
            }
          }

          const date = new Date(oneDayAgo);
          const dateStr = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
          const timeStr = `${String(date.getUTCHours()).padStart(2, '0')}${String(date.getUTCMinutes()).padStart(2, '0')}`;

          for (const [canvasId, bounds] of pixelsByCanvas) {
            const width = bounds.maxX - bounds.minX + 1;
            const height = bounds.maxY - bounds.minY + 1;

            if (width * height <= 10000) {
              const count = await rollbackCanvasArea(
                canvasId,
                bounds.minX,
                bounds.minY,
                width,
                height,
                dateStr,
                timeStr,
              );
              rollbackCount += count;
            }
          }
        }
      }
    } catch (e) {
      rollbackError = e.message;
      logger.error(`BOT_DETECTION: Rollback failed for ${detectionId}: ${e.message}`);
    }

    const success = await updateBotDetectionStatus(
      detectionId,
      DECISION_STATUS.BANNED,
      req.user.id,
    );

    if (!success) {
      logger.warn(`BOT_DETECTION: Ban applied but status update failed for ${detectionId}`);
    }

    if (detection.videoPath) {
      const recorder = getBotDetectionRecorder();
      await recorder.cleanupRecording(detectionId, detection.videoPath);
    }

    if (detection.uid) {
      try {
        chatProvider.sendSystemMessage(
          detection.uid,
          BOT_BAN_MESSAGE,
        );
      } catch (e) {
        logger.warn(`BOT_DETECTION: Could not send ban message: ${e.message}`);
      }
    }

    logModAction(
      req.user.id,
      'bot_detection_ban_rollback',
      `detection:${detectionId}`,
      `user:${detection.uid || detection.ipString} | 30 days | rollback:${rollbackCount}px`,
    );

    logger.info(
      `BOT_DETECTION: User ${detection.uid || detection.ipString} banned + ${rollbackCount}px rolled back by ${req.user.name}`,
    );

    res.json({
      success: true,
      banDuration: '30 days',
      rollbackCount,
      rollbackError,
    });
  } catch (error) {
    logger.error(`BOT_DETECTION_API: Error in ban-rollback: ${error.message}`);
    res.status(500).json({ error: 'Failed to ban and rollback' });
  }
});

router.get('/config', async (req, res) => {
  try {
    if (req.user.userlvl < USERLVL.ADMIN) {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    const service = getBotDetectionService();
    res.json(service.getConfig());
  } catch (error) {
    logger.error(`BOT_DETECTION_API: Error fetching config: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

router.post('/config', async (req, res) => {
  try {
    if (req.user.userlvl < USERLVL.ADMIN) {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    const { config } = req.body;
    if (!config || typeof config !== 'object') {
      res.status(400).json({ error: 'Invalid config' });
      return;
    }

    const service = getBotDetectionService();
    service.updateConfig(config);

    logModAction(req.user.id, 'bot_detection_config_update', null, null);

    res.json({ success: true, config: service.getConfig() });
  } catch (error) {
    logger.error(`BOT_DETECTION_API: Error updating config: ${error.message}`);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

router.get('/user/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const service = getBotDetectionService();

    const isUserId = /^\d+$/.test(identifier);
    const analysis = service.getUserAnalysis(
      isUserId ? parseInt(identifier, 10) : null,
      isUserId ? null : identifier,
    );

    res.json(analysis || { message: 'No data available' });
  } catch (error) {
    logger.error(`BOT_DETECTION_API: Error fetching user analysis: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch user analysis' });
  }
});

router.get('/scripted-line/stats', async (req, res) => {
  try {
    const detector = getScriptedLineDetector();
    res.json(detector.getStats());
  } catch (error) {
    logger.error(`BOT_DETECTION_API: Error fetching scripted line stats: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/scripted-line/config', async (req, res) => {
  try {
    if (req.user.userlvl < USERLVL.ADMIN) {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    const detector = getScriptedLineDetector();
    res.json(detector.getConfig());
  } catch (error) {
    logger.error(`BOT_DETECTION_API: Error fetching scripted line config: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

router.post('/scripted-line/config', async (req, res) => {
  try {
    if (req.user.userlvl < USERLVL.ADMIN) {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    const { config } = req.body;
    if (!config || typeof config !== 'object') {
      res.status(400).json({ error: 'Invalid config' });
      return;
    }

    const detector = getScriptedLineDetector();
    detector.updateConfig(config);

    logModAction(req.user.id, 'scripted_line_config_update', null, null);

    res.json({ success: true, config: detector.getConfig() });
  } catch (error) {
    logger.error(`BOT_DETECTION_API: Error updating scripted line config: ${error.message}`);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

router.get('/recording/:id/stream', async (req, res) => {
  try {
    const { id } = req.params;
    const detection = await getBotDetectionById(parseInt(id, 10));

    if (!detection) {
      res.status(404).json({ error: 'Detection not found' });
      return;
    }

    if (!detection.videoPath || !fs.existsSync(detection.videoPath)) {
      res.status(404).json({ error: 'Recording not found' });
      return;
    }

    const stat = fs.statSync(detection.videoPath);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="detection_${id}.json"`);

    const stream = fs.createReadStream(detection.videoPath);
    stream.pipe(res);
  } catch (error) {
    logger.error(`BOT_DETECTION_API: Error streaming recording: ${error.message}`);
    res.status(500).json({ error: 'Failed to stream recording' });
  }
});

export default router;
