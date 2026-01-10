# Preview Mode Configuration

This document describes the environment variables and configuration options for the enhanced browser preview mode.

## Environment Variables

All preview mode configuration is done via environment variables in the `test-executor` service.

### Frame Capture Settings

#### `PREVIEW_FRAME_INTERVAL_MS`
- **Description**: Minimum interval between frame captures in milliseconds
- **Default**: `50`
- **Range**: 10-1000
- **Example**: `PREVIEW_FRAME_INTERVAL_MS=50`
- **Note**: Lower values provide smoother preview but increase CPU/network usage. The system uses adaptive frame rate based on page activity.

#### `PREVIEW_SCREENSHOT_TYPE`
- **Description**: Screenshot format for frames
- **Default**: `jpeg`
- **Options**: `png` | `jpeg`
- **Example**: `PREVIEW_SCREENSHOT_TYPE=jpeg`
- **Note**: JPEG provides smaller file sizes and faster transmission. PNG provides lossless quality but larger files.

#### `PREVIEW_JPEG_QUALITY`
- **Description**: JPEG compression quality (0-100)
- **Default**: `85`
- **Range**: 0-100
- **Example**: `PREVIEW_JPEG_QUALITY=85`
- **Note**: Higher values = better quality but larger files. 85 is a good balance.

#### `PREVIEW_FULL_PAGE`
- **Description**: Enable full-page screenshots instead of viewport-only
- **Default**: `false`
- **Options**: `true` | `false`
- **Example**: `PREVIEW_FULL_PAGE=false`
- **Note**: Full-page screenshots are slower but capture entire page content.

#### `PREVIEW_MAX_HISTORY_FRAMES`
- **Description**: Maximum number of frames to store in history for time-travel debugging
- **Default**: `100`
- **Range**: 10-1000
- **Example**: `PREVIEW_MAX_HISTORY_FRAMES=100`
- **Note**: Higher values allow more history but use more memory.

## Configuration Examples

### High Performance (Fast, Lower Quality)
```bash
PREVIEW_FRAME_INTERVAL_MS=100
PREVIEW_SCREENSHOT_TYPE=jpeg
PREVIEW_JPEG_QUALITY=70
PREVIEW_FULL_PAGE=false
PREVIEW_MAX_HISTORY_FRAMES=50
```

### High Quality (Slower, Better Quality)
```bash
PREVIEW_FRAME_INTERVAL_MS=50
PREVIEW_SCREENSHOT_TYPE=png
PREVIEW_JPEG_QUALITY=95
PREVIEW_FULL_PAGE=true
PREVIEW_MAX_HISTORY_FRAMES=200
```

### Balanced (Recommended)
```bash
PREVIEW_FRAME_INTERVAL_MS=50
PREVIEW_SCREENSHOT_TYPE=jpeg
PREVIEW_JPEG_QUALITY=85
PREVIEW_FULL_PAGE=false
PREVIEW_MAX_HISTORY_FRAMES=100
```

## Docker Configuration

Add these variables to your `docker-compose.yml` in the `test-executor` service:

```yaml
services:
  test-executor:
    environment:
      - PREVIEW_FRAME_INTERVAL_MS=50
      - PREVIEW_SCREENSHOT_TYPE=jpeg
      - PREVIEW_JPEG_QUALITY=85
      - PREVIEW_FULL_PAGE=false
      - PREVIEW_MAX_HISTORY_FRAMES=100
```

## Adaptive Frame Rate

The system automatically adjusts frame capture rate based on page activity:

- **Loading**: 2x interval (100ms with default 50ms)
- **Active**: 1.5x interval (75ms with default 50ms)
- **Idle**: 1x interval (50ms with default 50ms)

This ensures smooth preview during active changes while reducing overhead during stable periods.

## Performance Considerations

1. **Frame Interval**: Lower intervals (10-30ms) provide very smooth preview but can overwhelm the system with fast-changing pages
2. **JPEG Quality**: Quality 70-85 provides good balance. Quality 90+ has diminishing returns
3. **Full Page**: Only enable if you need to see content below the fold. Significantly slower
4. **History Size**: Each frame uses memory. 100 frames is usually sufficient for most test cases

## Troubleshooting

### Preview is too slow
- Increase `PREVIEW_FRAME_INTERVAL_MS` to 100-200
- Use `PREVIEW_SCREENSHOT_TYPE=jpeg` with lower quality (70-80)
- Set `PREVIEW_FULL_PAGE=false`

### Preview quality is poor
- Use `PREVIEW_SCREENSHOT_TYPE=png` for lossless quality
- Increase `PREVIEW_JPEG_QUALITY` to 90-95
- Decrease `PREVIEW_FRAME_INTERVAL_MS` for smoother updates

### Memory issues
- Decrease `PREVIEW_MAX_HISTORY_FRAMES` to 50
- Use JPEG instead of PNG
- Disable full-page screenshots
