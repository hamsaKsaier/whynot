/**
 * QA Loop Optimization Configuration
 * Tune these values to balance speed, cost, and quality
 */

export interface OptimizationConfig {
  // Model Selection
  models: {
    exploration: 'haiku' | 'sonnet';      // Default: haiku (cheaper)
    testGeneration: 'haiku' | 'sonnet';   // Default: sonnet
    investigation: 'sonnet' | 'opus';      // Default: sonnet (opus too expensive)
    chaos: 'haiku' | 'sonnet';             // Default: haiku
  };

  // Token Limits
  tokens: {
    maxHtmlChars: number;           // Max HTML chars to send (default: 5000)
    maxDocumentTokens: number;      // Max document context tokens (default: 10000)
    maxSystemPromptTokens: number;  // Max system prompt (default: 2000)
  };

  // Loop Limits
  loops: {
    maxToolLoopsPerIteration: number;  // Max API calls per iteration (default: 10)
    maxIterations: number;              // Max total iterations (default: 20)
    maxPagesPerIteration: number;       // Pages to explore per iteration (default: 3)
  };

  // Parallelization
  parallel: {
    enabled: boolean;                   // Enable parallel exploration
    maxConcurrentPages: number;         // Max pages to explore in parallel (default: 3)
    maxConcurrentTests: number;         // Max tests to run in parallel (default: 2)
  };

  // Cost Controls
  cost: {
    maxBudgetCents: number;            // Max budget in cents (default: 100 = $1)
    warnAtPercentage: number;          // Warn when this % of budget used (default: 80)
    stopAtPercentage: number;          // Stop when this % of budget used (default: 95)
  };

  // Speed Optimizations
  speed: {
    reduceWaitTimes: boolean;          // Reduce sleep/wait times
    skipDuplicatePages: boolean;       // Skip pages with same content hash
    batchToolCalls: boolean;           // Batch compatible tool calls
  };
}

// Cost-optimized preset (cheapest)
export const COST_OPTIMIZED: OptimizationConfig = {
  models: {
    exploration: 'haiku',
    testGeneration: 'haiku',
    investigation: 'sonnet',  // Never use Opus
    chaos: 'haiku'
  },
  tokens: {
    maxHtmlChars: 3000,
    maxDocumentTokens: 5000,
    maxSystemPromptTokens: 1500
  },
  loops: {
    maxToolLoopsPerIteration: 8,
    maxIterations: 15,
    maxPagesPerIteration: 2
  },
  parallel: {
    enabled: false,  // Sequential is cheaper
    maxConcurrentPages: 1,
    maxConcurrentTests: 1
  },
  cost: {
    maxBudgetCents: 50,  // $0.50 max
    warnAtPercentage: 70,
    stopAtPercentage: 90
  },
  speed: {
    reduceWaitTimes: true,
    skipDuplicatePages: true,
    batchToolCalls: false
  }
};

// Speed-optimized preset (fastest)
export const SPEED_OPTIMIZED: OptimizationConfig = {
  models: {
    exploration: 'haiku',     // Fast model
    testGeneration: 'sonnet',
    investigation: 'sonnet',
    chaos: 'haiku'
  },
  tokens: {
    maxHtmlChars: 4000,
    maxDocumentTokens: 8000,
    maxSystemPromptTokens: 1500
  },
  loops: {
    maxToolLoopsPerIteration: 12,
    maxIterations: 25,
    maxPagesPerIteration: 5
  },
  parallel: {
    enabled: true,
    maxConcurrentPages: 3,
    maxConcurrentTests: 2
  },
  cost: {
    maxBudgetCents: 200,  // $2 max
    warnAtPercentage: 80,
    stopAtPercentage: 95
  },
  speed: {
    reduceWaitTimes: true,
    skipDuplicatePages: true,
    batchToolCalls: true
  }
};

// Balanced preset (recommended)
export const BALANCED: OptimizationConfig = {
  models: {
    exploration: 'haiku',
    testGeneration: 'sonnet',
    investigation: 'sonnet',
    chaos: 'haiku'
  },
  tokens: {
    maxHtmlChars: 5000,
    maxDocumentTokens: 10000,
    maxSystemPromptTokens: 2000
  },
  loops: {
    maxToolLoopsPerIteration: 10,
    maxIterations: 20,
    maxPagesPerIteration: 3
  },
  parallel: {
    enabled: true,
    maxConcurrentPages: 2,
    maxConcurrentTests: 1
  },
  cost: {
    maxBudgetCents: 100,  // $1 max
    warnAtPercentage: 75,
    stopAtPercentage: 95
  },
  speed: {
    reduceWaitTimes: true,
    skipDuplicatePages: true,
    batchToolCalls: true
  }
};

// Quality preset (best results, higher cost)
export const QUALITY_OPTIMIZED: OptimizationConfig = {
  models: {
    exploration: 'sonnet',
    testGeneration: 'sonnet',
    investigation: 'sonnet',  // Still avoid Opus
    chaos: 'sonnet'
  },
  tokens: {
    maxHtmlChars: 8000,
    maxDocumentTokens: 20000,
    maxSystemPromptTokens: 3000
  },
  loops: {
    maxToolLoopsPerIteration: 15,
    maxIterations: 30,
    maxPagesPerIteration: 3
  },
  parallel: {
    enabled: true,
    maxConcurrentPages: 2,
    maxConcurrentTests: 1
  },
  cost: {
    maxBudgetCents: 300,  // $3 max
    warnAtPercentage: 80,
    stopAtPercentage: 95
  },
  speed: {
    reduceWaitTimes: true,
    skipDuplicatePages: true,
    batchToolCalls: true
  }
};

// Default export
export const DEFAULT_CONFIG = BALANCED;

// Get config by name
export function getOptimizationConfig(preset: 'cost' | 'speed' | 'balanced' | 'quality'): OptimizationConfig {
  switch (preset) {
    case 'cost': return COST_OPTIMIZED;
    case 'speed': return SPEED_OPTIMIZED;
    case 'quality': return QUALITY_OPTIMIZED;
    case 'balanced':
    default: return BALANCED;
  }
}
