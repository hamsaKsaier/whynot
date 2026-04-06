import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('model-selector');

/**
 * Claude model identifiers — streamlined to 2 models for cost/performance
 */
export type ClaudeModel =
  | 'claude-3-5-haiku-20241022'
  | 'claude-sonnet-4-6'
  | 'gemma-4-26b-a4b-it';

/**
 * Task complexity levels
 */
export type TaskComplexity = 'simple' | 'medium' | 'complex';

/**
 * Focus areas for the QA Loop
 */
export type FocusArea = 'explore' | 'chaos' | 'investigate' | 'retest';

/**
 * Model pricing in dollars per million tokens
 */
export const MODEL_PRICING: Record<ClaudeModel, { input: number; output: number }> = {
  'claude-3-5-haiku-20241022': { input: 1, output: 5 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'gemma-4-26b-a4b-it': { input: 0, output: 0 },  // Free via Google AI Studio
};

/**
 * Model capabilities and use cases
 */
export const MODEL_CAPABILITIES: Record<ClaudeModel, {
  complexity: TaskComplexity[];
  maxTokens: number;
  description: string;
}> = {
  'claude-3-5-haiku-20241022': {
    complexity: ['simple', 'medium'],
    maxTokens: 8192,
    description: 'Smart and cheap — good for simple tool calls, exploration, and structured test generation'
  },
  'claude-sonnet-4-6': {
    complexity: ['simple', 'medium', 'complex'],
    maxTokens: 64000,
    description: 'Best all-round model — coding, analysis, complex reasoning, and vision'
  },
  'gemma-4-26b-a4b-it': {
    complexity: ['simple', 'medium', 'complex'],
    maxTokens: 8192,
    description: 'Free via Google AI Studio — QA exploration, JSON generation, tool calling'
  },
};

/**
 * Default model mapping for each focus area
 * explore/investigate use Sonnet 4.6 — Haiku is NOT smart enough to reliably call
 * save_test_case / add_bug with well-structured payloads.
 * chaos/retest are mechanical tool calls that Haiku 3.5 handles fine.
 */
/**
 * When GOOGLE_AI_API_KEY is set, exploration uses Gemma 4 ($0).
 * Chaos / retest / investigate still use Claude (Gemma lacks the specialised
 * agents). The orchestrator handles the actual session creation — this map
 * is used for model selection logging and cost estimation.
 */
const defaultExploreModel: ClaudeModel = process.env.GOOGLE_AI_API_KEY
  ? 'gemma-4-26b-a4b-it'
  : 'claude-sonnet-4-6';

export const FOCUS_AREA_MODELS: Record<FocusArea, ClaudeModel> = {
  explore: defaultExploreModel,
  chaos: 'claude-3-5-haiku-20241022',      // Haiku 3.5: simple mechanical tool calls
  investigate: 'claude-sonnet-4-6',        // Sonnet 4.6 for analysis
  retest: 'claude-3-5-haiku-20241022'      // Haiku 3.5: straightforward test execution
};

/**
 * Tool complexity mapping - determines which model to use based on tool
 */
const TOOL_COMPLEXITY: Record<string, TaskComplexity> = {
  // Simple tools - Haiku can handle
  'navigate': 'simple',
  'click': 'simple',
  'type_text': 'simple',
  'screenshot': 'simple',
  'scroll': 'simple',
  'wait': 'simple',
  'get_page_elements': 'simple',

  // Medium complexity - Sonnet preferred
  'save_test_case': 'medium',
  'save_bug': 'medium',
  'add_note': 'medium',
  'add_page': 'medium',
  'get_session_state': 'medium',
  'plan_chaos_attacks': 'medium',
  'run_injection_test': 'medium',
  'run_boundary_test': 'medium',

  // Complex tools - Sonnet 4.6 handles these well (no need for Opus anymore)
  'analyze_failure': 'complex',
  'correlate_failures': 'complex',
  'minimize_reproduction': 'complex',
  'save_root_cause': 'complex',
  'calculate_quality_score': 'complex',
  'generate_report': 'complex'
};

/**
 * Model selector options
 */
export interface ModelSelectorOptions {
  focusArea?: FocusArea;
  taskComplexity?: TaskComplexity;
  toolName?: string;
  preferCostEffective?: boolean;
  forceModel?: ClaudeModel;
}

/**
 * Model selection result
 */
export interface ModelSelection {
  model: ClaudeModel;
  reason: string;
  estimatedCostPerCall: number; // Estimated cost in cents for typical call
}

/**
 * Select the appropriate Claude model based on task requirements
 */
export function selectModel(options: ModelSelectorOptions = {}): ModelSelection {
  const {
    focusArea,
    taskComplexity,
    toolName,
    preferCostEffective = false,
    forceModel
  } = options;

  // If a specific model is forced, use it
  if (forceModel) {
    return {
      model: forceModel,
      reason: 'Forced model selection',
      estimatedCostPerCall: estimateCostPerCall(forceModel)
    };
  }

  // Determine complexity from tool if provided
  let complexity: TaskComplexity = taskComplexity || 'medium';
  if (toolName && TOOL_COMPLEXITY[toolName]) {
    complexity = TOOL_COMPLEXITY[toolName];
  }

  // Select based on focus area if provided
  if (focusArea) {
    const areaModel = FOCUS_AREA_MODELS[focusArea];

    // For complex tasks, always use Sonnet 4.6 (replaces Opus)
    if (complexity === 'complex') {
      logger.debug('Using Sonnet 4.6 for complex task', { focusArea, complexity });
      return {
        model: 'claude-sonnet-4-6',
        reason: `Complex task in ${focusArea} phase`,
        estimatedCostPerCall: estimateCostPerCall('claude-sonnet-4-6')
      };
    }

    return {
      model: areaModel,
      reason: `Default model for ${focusArea} focus area`,
      estimatedCostPerCall: estimateCostPerCall(areaModel)
    };
  }

  // Select based on complexity alone
  let selectedModel: ClaudeModel;
  let reason: string;

  switch (complexity) {
    case 'simple':
      selectedModel = preferCostEffective ? 'claude-3-5-haiku-20241022' : 'claude-sonnet-4-6';
      reason = preferCostEffective ? 'Cost-effective Haiku for simple task' : 'Sonnet 4.6 for simple task';
      break;
    case 'complex':
      selectedModel = 'claude-sonnet-4-6';
      reason = 'Complex task requires Sonnet 4.6 reasoning';
      break;
    case 'medium':
    default:
      selectedModel = 'claude-sonnet-4-6';
      reason = 'Standard Sonnet 4.6 for medium complexity task';
      break;
  }

  return {
    model: selectedModel,
    reason,
    estimatedCostPerCall: estimateCostPerCall(selectedModel)
  };
}

/**
 * Estimate cost per typical API call (in cents)
 * Assumes ~1000 input tokens and ~500 output tokens per call
 */
function estimateCostPerCall(model: ClaudeModel): number {
  const pricing = MODEL_PRICING[model];
  const estimatedInputTokens = 1000;
  const estimatedOutputTokens = 500;

  const costDollars =
    (estimatedInputTokens * pricing.input / 1_000_000) +
    (estimatedOutputTokens * pricing.output / 1_000_000);

  return costDollars * 100; // Convert to cents
}

/**
 * Calculate actual cost for a completed API call
 */
export function calculateCost(
  model: ClaudeModel,
  inputTokens: number,
  outputTokens: number
): { costCents: number; costDollars: number } {
  const pricing = MODEL_PRICING[model];

  const costDollars =
    (inputTokens * pricing.input / 1_000_000) +
    (outputTokens * pricing.output / 1_000_000);

  return {
    costCents: costDollars * 100,
    costDollars
  };
}

/**
 * Get model display name for UI
 */
export function getModelDisplayName(model: ClaudeModel): string {
  switch (model) {
    case 'claude-3-5-haiku-20241022':
      return 'Claude 3.5 Haiku';
    case 'claude-sonnet-4-6':
      return 'Claude Sonnet 4.6';
    case 'gemma-4-26b-a4b-it':
      return 'Gemma 4 26B';
    default:
      return model;
  }
}

/**
 * Check if model upgrade is recommended for current context
 */
export function shouldUpgradeModel(
  currentModel: ClaudeModel,
  consecutiveFailures: number,
  taskComplexity: TaskComplexity
): { shouldUpgrade: boolean; suggestedModel?: ClaudeModel; reason?: string } {
  // Upgrade if multiple failures with Haiku
  if (consecutiveFailures >= 3 && currentModel === 'claude-3-5-haiku-20241022') {
    return {
      shouldUpgrade: true,
      suggestedModel: 'claude-sonnet-4-6',
      reason: 'Multiple failures with Haiku, upgrading to Sonnet 4.6'
    };
  }

  // Upgrade for complex tasks if using Haiku
  if (taskComplexity === 'complex' && currentModel !== 'claude-sonnet-4-6') {
    return {
      shouldUpgrade: true,
      suggestedModel: 'claude-sonnet-4-6',
      reason: 'Complex task benefits from Sonnet 4.6 capabilities'
    };
  }

  return { shouldUpgrade: false };
}

export default {
  selectModel,
  calculateCost,
  getModelDisplayName,
  shouldUpgradeModel,
  MODEL_PRICING,
  MODEL_CAPABILITIES,
  FOCUS_AREA_MODELS
};
