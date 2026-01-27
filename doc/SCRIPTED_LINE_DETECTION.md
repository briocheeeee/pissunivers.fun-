# Scripted Line Detection System

Deterministic anti-bot detection for scripted auto-placement of pixels in straight lines with constant spacing.

## Overview

The `ScriptedLineDetector` is a specialized detection module that triggers **only** when:
1. A perfectly straight line is produced by scripted auto-placement
2. The spacing between consecutive placements is constant (equal distance each time)

This detector is separate from the general `BotDetectionService` and focuses exclusively on this specific pattern to minimize false positives.

## Detection Criteria

Detection fires when **ALL** of the following are true within a sliding time window:

| Criterion | Description | Default |
|-----------|-------------|---------|
| **N placements** | Minimum number of placements by the same actor | 12 |
| **Time window** | Maximum time span for the sequence | 15 seconds |
| **Collinearity** | All points lie on a single straight line within tolerance | 0.35 pixels |
| **Equal spacing** | Step distance between consecutive points is constant | 5% relative tolerance |
| **Monotonic progression** | Points progress consistently along the line direction | Required |
| **Minimum spacing** | Prevents detection of repeated same-pixel placements | 1 pixel |

## Configuration

All thresholds are configurable via the API or directly in code:

```javascript
const config = {
  minPoints: 12,              // Minimum points to form a detected line
  maxTimeWindowMs: 15000,     // 15 second sliding window
  collinearityTolerancePx: 0.35, // Max perpendicular distance from line
  spacingToleranceRel: 0.05,  // 5% relative tolerance on spacing
  angleToleranceDeg: 2,       // Angle tolerance for direction classification
  minSpacingPx: 1,            // Minimum spacing between points
  maxSpacingPx: 50,           // Maximum spacing between points
  minLineLength: 10,          // Minimum line length in pixels
  maxUsersTracked: 5000,      // Memory limit for tracked users
  maxPixelsPerUser: 200,      // Pixel history per user
  historyWindowMs: 60000,     // 60 second history window
  dbWriteCooldownMs: 30000,   // Cooldown between DB writes per user
  recordingDurationMs: 90000, // 90 second recording duration
};
```

### API Endpoints

**Get configuration (Admin only):**
```
GET /api/botdetection/scripted-line/config
```

**Update configuration (Admin only):**
```
POST /api/botdetection/scripted-line/config
Content-Type: application/json
{
  "config": {
    "minPoints": 15,
    "collinearityTolerancePx": 0.5
  }
}
```

**Get statistics:**
```
GET /api/botdetection/scripted-line/stats
```

## Detection Algorithm

### 1. Pixel Collection
- Each pixel placement is recorded with `(x, y, timestamp, color, canvasId)`
- Pixels are stored in a circular buffer per actor (userId or IP)
- Old pixels outside the history window are automatically pruned

### 2. Line Fitting
- Direction vector computed from first to last point
- Each point's perpendicular distance to the line is calculated
- All points must be within `collinearityTolerancePx` of the line

### 3. Monotonicity Check
- Points are projected onto the direction vector
- Projections must be strictly increasing (no backtracking)

### 4. Spacing Validation
- Euclidean distance computed between consecutive points
- Median spacing is calculated
- All spacings must be within `spacingToleranceRel` of the median
- Spacings must be >= `minSpacingPx` (rejects same-pixel spam)

### 5. Detection Output
When criteria are met, the system:
1. Creates a `BotDetection` record with type `perfect_line`
2. Starts a recording of subsequent pixel activity
3. Logs the detection with metrics

## Recording System

When a scripted line is detected:

1. **Recording starts** centered on the detected line
2. **Duration:** 90 seconds (configurable)
3. **Format:** JSON with pixel frames and metadata
4. **Storage:** `./recordings/bot_detection/detection_{id}_{timestamp}.json`

### Recording Structure
```json
{
  "metadata": {
    "canvasId": 0,
    "centerX": 150,
    "centerY": 100,
    "zoomLevel": 8,
    "startTime": "2024-01-15T10:30:00.000Z",
    "endTime": "2024-01-15T10:31:30.000Z",
    "duration": 90000,
    "frameCount": 45
  },
  "frames": [
    {
      "timestamp": 1705315800000,
      "type": "init",
      "detectionType": "scripted_line",
      "lineData": {
        "startX": 100,
        "startY": 100,
        "endX": 200,
        "endY": 100,
        "pointCount": 15,
        "direction": "horizontal"
      },
      "pixels": [...]
    },
    {
      "timestamp": 1705315801000,
      "type": "pixel",
      "x": 201,
      "y": 100,
      "color": 5
    }
  ]
}
```

## Moderation Actions

### Dismiss
- Updates detection status to `dismissed`
- **Deletes the recording file**
- Logs the action in mod audit log

### Ban
- Applies a 30-day ban to the user/IP
- Updates detection status to `banned`
- **Deletes the recording file**
- Sends notification to user
- Logs the action in mod audit log

### Ban + Rollback
- Same as Ban, plus:
- Rolls back pixels placed by the user in the last 24 hours

## What This Detector Does NOT Detect

To minimize false positives, this detector **ignores**:

- Short lines below `minPoints` (default: 12)
- Lines with jittery/variable spacing
- Multi-direction patterns (L-shapes, zigzags)
- Clustered placements
- Manual correction strokes
- Circles, rectangles, grids (handled by `BotDetectionService`)
- Timing anomalies without geometric patterns
- Any pattern that isn't a straight line with equal spacing

## Running Tests

```bash
node tests/scriptedLineDetector.js
```

### Test Cases

| Test | Expected Result |
|------|-----------------|
| Straight horizontal line, equal spacing | **DETECT** |
| Straight vertical line, equal spacing | **DETECT** |
| Diagonal line, equal spacing | **DETECT** |
| Line with unequal spacing | NO DETECT |
| Slightly off-line placements | NO DETECT |
| Two-segment line (angle change) | NO DETECT |
| Random placements | NO DETECT |
| N < N_min | NO DETECT |
| Duplicate coordinates | NO DETECT |

## Performance

- **Complexity:** O(K) per pixel per actor, where K = `maxPixelsPerUser`
- **Memory:** Bounded by `maxUsersTracked` × `maxPixelsPerUser`
- **Cleanup:** Automatic every 30 seconds (configurable)

## Files

| File | Purpose |
|------|---------|
| `src/core/ScriptedLineDetector.js` | Main detection logic |
| `src/core/BotDetectionRecorder.js` | Recording management |
| `src/routes/api/botdetection.js` | API endpoints |
| `src/data/sql/BotDetection.js` | Database model |
| `tests/scriptedLineDetector.js` | Unit tests |

## Integration

The detector is automatically initialized and called from `src/core/draw.js` for every pixel placement:

```javascript
scriptedLineDetector.recordPixel(
  user?.id || null,
  ipString,
  canvasId,
  x,
  y,
  color,
  ip.uuid || null,
);
```
