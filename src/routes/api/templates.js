import express from 'express';
import logger from '../../core/logger.js';
import {
  createSharedTemplate,
  getSharedTemplateByUuid,
  getUserSharedTemplates,
  deleteSharedTemplate,
  countUserSharedTemplates,
} from '../../data/sql/SharedTemplate.js';
import { trackTemplateUsed } from '../../data/sql/DailyObjective.js';

const router = express.Router();

const MAX_TEMPLATES_PER_USER = 10;
const MAX_IMAGE_SIZE = 1024 * 1024;

router.post('/share', async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not logged in' });
    return;
  }

  try {
    const { title, canvasId, x, y, width, height, imageData, mimetype } = req.body;

    if (!title || title.length > 100) {
      res.status(400).json({ error: 'Invalid title' });
      return;
    }

    if (!imageData) {
      res.status(400).json({ error: 'No image data' });
      return;
    }

    const imageSize = Buffer.byteLength(imageData, 'base64');
    if (imageSize > MAX_IMAGE_SIZE) {
      res.status(400).json({ error: 'Image too large (max 1MB)' });
      return;
    }

    const count = await countUserSharedTemplates(req.user.id);
    if (count >= MAX_TEMPLATES_PER_USER) {
      res.status(400).json({ error: `Maximum ${MAX_TEMPLATES_PER_USER} shared templates allowed` });
      return;
    }

    const result = await createSharedTemplate({
      userId: req.user.id,
      title,
      canvasId: parseInt(canvasId, 10),
      x: parseInt(x, 10),
      y: parseInt(y, 10),
      width: parseInt(width, 10),
      height: parseInt(height, 10),
      imageData,
      mimetype: mimetype || 'image/png',
    });

    const shareUrl = `/template/${result.uuid}`;

    logger.info(`TEMPLATE: User ${req.user.id} shared template "${title}" -> ${result.uuid}`);

    res.json({
      success: true,
      uuid: result.uuid,
      shareUrl,
    });
  } catch (error) {
    logger.error(`TEMPLATE_API: Error sharing template: ${error.message}`);
    res.status(500).json({ error: 'Failed to share template' });
  }
});

router.get('/shared/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!uuid || uuid.length !== 32) {
      res.status(400).json({ error: 'Invalid template ID' });
      return;
    }

    const template = await getSharedTemplateByUuid(uuid);

    if (!template) {
      res.status(404).json({ error: 'Template not found or expired' });
      return;
    }

    if (req.user) {
      trackTemplateUsed(req.user.id, uuid);
    }

    res.json({
      title: template.title,
      canvasId: template.canvasId,
      x: template.x,
      y: template.y,
      width: template.width,
      height: template.height,
      imageData: template.imageData,
      mimetype: template.mimetype,
    });
  } catch (error) {
    logger.error(`TEMPLATE_API: Error fetching shared template: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

router.get('/my', async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not logged in' });
    return;
  }

  try {
    const templates = await getUserSharedTemplates(req.user.id);
    res.json({ templates });
  } catch (error) {
    logger.error(`TEMPLATE_API: Error fetching user templates: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.delete('/shared/:uuid', async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not logged in' });
    return;
  }

  try {
    const { uuid } = req.params;
    const deleted = await deleteSharedTemplate(uuid, req.user.id);

    if (!deleted) {
      res.status(404).json({ error: 'Template not found or not owned by you' });
      return;
    }

    logger.info(`TEMPLATE: User ${req.user.id} deleted shared template ${uuid}`);
    res.json({ success: true });
  } catch (error) {
    logger.error(`TEMPLATE_API: Error deleting template: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
