# Bot Detection System

Automatic detection system for auto-placement bots on the pixel canvas.

## Overview

This system automatically detects suspicious pixel placement patterns that indicate the use of auto-placement scripts or bots. Detection is performed server-side with no visible client-side interaction.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Pixel Placement                          │
│                         (draw.js)                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BotDetectionService                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Timing Analysis │  │Geometric Pattern│  │  Scoring System │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BotDetection Model                           │
│                      (Database)                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Moderation Interface                           │
│                  (ModBotDetection.jsx)                          │
└─────────────────────────────────────────────────────────────────┘
```

## Detection Methods

### 1. Timing Analysis

Analyzes the time intervals between consecutive pixel placements.

**Detection Criteria:**
- **Variance Analysis**: Human placements have natural variance in timing. Bot scripts typically have very consistent intervals.
- **Coefficient of Variation**: Measures timing precision. Values < 5% over 50+ pixels indicate machine-like precision.
- **Minimum Interval**: Detects inhuman placement speeds (< 100ms average).

**Configurable Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `minSequenceSize` | 20 | Minimum pixels before analysis |
| `varianceThresholdLow` | 500 | Low suspicion variance threshold |
| `varianceThresholdMedium` | 200 | Medium suspicion variance threshold |
| `varianceThresholdHigh` | 50 | High suspicion variance threshold |
| `minIntervalMs` | 100 | Minimum average interval (ms) |

### 2. Geometric Pattern Detection

Detects perfect geometric shapes that are unlikely to be drawn by humans.

#### Perfect Line Detection
- Analyzes consecutive pixel placements for perfect lines
- Supports horizontal, vertical, and diagonal directions
- Lines ≥ 100 pixels without deviation trigger medium/high suspicion

#### Perfect Circle Detection
- Detects circular patterns with consistent radius
- Analyzes radius standard deviation
- Perfect circles (stdDev ≤ 2 pixels) trigger suspicion

**Configurable Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `minLineLength` | 50 | Minimum line length to analyze |
| `perfectLineThreshold` | 100 | Line length for elevated suspicion |
| `maxDeviationPixels` | 0 | Maximum allowed pixel deviation |
| `circleMinPoints` | 20 | Minimum points for circle detection |
| `circleMaxRadiusError` | 2 | Maximum radius standard deviation |

### 3. Scoring System

Each detection signal contributes to a cumulative suspicion score.

**Score Contributions:**
| Signal | Base Score |
|--------|------------|
| Consistent timing (low variance) | 25 |
| Very consistent timing | 37 |
| Extremely consistent timing | 50 |
| Inhuman speed | 20 |
| Machine precision (CV < 5%) | 15 |
| Perfect line (< 100px) | 35 |
| Perfect line (≥ 100px) | 55 |
| Perfect circle | 40 |

**Combined Detection Multiplier:** 1.5x when both timing and geometric anomalies detected.

**Suspicion Levels:**
| Level | Score Range | Action |
|-------|-------------|--------|
| Low | 30-59 | Logged, no recording |
| Medium | 60-84 | Logged, recording triggered |
| High | 85-100 | Logged, recording triggered, priority review |

## Recording System

When suspicion score reaches the trigger threshold (default: 60), the system captures placement data.

**Recording Data:**
- Canvas ID and coordinates
- Zoom level (default: 8)
- Frame-by-frame pixel placement data
- Start/end timestamps
- Duration and frame count

**Storage:**
- Location: `./recordings/bot_detection/`
- Format: JSON with metadata and frames
- Auto-cleanup after moderator decision

## Database Schema

### BotDetection Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT | Primary key |
| `uuid` | BINARY(16) | Unique identifier |
| `uid` | INT | User ID (nullable) |
| `ipString` | VARCHAR(45) | IP address |
| `iid` | BINARY(16) | IP UUID |
| `canvasId` | TINYINT | Canvas identifier |
| `score` | INT | Suspicion score (0-100) |
| `level` | ENUM | low, medium, high |
| `detectionType` | VARCHAR(50) | Type of detection |
| `detectionDetails` | JSON | Detailed analysis data |
| `locationX` | INT | X coordinate |
| `locationY` | INT | Y coordinate |
| `videoPath` | VARCHAR(512) | Recording file path |
| `videoStartTime` | DATETIME | Recording start |
| `videoEndTime` | DATETIME | Recording end |
| `status` | ENUM | pending, dismissed, banned |
| `decidedBy` | INT | Moderator user ID |
| `decidedAt` | DATETIME | Decision timestamp |
| `createdAt` | DATETIME | Detection timestamp |

## API Endpoints

All endpoints require MOD level authentication.

### GET /api/botdetection/list
List detections with filtering and pagination.

**Query Parameters:**
- `status`: pending, dismissed, banned
- `level`: low, medium, high
- `page`: Page number (default: 1)
- `limit`: Results per page (max: 100)
- `sortBy`: Column to sort by
- `sortOrder`: ASC or DESC

### GET /api/botdetection/stats
Get detection statistics.

### GET /api/botdetection/detail/:id
Get detailed information for a specific detection.

### POST /api/botdetection/dismiss/:id
Dismiss a detection (mark as false positive).

### POST /api/botdetection/ban/:id
Ban the user for 30 days and send notification message.

### GET /api/botdetection/config (Admin only)
Get current detection configuration.

### POST /api/botdetection/config (Admin only)
Update detection configuration.

### GET /api/botdetection/user/:identifier
Get real-time analysis for a user/IP.

## Moderation Interface

Access via Modtools > BotDetection tab (requires MOD level).

### Features:
- **Statistics Panel**: Total, pending, dismissed, banned counts
- **Filtering**: By status and suspicion level
- **Sortable Table**: Username, name, level, score, date, location, status
- **Detail View**: Full analysis breakdown when clicking a row
- **Actions**: Dismiss or Ban 30 days buttons

### Detail View Information:
- User information (username, name, ID, IID, IP)
- Detection information (score, level, type, date)
- Timing analysis (average interval, variance, std deviation, sample size)
- Geometric patterns (line length/direction, circle radius/points)
- Detection flags (all triggered signals)
- Recording data (if available)

## Ban Message

When a user is banned, they receive the following message:

> Our auto-detection system has flagged you as a suspected user of an auto-placement script. A moderator reviewed a video of your suspicious placement and determined that it was an auto-placement script. If this is an unfortunate mistake on our part, please report it to us on the Discord server available on the help page.

## Configuration

Configuration can be updated at runtime via the admin API.

### Default Configuration:

```javascript
{
  timing: {
    minSequenceSize: 20,
    varianceThresholdLow: 500,
    varianceThresholdMedium: 200,
    varianceThresholdHigh: 50,
    minIntervalMs: 100,
  },
  geometric: {
    minLineLength: 50,
    perfectLineThreshold: 100,
    maxDeviationPixels: 0,
    circleMinPoints: 20,
    circleMaxRadiusError: 2,
  },
  scoring: {
    lowThreshold: 30,
    mediumThreshold: 60,
    highThreshold: 85,
    timingAnomalyBase: 25,
    perfectLineBase: 35,
    perfectCircleBase: 40,
    combinedMultiplier: 1.5,
  },
  recording: {
    triggerThreshold: 60,
    maxDurationMs: 120000,
    zoomLevel: 8,
  },
}
```

## Files

| File | Description |
|------|-------------|
| `src/data/sql/BotDetection.js` | Database model and queries |
| `src/core/BotDetectionService.js` | Detection logic and analysis |
| `src/core/BotDetectionRecorder.js` | Recording management |
| `src/routes/api/botdetection.js` | API endpoints |
| `src/components/ModBotDetection.jsx` | Moderation UI component |

## Minimizing False Positives

The system is designed to minimize false positives through:

1. **High Thresholds**: Default thresholds require significant evidence
2. **Combined Signals**: Higher scores when multiple signals present
3. **Human Review**: All detections require moderator decision
4. **Configurable Parameters**: Thresholds can be adjusted based on observed patterns
5. **Detailed Logging**: Full analysis data available for review

## Logging

All detections are logged with:
- Timestamp
- User/IP identifier
- Score and level
- Detection type
- Full analysis details

Log location: Standard application logs via Winston logger.
