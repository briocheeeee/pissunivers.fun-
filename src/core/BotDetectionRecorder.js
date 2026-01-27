import fs from 'fs';
import path from 'path';
import logger from './logger.js';
import { updateBotDetectionVideo, deleteBotDetectionVideo } from '../data/sql/BotDetection.js';

const RECORDINGS_DIR = './recordings/bot_detection';

class BotDetectionRecorder {
  constructor() {
    this.activeRecordings = new Map();
    this.ensureRecordingsDir();
  }

  ensureRecordingsDir() {
    if (!fs.existsSync(RECORDINGS_DIR)) {
      fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
    }
  }

  startRecording(detectionId, canvasId, centerX, centerY, zoomLevel = 8) {
    if (this.activeRecordings.has(detectionId)) {
      return null;
    }

    const startTime = new Date();
    const filename = `detection_${detectionId}_${startTime.getTime()}.json`;
    const filepath = path.join(RECORDINGS_DIR, filename);

    const recording = {
      detectionId,
      canvasId,
      centerX,
      centerY,
      zoomLevel,
      startTime,
      filepath,
      frames: [],
      metadata: {
        canvasId,
        centerX,
        centerY,
        zoomLevel,
        startTime: startTime.toISOString(),
      },
    };

    this.activeRecordings.set(detectionId, recording);

    logger.info(`BOT_RECORDER: Started recording ${detectionId} at (${centerX}, ${centerY})`);

    return recording;
  }

  addFrame(detectionId, frameData) {
    const recording = this.activeRecordings.get(detectionId);
    if (!recording) return false;

    recording.frames.push({
      timestamp: Date.now(),
      ...frameData,
    });

    return true;
  }

  async stopRecording(detectionId) {
    const recording = this.activeRecordings.get(detectionId);
    if (!recording) return null;

    this.activeRecordings.delete(detectionId);

    const endTime = new Date();
    recording.metadata.endTime = endTime.toISOString();
    recording.metadata.duration = endTime.getTime() - recording.startTime.getTime();
    recording.metadata.frameCount = recording.frames.length;

    try {
      const outputData = {
        metadata: recording.metadata,
        frames: recording.frames,
      };

      fs.writeFileSync(recording.filepath, JSON.stringify(outputData, null, 2));

      await updateBotDetectionVideo(
        detectionId,
        recording.filepath,
        recording.startTime,
        endTime,
      );

      logger.info(`BOT_RECORDER: Saved recording ${detectionId} with ${recording.frames.length} frames`);

      return recording.filepath;
    } catch (error) {
      logger.error(`BOT_RECORDER: Failed to save recording ${detectionId}: ${error.message}`);
      return null;
    }
  }

  cancelRecording(detectionId) {
    const recording = this.activeRecordings.get(detectionId);
    if (!recording) return false;

    this.activeRecordings.delete(detectionId);
    logger.info(`BOT_RECORDER: Cancelled recording ${detectionId}`);
    return true;
  }

  isRecording(detectionId) {
    return this.activeRecordings.has(detectionId);
  }

  getRecordingInfo(detectionId) {
    return this.activeRecordings.get(detectionId) || null;
  }

  getAllActiveRecordings() {
    return Array.from(this.activeRecordings.values()).map((r) => ({
      detectionId: r.detectionId,
      canvasId: r.canvasId,
      centerX: r.centerX,
      centerY: r.centerY,
      startTime: r.startTime,
      frameCount: r.frames.length,
    }));
  }

  async deleteRecordingFile(filepath) {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        logger.info(`BOT_RECORDER: Deleted recording file ${filepath}`);
        return true;
      }
    } catch (error) {
      logger.error(`BOT_RECORDER: Failed to delete recording file ${filepath}: ${error.message}`);
    }
    return false;
  }

  async cleanupRecording(detectionId, filepath) {
    if (filepath) {
      await this.deleteRecordingFile(filepath);
    }
    await deleteBotDetectionVideo(detectionId);
  }

  getRecordingFilePath(detectionId, startTime) {
    const filename = `detection_${detectionId}_${startTime}.json`;
    return path.join(RECORDINGS_DIR, filename);
  }

  async loadRecording(filepath) {
    try {
      if (!fs.existsSync(filepath)) {
        return null;
      }
      const data = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error(`BOT_RECORDER: Failed to load recording ${filepath}: ${error.message}`);
      return null;
    }
  }
}

let instance = null;

export function getBotDetectionRecorder() {
  if (!instance) {
    instance = new BotDetectionRecorder();
  }
  return instance;
}

export default BotDetectionRecorder;
