import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { createLogger } from '../../shared/logger/logger';

const execFileAsync = promisify(execFile);
const logger = createLogger('video-stitcher');

const VIDEO_OUTPUT_DIR = process.env.VIDEO_DIR || '/app/videos';

/**
 * Stitch numbered PNG frames into an MP4 video using ffmpeg.
 * Frames should be named frame_0001.png, frame_0002.png, etc. in frameDir.
 * Returns the relative video filename (e.g. "session-abc123.mp4").
 */
export async function stitchVideo(
  sessionId: string,
  frameDir: string,
  frameCount: number
): Promise<string | null> {
  if (frameCount < 2) {
    logger.warn('Too few frames to create video', { sessionId, frameCount });
    return null;
  }

  // Ensure output directory exists
  await fs.promises.mkdir(VIDEO_OUTPUT_DIR, { recursive: true });

  const outputFilename = `session-${sessionId}.mp4`;
  const outputPath = path.join(VIDEO_OUTPUT_DIR, outputFilename);
  const inputPattern = path.join(frameDir, 'frame_%04d.png');

  try {
    logger.info('Stitching video', { sessionId, frameCount, outputPath });

    await execFileAsync('ffmpeg', [
      '-y',                          // overwrite output
      '-framerate', '2',             // 2 fps (one frame every 2 seconds)
      '-i', inputPattern,            // input frames
      '-c:v', 'libx264',            // H.264 codec
      '-pix_fmt', 'yuv420p',        // compatible pixel format
      '-preset', 'fast',            // fast encoding
      '-crf', '28',                 // reasonable quality/size tradeoff
      outputPath
    ], { timeout: 120000 }); // 2 min timeout

    // Verify output exists
    const stat = await fs.promises.stat(outputPath);
    logger.info('Video created', {
      sessionId,
      outputFilename,
      sizeBytes: stat.size,
      frameCount
    });

    return outputFilename;
  } catch (error: any) {
    logger.error('Failed to stitch video', {
      sessionId,
      error: error.message,
      stderr: error.stderr?.slice(0, 500)
    });
    return null;
  }
}

/**
 * Clean up temporary frame files after stitching.
 */
export async function cleanupFrames(frameDir: string): Promise<void> {
  try {
    await fs.promises.rm(frameDir, { recursive: true, force: true });
  } catch (error: any) {
    logger.warn('Failed to cleanup frame directory', { frameDir, error: error.message });
  }
}
