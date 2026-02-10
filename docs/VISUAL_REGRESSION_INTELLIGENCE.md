# Visual Regression Intelligence

## Overview

Visual Regression Intelligence is an automated visual testing system that compares screenshots between test executions to detect visual bugs that functional tests miss. This feature aims to **catch 30% more bugs** by identifying visual regressions that would otherwise go unnoticed.

## Goals

### Primary Goals

1. **Catch Visual Bugs Automatically**
   - Detect layout shifts, styling changes, missing elements, and content regressions
   - Identify issues that functional tests cannot catch (e.g., color changes, spacing issues, broken layouts)
   - Reduce manual visual inspection workload by 80%

2. **Increase Bug Detection Rate**
   - Target: **Catch 30% more bugs** compared to functional testing alone
   - Catch regressions before they reach production
   - Provide early feedback during development

3. **AI-Powered Analysis**
   - Use AI to distinguish between cosmetic changes and functional regressions
   - Provide semantic descriptions of visual differences
   - Classify severity (low, medium, high, critical) automatically

4. **Seamless Integration**
   - Work automatically with existing test executions
   - No additional test writing required
   - Auto-baseline successful executions

### Secondary Goals

1. **Baseline Management**
   - Automatically promote successful test executions as baselines
   - Version baseline history for rollback and comparison
   - Lock baselines to prevent unwanted updates

2. **Smart Thresholding**
   - Ignore insignificant differences (anti-aliasing, rendering variations)
   - Focus on meaningful visual regressions
   - Configurable pixel difference thresholds

3. **User-Friendly Interface**
   - Side-by-side comparison view
   - Overlay and diff image visualization
   - AI analysis with human-readable descriptions
   - Ignore/approve regressions with one click

## Architecture

### Hybrid Comparison Strategy

1. **Pixel-Level Comparison First** (Fast)
   - Uses `pixelmatch` library for exact pixel difference detection
   - Calculates diff score (percentage of pixels different)
   - Generates diff images highlighting differences

2. **AI Visual Diff Analysis** (Intelligent)
   - When pixel differences detected, AI analyzes semantic meaning
   - Classifies difference types (layout shift, color change, content update, etc.)
   - Assesses severity and functional impact
   - Provides recommendations for investigation

3. **Smart Thresholding** (Configurable)
   - Default: 1% pixel difference threshold
   - Configurable per environment
   - Severity-based failure handling

### Baseline Management Strategy

- **Auto-Baseline on Latest Successful Execution**: After a test execution completes successfully, automatically promote its screenshots as the new baseline
- **Baseline Versioning**: Store baseline history to allow rollback and comparison across multiple versions
- **Baseline Locking**: Option to lock baselines to prevent automatic updates (manual approval required)

## How It Works

### Test Execution Flow

1. **Test Execution Starts**
   - Test runs normally, capturing screenshots at each step (existing behavior)

2. **For Each Step with Screenshot**:
   - Check if baseline exists for this test case + step
   - If baseline exists:
     - Compare current screenshot with baseline using pixel-level comparison
     - If pixel diff > threshold (default 1%):
       - Generate diff image highlighting differences
       - Call AI service for semantic analysis
       - Determine regression severity
       - Store comparison result in database
     - If regression detected and severity is high/critical:
       - Mark step as failed
       - Add visual regression error to step result

3. **After Successful Execution**:
   - Automatically promote all step screenshots as new baselines (if auto-baseline enabled)
   - Create new baseline versions for each step
   - Update baseline history

### Visual Comparison Process

```
Screenshot Capture → Check Baseline → Pixel Comparison → AI Analysis → Store Result → Auto-Baseline
```

### AI Analysis Process

1. **Difference Detection**: Pixel-level comparison identifies changed pixels
2. **Semantic Analysis**: AI analyzes the visual differences to understand:
   - What changed (layout, color, content, elements)
   - Where it changed (page regions, elements)
   - Severity assessment (low, medium, high, critical)
   - Functional impact evaluation
3. **Recommendations**: AI provides actionable suggestions for investigation

## Configuration

### Environment Variables

```bash
# Visual Regression Settings
VISUAL_REGRESSION_ENABLED=true                    # Enable/disable visual regression testing
VISUAL_REGRESSION_PIXEL_THRESHOLD=0.01           # 1% pixel difference threshold
VISUAL_REGRESSION_AI_ANALYSIS_ENABLED=true       # Enable AI semantic analysis
VISUAL_REGRESSION_AUTO_BASELINE=true             # Auto-promote successful runs as baselines
VISUAL_REGRESSION_DIFF_DIR=./visual-diffs        # Directory for diff images
```

### Configuration Examples

