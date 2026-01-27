import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, shallowEqual } from 'react-redux';
import { t } from 'ttag';

import templateLoader from '../ui/templateLoader.js';

const TemplateTimeEstimate = ({ imageId, canvasId, x, y, width, height }) => {
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const [coolDown, canvases] = useSelector((state) => [
    state.user.coolDown,
    state.canvas.canvases,
  ], shallowEqual);

  const canvas = canvases[canvasId];
  const baseCooldown = canvas?.bcd || 4000;

  const calculateEstimate = useCallback(async () => {
    if (!imageId || !canvas) {
      setError(t`Missing template data`);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const templateImage = await templateLoader.getTemplate(imageId);
      if (!templateImage) {
        setError(t`Template image not loaded`);
        setLoading(false);
        return;
      }

      const ctx = templateImage.getContext('2d');
      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels = imageData.data;

      let totalPixels = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] > 200) {
          totalPixels += 1;
        }
      }

      const MAX_SAMPLE_PIXELS = 50000;
      const sampleRate = totalPixels > MAX_SAMPLE_PIXELS ? Math.ceil(totalPixels / MAX_SAMPLE_PIXELS) : 1;

      const sampledPixels = [];
      let pixelCount = 0;
      for (let py = 0; py < height; py += 1) {
        for (let px = 0; px < width; px += 1) {
          const templateIdx = (py * width + px) * 4;
          const alpha = pixels[templateIdx + 3];
          if (alpha <= 200) continue;
          
          pixelCount += 1;
          if (pixelCount % sampleRate !== 0) continue;

          sampledPixels.push({
            px,
            py,
            r: pixels[templateIdx],
            g: pixels[templateIdx + 1],
            b: pixels[templateIdx + 2],
          });
        }
      }

      let placedPixels = 0;
      let progressPercent = 0;

      try {
        const response = await fetch(`/api/templates/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            canvasId,
            x,
            y,
            width,
            height,
            totalPixels,
            sampleRate,
            sampledPixels,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          placedPixels = data.placedPixels || 0;
          progressPercent = data.progressPercent ?? 0;
        }
      } catch (apiErr) {
        console.warn('Template progress API failed:', apiErr);
      }

      const remainingPixels = totalPixels - placedPixels;

      const cooldownSeconds = baseCooldown / 1000;
      const totalTimeSeconds = remainingPixels * cooldownSeconds;

      const hours = Math.floor(totalTimeSeconds / 3600);
      const minutes = Math.floor((totalTimeSeconds % 3600) / 60);

      let timeString;
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        timeString = `~${days}d ${remainingHours}h`;
      } else if (hours > 0) {
        timeString = `~${hours}h ${minutes}m`;
      } else {
        timeString = `~${minutes}m`;
      }

      setEstimate({
        totalPixels,
        placedPixels,
        remainingPixels,
        timeString,
        cooldownSeconds,
      });

      setProgress(progressPercent);
    } catch (err) {
      console.error('Failed to calculate template estimate:', err);
    }

    setLoading(false);
  }, [imageId, canvasId, x, y, width, height, canvas, baseCooldown]);

  useEffect(() => {
    calculateEstimate();
  }, [calculateEstimate]);

  if (loading) {
    return (
      <div className="template-estimate loading">
        <span className="template-estimate-icon">⏱</span>
        <span className="template-estimate-text">{t`Calculating...`}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="template-estimate error">
        <span className="template-estimate-icon">⚠</span>
        <span className="template-estimate-text">{error}</span>
        <button
          type="button"
          className="template-estimate-refresh"
          onClick={calculateEstimate}
          title={t`Retry`}
        >
          ↻
        </button>
      </div>
    );
  }

  if (!estimate) {
    return null;
  }

  return (
    <div className="template-estimate">
      <div className="template-estimate-header">
        <span className="template-estimate-icon">⏱</span>
        <span className="template-estimate-time">{estimate.timeString}</span>
      </div>
      <div className="template-estimate-progress">
        <div
          className="template-estimate-progress-bar"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="template-estimate-details">
        <span className="template-estimate-stat">
          {t`Progress`}: <strong>{progress}%</strong>
        </span>
        <span className="template-estimate-stat">
          {t`Remaining`}: <strong>{estimate.remainingPixels.toLocaleString()}</strong> px
        </span>
        <span className="template-estimate-stat">
          {t`Cooldown`}: <strong>{estimate.cooldownSeconds}s</strong>
        </span>
      </div>
      <button
        type="button"
        className="template-estimate-refresh"
        onClick={calculateEstimate}
        title={t`Refresh estimate`}
      >
        ↻
      </button>
    </div>
  );
};

export default React.memo(TemplateTimeEstimate);
