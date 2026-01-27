import React, {
  useState, useCallback, useRef, useEffect, useMemo,
} from 'react';
import { useSelector, shallowEqual } from 'react-redux';
import { t } from 'ttag';

import {
  dateToString, getToday, stringToDate,
} from '../core/utils.js';
import { requestHistoricalTimes } from '../store/actions/fetch.js';

const MAX_DAYS = 7;
const MAX_SIZE = 3000;
const FRAMES_PER_DAY = 30;
const FRAME_DURATION_MS = Math.round(1000 / FRAMES_PER_DAY);
const TILE_CACHE = new Map();
const TIMES_CACHE = new Map();

const parseCoord = (value, setX, setY) => {
  const str = String(value);
  if (str.includes('_')) {
    const parts = str.split('_');
    if (parts.length === 2) {
      const x = parseInt(parts[0], 10);
      const y = parseInt(parts[1], 10);
      if (!Number.isNaN(x) && !Number.isNaN(y)) {
        setX(x);
        setY(y);
        return true;
      }
    }
  }
  return false;
};

const TimelapseMenu = () => {
  const [
    canvasId,
    canvasStartDate,
    canvasEndDate,
    canvasSize,
    view,
  ] = useSelector((state) => [
    state.canvas.canvasId,
    state.canvas.canvasStartDate,
    state.canvas.canvasEndDate,
    state.canvas.canvasSize,
    state.canvas.view,
  ], shallowEqual);

  const [max] = useState(getToday());
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    const y = d.getUTCFullYear();
    let m = d.getUTCMonth() + 1;
    let day = d.getUTCDate();
    if (m < 10) m = `0${m}`;
    if (day < 10) day = `0${day}`;
    return `${y}-${m}-${day}`;
  });
  const [endDate, setEndDate] = useState(max);
  const [topLeftX, setTopLeftX] = useState(Math.round(view[0]) - 256);
  const [topLeftY, setTopLeftY] = useState(Math.round(view[1]) - 256);
  const [bottomRightX, setBottomRightX] = useState(Math.round(view[0]) + 256);
  const [bottomRightY, setBottomRightY] = useState(Math.round(view[1]) + 256);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [videoBlob, setVideoBlob] = useState(null);

  const abortRef = useRef(false);

  const dimensions = useMemo(() => {
    const w = Math.abs(bottomRightX - topLeftX);
    const h = Math.abs(bottomRightY - topLeftY);
    return { width: w, height: h };
  }, [topLeftX, topLeftY, bottomRightX, bottomRightY]);

  const daysDiff = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(0, diff);
  }, [startDate, endDate]);

  const validationError = useMemo(() => {
    if (!startDate || !endDate) return t`Select dates`;
    if (daysDiff <= 0) return t`Invalid date range`;
    if (daysDiff > MAX_DAYS) return t`Max ${MAX_DAYS} days`;
    const { width, height } = dimensions;
    if (width <= 0 || height <= 0) return t`Invalid coordinates`;
    if (width > MAX_SIZE || height > MAX_SIZE) return t`Max size: ${MAX_SIZE}px`;
    const halfCanvas = canvasSize / 2;
    if (topLeftX < -halfCanvas || bottomRightX > halfCanvas) {
      return t`X out of bounds`;
    }
    if (topLeftY < -halfCanvas || bottomRightY > halfCanvas) {
      return t`Y out of bounds`;
    }
    return null;
  }, [startDate, endDate, daysDiff, dimensions, topLeftX, topLeftY, bottomRightX, bottomRightY, canvasSize]);

  const cleanup = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  useEffect(() => () => cleanup(), [cleanup]);

  const fetchDayTimes = useCallback(async (d) => {
    const key = `${d}/${canvasId}`;
    const cached = TIMES_CACHE.get(key);
    if (cached) return cached;
    const times = await requestHistoricalTimes(d, canvasId);
    TIMES_CACHE.set(key, times);
    return times;
  }, [canvasId]);

  const loadHistoricalTile = useCallback(async (cx, cy, d, time = null) => {
    const dateStr = dateToString(d);
    let url = `${window.ssv.backupurl}/${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}/${dateStr.slice(6)}/`;
    if (time) {
      const timeStr = time.replace(':', '');
      url += `${canvasId}/${timeStr}/${cx}/${cy}.png`;
    } else {
      url += `${canvasId}/tiles/${cx}/${cy}.png`;
    }

    const cached = TILE_CACHE.get(url);
    if (cached) return cached;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        TILE_CACHE.set(url, img);
        resolve(img);
      };
      img.onerror = () => {
        TILE_CACHE.set(url, null);
        resolve(null);
      };
      img.src = url;
    });
  }, [canvasId]);

  const renderFrame = useCallback(async (
    ctx, d, time, tlX, tlY, w, h, tileSize,
  ) => {
    const halfCanvas = canvasSize / 2;
    const startTileX = Math.floor((tlX + halfCanvas) / tileSize);
    const startTileY = Math.floor((tlY + halfCanvas) / tileSize);
    const endTileX = Math.ceil((tlX + w + halfCanvas) / tileSize);
    const endTileY = Math.ceil((tlY + h + halfCanvas) / tileSize);

    const tiles = [];
    for (let tx = startTileX; tx < endTileX; tx++) {
      for (let ty = startTileY; ty < endTileY; ty++) {
        const baseTile = await loadHistoricalTile(tx, ty, d);
        let incrementalTile = null;
        if (time && time !== '00:00') {
          incrementalTile = await loadHistoricalTile(tx, ty, d, time);
        }
        tiles.push({ tx, ty, baseTile, incrementalTile });
      }
    }

    ctx.fillStyle = '#C4C4C4';
    ctx.fillRect(0, 0, w, h);

    const offsetX = tlX + halfCanvas;
    const offsetY = tlY + halfCanvas;

    for (const { tx, ty, baseTile, incrementalTile } of tiles) {
      const drawX = tx * tileSize - offsetX;
      const drawY = ty * tileSize - offsetY;

      if (baseTile) {
        ctx.drawImage(baseTile, drawX, drawY);
      }
      if (incrementalTile) {
        ctx.drawImage(incrementalTile, drawX, drawY);
      }
    }
  }, [canvasSize, loadHistoricalTile]);

  const generateTimelapse = useCallback(async () => {
    if (validationError || generating) return;

    setGenerating(true);
    setProgress(0);
    setError(null);
    setPreviewUrl(null);
    setVideoBlob(null);
    abortRef.current = false;

    const { width, height } = dimensions;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      const allFrames = [];
      const start = new Date(startDate);
      const end = new Date(endDate);

      const currentDate = new Date(start);

      while (currentDate <= end) {
        if (abortRef.current) {
          setGenerating(false);
          return;
        }

        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        const times = await fetchDayTimes(dateStr);

        if (times.length === 0) {
          await renderFrame(ctx, dateStr, null, topLeftX, topLeftY, width, height, 256);
          allFrames.push(ctx.getImageData(0, 0, width, height));
        } else {
          const step = Math.max(1, Math.floor(times.length / FRAMES_PER_DAY));
          for (let i = 0; i < times.length; i += step) {
            if (abortRef.current) {
              setGenerating(false);
              return;
            }
            await renderFrame(ctx, dateStr, times[i], topLeftX, topLeftY, width, height, 256);
            allFrames.push(ctx.getImageData(0, 0, width, height));
          }
        }

        const dayProgress = (currentDate - start) / (end - start);
        setProgress(Math.round(dayProgress * 50));

        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (abortRef.current || allFrames.length === 0) {
        setGenerating(false);
        return;
      }

      setProgress(50);

      const stream = canvas.captureStream(0);
      const track = stream.getVideoTracks()[0];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000,
      });

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      const recordingComplete = new Promise((resolve) => {
        mediaRecorder.onstop = () => resolve();
      });

      mediaRecorder.start();

      const totalFrames = allFrames.length;
      for (let i = 0; i < totalFrames; i++) {
        if (abortRef.current) {
          mediaRecorder.stop();
          setGenerating(false);
          return;
        }

        ctx.putImageData(allFrames[i], 0, 0);
        track.requestFrame();

        await new Promise((r) => setTimeout(r, FRAME_DURATION_MS));

        setProgress(50 + Math.round((i / totalFrames) * 50));
      }

      mediaRecorder.stop();
      await recordingComplete;

      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);

      setVideoBlob(blob);
      setPreviewUrl(url);
      setProgress(100);
    } catch (err) {
      setError(err.message || t`Failed to generate timelapse`);
    } finally {
      setGenerating(false);
    }
  }, [
    validationError, generating, startDate, endDate, dimensions,
    topLeftX, topLeftY, fetchDayTimes, renderFrame,
  ]);

  const handleDownload = useCallback(() => {
    if (!videoBlob) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `timelapse_${startDate}_${endDate}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [videoBlob, previewUrl, startDate, endDate]);

  const handleCancel = useCallback(() => {
    abortRef.current = true;
    setGenerating(false);
  }, []);

  const handleReset = useCallback(() => {
    cleanup();
    setPreviewUrl(null);
    setVideoBlob(null);
    setProgress(0);
    setError(null);
  }, [cleanup]);

  if (previewUrl && !generating) {
    return (
      <div className="timelapsemenu" id="timelapsefloat">
        <video
          src={previewUrl}
          controls
          autoPlay
          loop
          muted
          style={{ width: '100%', maxHeight: '150px' }}
        />
        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
          <button type="button" className="tl-btn" onClick={handleDownload}>
            {t`Download`}
          </button>
          <button type="button" className="tl-btn" onClick={handleReset}>
            {t`New`}
          </button>
        </div>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="timelapsemenu" id="timelapsefloat">
        <div className="tl-progress">
          <div className="tl-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span>{progress}%</span>
        <button type="button" className="tl-btn" onClick={handleCancel}>{t`Cancel`}</button>
      </div>
    );
  }

  const handleTopLeftChange = useCallback((e) => {
    const val = e.target.value;
    if (!parseCoord(val, setTopLeftX, setTopLeftY)) {
      const num = parseInt(val, 10);
      if (!Number.isNaN(num)) {
        if (e.target.name === 'tlx') setTopLeftX(num);
        else setTopLeftY(num);
      }
    }
  }, []);

  const handleBottomRightChange = useCallback((e) => {
    const val = e.target.value;
    if (!parseCoord(val, setBottomRightX, setBottomRightY)) {
      const num = parseInt(val, 10);
      if (!Number.isNaN(num)) {
        if (e.target.name === 'brx') setBottomRightX(num);
        else setBottomRightY(num);
      }
    }
  }, []);

  return (
    <div className="timelapsemenu" id="timelapsefloat">
      <div className="tl-row">
        <span>{t`Start`}:</span>
        <input
          type="date"
          value={startDate}
          min={canvasStartDate}
          max={canvasEndDate || max}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>
      <div className="tl-row">
        <span>{t`End`}:</span>
        <input
          type="date"
          value={endDate}
          min={canvasStartDate}
          max={canvasEndDate || max}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>
      <div className="tl-row">
        <span>{t`Top-Left`}:</span>
        <input
          type="text"
          name="tlx"
          value={topLeftX}
          onChange={handleTopLeftChange}
        />
        <input
          type="text"
          name="tly"
          value={topLeftY}
          onChange={handleTopLeftChange}
        />
      </div>
      <div className="tl-row">
        <span>{t`Bottom-Right`}:</span>
        <input
          type="text"
          name="brx"
          value={bottomRightX}
          onChange={handleBottomRightChange}
        />
        <input
          type="text"
          name="bry"
          value={bottomRightY}
          onChange={handleBottomRightChange}
        />
      </div>
      <span className="tl-size">{dimensions.width}×{dimensions.height}px</span>
      {validationError && <span className="tl-error">{validationError}</span>}
      <button
        type="button"
        className="tl-btn"
        disabled={!!validationError}
        onClick={generateTimelapse}
      >
        {t`Generate`}
      </button>
    </div>
  );
};

export default React.memo(TimelapseMenu);