**Strict Mode** (Catch all changes):
```bash
VISUAL_REGRESSION_PIXEL_THRESHOLD=0.001  # 0.1% threshold
VISUAL_REGRESSION_AI_ANALYSIS_ENABLED=true
```

**Relaxed Mode** (Only critical changes):
```bash
VISUAL_REGRESSION_PIXEL_THRESHOLD=0.05   # 5% threshold
VISUAL_REGRESSION_AI_ANALYSIS_ENABLED=true
```

**AI-Only Mode** (Use AI to determine severity):
```bash
VISUAL_REGRESSION_PIXEL_THRESHOLD=0.1    # 10% threshold
VISUAL_REGRESSION_AI_ANALYSIS_ENABLED=true  # AI will filter false positives
```

## Database Schema

### `visual_baselines` Table
- Stores baseline screenshots per test case and step
- Tracks baseline version history
- Supports baseline locking

### `visual_comparisons` Table
- Stores comparison results for each execution
- Includes pixel diff scores, AI analysis, and regression severity
- Links to baselines and executions

## API Endpoints

### Baseline Management
- `GET /api/test-cases/:id/baselines` - Get all baselines for a test case
- `GET /api/test-cases/:id/baselines/:stepId` - Get baseline history for a step
- `POST /api/test-cases/:id/baselines` - Create/update baseline (manual)
- `PUT /api/test-cases/:id/baselines/:baselineId/lock` - Lock/unlock baseline

### Visual Comparisons
- `GET /api/executions/:id/visual-comparisons` - Get comparisons for an execution
- `GET /api/visual-regressions` - Get all visual regressions (filtered, paginated)
- `PUT /api/visual-regressions/:id/ignore` - Ignore/unignore a regression

## Frontend Components

### VisualComparisonViewer
- Side-by-side, overlay, and diff image views
- AI analysis panel with semantic descriptions
- Severity indicators and regression details
- Ignore/approve actions

### BaselineManager
- View all baselines for a test case
- Baseline version history
- Lock/unlock baselines
- Promote execution as baseline manually

### TestResultsView Integration
- Visual regression indicators in step results
- Direct links to visual comparison viewer
- Severity badges (low, medium, high, critical)

## Benefits

### For Development Teams

1. **Early Bug Detection**: Catch visual regressions before they reach production
2. **Automated Visual Testing**: No manual screenshot comparison needed
3. **AI-Powered Intelligence**: Understand what changed, not just that something changed
4. **Time Savings**: Reduce manual visual inspection by 80%

### For QA Teams

1. **Comprehensive Coverage**: Test visual aspects that functional tests miss
2. **Detailed Analysis**: Understand the nature of visual changes
3. **Prioritization**: Severity-based classification helps prioritize fixes
4. **Historical Tracking**: Baseline versioning enables trend analysis

### For Product Teams

1. **Quality Assurance**: Maintain consistent visual experience across releases
2. **User Experience Protection**: Prevent broken layouts and visual bugs
3. **Confidence**: Automated visual regression detection increases release confidence
4. **Documentation**: Visual comparison history serves as documentation of UI evolution

## Expected Impact

- **30% More Bugs Caught**: Visual regression testing catches issues functional tests miss
- **80% Reduction in Manual Inspection**: Automated comparison eliminates manual screenshot review
- **Faster Feedback**: Immediate visual regression detection during development
- **Better Quality**: Consistent visual experience across releases

## Next Steps

1. **Run Migration**: Execute `008_visual_regression.sql` migration
2. **Install Dependencies**: Run `npm install` in test-executor directory
3. **Configure Environment**: Set visual regression environment variables
4. **Test Flow**: Run a test execution and verify visual comparison works
5. **Monitor Baselines**: Check that baselines are created automatically after successful runs

## Troubleshooting

### Common Issues

1. **Migration Not Applied**: Run `./run-visual-regression-migration.sh`
2. **Dependencies Missing**: Run `cd services/test-executor && npm install`
3. **Baselines Not Created**: Check `VISUAL_REGRESSION_AUTO_BASELINE` is `true`
4. **AI Analysis Failing**: Verify AI service is running and `VISUAL_REGRESSION_AI_ANALYSIS_ENABLED=true`
5. **No Visual Comparison**: Ensure `VISUAL_REGRESSION_ENABLED=true` and baseline exists

## Future Enhancements

- **Visual Diff Annotations**: Highlight specific regions in screenshots
- **Baseline Approval Workflow**: Require manual approval before auto-baseline
- **Visual Regression Trends**: Track visual regressions over time
- **Cross-Browser Comparison**: Compare screenshots across different browsers
- **Mobile Visual Testing**: Support for mobile viewport comparisons
