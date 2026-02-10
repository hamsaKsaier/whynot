# Visual Regression Intelligence - Setup Guide

## Quick Start

### 1. Run Database Migration

```bash
./run-visual-regression-migration.sh
```

Or manually:
```bash
docker compose exec database psql -U thundercode -d thundercode -f /docker-entrypoint-initdb.d/migrations/008_visual_regression.sql
```

### 2. Install Dependencies

```bash
cd services/test-executor
npm install
npm run build
```

### 3. Configure Environment Variables

Add to your `.env` file or `docker-compose.yml`:

```bash
# Visual Regression Settings
VISUAL_REGRESSION_ENABLED=true
VISUAL_REGRESSION_PIXEL_THRESHOLD=0.01  # 1% pixel difference threshold
VISUAL_REGRESSION_AI_ANALYSIS_ENABLED=true
VISUAL_REGRESSION_AUTO_BASELINE=true  # Auto-promote successful runs
VISUAL_REGRESSION_DIFF_DIR=./visual-diffs  # Directory for diff images
```

### 4. Restart Services

```bash
docker compose restart test-executor gateway
```

Or rebuild and restart:

```bash
docker compose up -d --build test-executor gateway
```

### 5. Test the Feature

1. Run a test execution that completes successfully
2. Check that baselines are created in the database:
   ```sql
   SELECT * FROM visual_baselines ORDER BY created_at DESC LIMIT 5;
   ```

3. Run the same test again (or a modified version)
4. Check for visual comparisons:
   ```sql
   SELECT * FROM visual_comparisons ORDER BY created_at DESC LIMIT 5;
   ```

5. View visual regressions in the frontend:
   - Navigate to test execution results
   - Look for visual regression indicators on steps
   - Click to view detailed comparison

## Verification Checklist

- [ ] Migration executed successfully
- [ ] Dependencies installed (`pixelmatch`, `pngjs`, `@types/pixelmatch`, `@types/pngjs`)
- [ ] Environment variables configured
- [ ] Services restarted
- [ ] First baseline created after successful test execution
- [ ] Visual comparison performed on subsequent runs
- [ ] AI analysis working (check AI service logs)
- [ ] Frontend components displaying visual regression indicators
- [ ] Diff images being generated in `visual-diffs` directory

## Configuration Options

### Strict Mode (Catch All Changes)
```bash
VISUAL_REGRESSION_PIXEL_THRESHOLD=0.001  # 0.1%
VISUAL_REGRESSION_AI_ANALYSIS_ENABLED=true
```

### Balanced Mode (Default)
```bash
VISUAL_REGRESSION_PIXEL_THRESHOLD=0.01   # 1%
VISUAL_REGRESSION_AI_ANALYSIS_ENABLED=true
```

### Relaxed Mode (Only Critical)
```bash
VISUAL_REGRESSION_PIXEL_THRESHOLD=0.05   # 5%
VISUAL_REGRESSION_AI_ANALYSIS_ENABLED=true
```

### Disable AI Analysis (Pixel-Only)
```bash
VISUAL_REGRESSION_AI_ANALYSIS_ENABLED=false
```

### Disable Auto-Baseline (Manual Baseline Management)
```bash
VISUAL_REGRESSION_AUTO_BASELINE=false
```

## Troubleshooting

### Migration Issues

**Error: relation "visual_baselines" does not exist**
- Solution: Run the migration script or execute SQL manually

**Error: permission denied**
- Solution: Ensure database user has CREATE TABLE permissions

### Dependency Issues

**Error: Cannot find module 'pixelmatch'**
- Solution: Run `npm install` in `services/test-executor` directory

**Error: Cannot find module '@types/pixelmatch'**
- Solution: Install dev dependencies: `npm install --save-dev @types/pixelmatch @types/pngjs`

### Runtime Issues

**No baselines being created**
- Check: `VISUAL_REGRESSION_ENABLED=true`
- Check: `VISUAL_REGRESSION_AUTO_BASELINE=true`
- Check: Test execution completes successfully
- Check: Test execution has screenshots captured

**AI analysis not working**
- Check: AI service is running
- Check: `VISUAL_REGRESSION_AI_ANALYSIS_ENABLED=true`
- Check: AI service logs for errors
- Check: API key configured for LLM provider

**Visual comparisons not appearing**
- Check: Baseline exists for the test case and step
- Check: Screenshots are being captured
- Check: Test executor logs for visual comparison errors

## Next Steps

1. Review [Visual Regression Intelligence Documentation](docs/VISUAL_REGRESSION_INTELLIGENCE.md)
2. Configure thresholds based on your needs
3. Monitor visual regressions in the dashboard
4. Adjust baseline management strategy
5. Review and approve/ignore regressions as needed
