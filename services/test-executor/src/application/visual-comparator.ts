import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PNG } from 'pngjs';
import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pixelmatch = require('pixelmatch');
import { VisualComparisonResult, ComparisonOptions, AIVisualDiffAnalysis } from '../../shared/types';
import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('visual-comparator');

export class VisualComparator {
  private aiServiceUrl: string;
  private diffDir: string;
  private pixelThreshold: number;
  private enableAIAnalysis: boolean;
  private generateDiffImage: boolean;

  constructor(
    aiServiceUrl: string = process.env.AI_SERVICE_URL || 'http://localhost:8000',
    diffDir: string = process.env.VISUAL_REGRESSION_DIFF_DIR || './visual-diffs'
  ) {
    this.aiServiceUrl = aiServiceUrl;
    this.diffDir = diffDir;
    this.pixelThreshold = parseFloat(process.env.VISUAL_REGRESSION_PIXEL_THRESHOLD || '0.01');
    this.enableAIAnalysis = process.env.VISUAL_REGRESSION_AI_ANALYSIS_ENABLED !== 'false';
    this.generateDiffImage = process.env.VISUAL_REGRESSION_GENERATE_DIFF !== 'false';

    // Ensure diff directory exists
    if (!fs.existsSync(this.diffDir)) {
      fs.mkdirSync(this.diffDir, { recursive: true });
    }
  }

  /**
   * Compare two screenshots and return comparison result
   */
  async compareScreenshots(
    baselinePath: string,
    currentPath: string,
    options?: ComparisonOptions
  ): Promise<VisualComparisonResult> {
    const pixelThreshold = options?.pixelThreshold ?? this.pixelThreshold;
    const enableAIAnalysis = options?.enableAIAnalysis ?? this.enableAIAnalysis;
    const generateDiffImage = options?.generateDiffImage ?? this.generateDiffImage;

    try {
      // Load images
      const baselineImg = this.loadImage(baselinePath);
      const currentImg = this.loadImage(currentPath);

      // Ensure images have same dimensions
      if (baselineImg.width !== currentImg.width || baselineImg.height !== currentImg.height) {
        logger.warn('Screenshots have different dimensions', {
          baseline: { width: baselineImg.width, height: baselineImg.height },
          current: { width: currentImg.width, height: currentImg.height }
        });
        
        // For dimension mismatches, treat as regression
        return {
          isRegression: true,
          pixelDiffScore: 1.0,
          severity: 'critical',
          differences: [`Dimension mismatch: baseline ${baselineImg.width}x${baselineImg.height} vs current ${currentImg.width}x${currentImg.height}`]
        };
      }

      // Perform pixel-level comparison
      const { diffScore, diffImage, diffCount } = await this.comparePixels(
        baselineImg,
        currentImg,
        generateDiffImage ? `${path.basename(baselinePath, '.png')}-${path.basename(currentPath, '.png')}-diff.png` : undefined
      );

      const isRegression = diffScore > pixelThreshold;

      // Prepare result
      const result: VisualComparisonResult = {
        isRegression,
        pixelDiffScore: diffScore,
        severity: this.calculateSeverity(diffScore),
        differences: []
      };

      // Generate diff image if requested and differences found
      if (generateDiffImage && isRegression && diffImage) {
        result.diffImagePath = diffImage;
      }

      // If regression detected, perform AI analysis if enabled
      if (isRegression && enableAIAnalysis) {
        try {
          const aiAnalysis = await this.analyzeWithAI(baselinePath, currentPath, diffScore);
          result.aiAnalysis = aiAnalysis;
          result.severity = aiAnalysis.severity; // Use AI-assessed severity
          result.differences = aiAnalysis.descriptions;
          
          if (aiAnalysis.recommendations) {
            result.differences.push(...aiAnalysis.recommendations.map(r => `💡 ${r}`));
          }
        } catch (aiError: any) {
          logger.warn('AI analysis failed, using pixel-based assessment', { error: aiError.message });
          result.differences.push(`Pixel difference detected: ${(diffScore * 100).toFixed(2)}% of pixels differ (${diffCount} pixels)`);
        }
      } else if (isRegression) {
        // Fallback to pixel-based description
        result.differences.push(`Pixel difference detected: ${(diffScore * 100).toFixed(2)}% of pixels differ (${diffCount} pixels)`);
      } else {
        result.differences.push('No significant visual differences detected');
      }

      return result;
    } catch (error: any) {
      logger.error('Visual comparison failed', { error: error.message, baselinePath, currentPath });
      throw new Error(`Visual comparison failed: ${error.message}`);
    }
  }

  /**
   * Load PNG image from file path
   */
  private loadImage(filePath: string): PNG {
    const fileBuffer = fs.readFileSync(filePath);
    return PNG.sync.read(fileBuffer);
  }

  /**
   * Compare two images at pixel level using pixelmatch
   */
  private async comparePixels(
    img1: PNG,
    img2: PNG,
    diffFileName?: string
  ): Promise<{ diffScore: number; diffImage?: string; diffCount: number }> {
    const { data: data1, width, height } = img1;
    const { data: data2 } = img2;

    // Create output diff image buffer
    const diff = new PNG({ width, height });
    const diffData = diff.data;

    // Perform pixel comparison
    const diffCount = pixelmatch(
      data1 as Buffer,
      data2 as Buffer,
      diffData as Buffer,
      width,
      height,
      {
        threshold: 0.1, // Pixel difference threshold (0.1 = 10%)
        includeAA: false, // Ignore anti-aliasing
        alpha: 0.1, // Alpha channel threshold
        diffColor: [255, 0, 0], // Red for differences
        diffColorAlt: [255, 0, 255] // Magenta for alt differences
      }
    );

    const totalPixels = width * height;
    const diffScore = diffCount / totalPixels;

    // Save diff image if requested
    let diffImagePath: string | undefined;
    if (diffFileName) {
      diffImagePath = path.join(this.diffDir, diffFileName);
      const diffBuffer = PNG.sync.write(diff);
      fs.writeFileSync(diffImagePath, diffBuffer);
      logger.debug('Diff image saved', { path: diffImagePath });
    }

    return { diffScore, diffImage: diffImagePath, diffCount };
  }

  /**
   * Calculate severity based on pixel difference score
   */
  private calculateSeverity(diffScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (diffScore >= 0.5) return 'critical';
    if (diffScore >= 0.2) return 'high';
    if (diffScore >= 0.05) return 'medium';
    return 'low';
  }

  /**
   * Analyze visual differences using AI service
   */
  private async analyzeWithAI(
    baselinePath: string,
    currentPath: string,
    pixelDiffScore: number
  ): Promise<AIVisualDiffAnalysis> {
    try {
      // Read images as base64
      const baselineBuffer = fs.readFileSync(baselinePath);
      const currentBuffer = fs.readFileSync(currentPath);
      const baselineBase64 = baselineBuffer.toString('base64');
      const currentBase64 = currentBuffer.toString('base64');

      // Call AI service
      const response = await axios.post(
        `${this.aiServiceUrl}/api/analyze-visual-diff`,
        {
          baseline_screenshot_base64: baselineBase64,
          current_screenshot_base64: currentBase64,
          pixel_diff_score: pixelDiffScore
        },
        {
          timeout: 60000 // 60 second timeout for AI analysis
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('AI visual diff analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate SHA-256 hash of screenshot for quick comparison
   */
  static calculateScreenshotHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Generate diff image (standalone method)
   */
  async createDiffImage(
    baselinePath: string,
    currentPath: string,
    outputPath: string
  ): Promise<string> {
    const baselineImg = this.loadImage(baselinePath);
    const currentImg = this.loadImage(currentPath);

    if (baselineImg.width !== currentImg.width || baselineImg.height !== currentImg.height) {
      throw new Error('Cannot generate diff image: screenshots have different dimensions');
    }

    const { diffImage } = await this.comparePixels(
      baselineImg,
      currentImg,
      path.basename(outputPath)
    );

    if (!diffImage) {
      throw new Error('Failed to generate diff image');
    }

    // Move to desired output path if different
    if (diffImage !== outputPath) {
      fs.copyFileSync(diffImage, outputPath);
      fs.unlinkSync(diffImage);
    }

    return outputPath;
  }
}
