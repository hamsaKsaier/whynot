import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('model-selector');

/**
 * Claude model identifiers
 */
export type ClaudeModel =
  | 'claude-3-haiku-20240307'
  | 'claude-sonnet-4-20250514'
  | 'claude-3-opus-20240229';

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
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-3-opus-20240229': { input: 15, output: 75 }
};

/**
 * Model capabilities and use cases
 */
export const MODEL_CAPABILITIES: Record<ClaudeModel, {
  complexity: TaskComplexity[];
  maxTokens: number;
  description: string;
}> = {
  'claude-3-haiku-20240307': {
    complexity: ['simple'],
    maxTokens: 4096,
    description: 'Fast, cost-effective for simple tool calls and straightforward tasks'
  },
  'claude-sonnet-4-20250514': {
    complexity: ['simple', 'medium'],
    maxTokens: 8192,
    description: 'Balanced performance for exploration and test generation'
  },
  'claude-3-opus-20240229': {
    complexity: ['medium', 'complex'],
    maxTokens: 4096,
    description: 'Highest capability for complex analysis and reasoning'
  }
};

/**
 * Default model mapping for each focus area
 * explore/investigate use Sonnet — Haiku is NOT smart enough to reliably call
 * save_test_case / add_bug with well-structured payloads.
 * chaos/retest are mechanical tool calls that Haiku handles fine.
 */
export const FOCUS_AREA_MODELS: Record<FocusArea, ClaudeModel> = {
  explore: 'claude-sonnet-4-20250514',     // Sonnet: generates structured test cases & bugs
  chaos: 'claude-3-haiku-20240307',        // Simple mechanical tool calls
  investigate: 'claude-sonnet-4-20250514', // Sonnet for analysis
  retest: 'claude-3-haiku-20240307'        // Straightforward test execution
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

  // Complex tools - Opus for best results
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

    // Override with complexity-based selection if needed
    if (complexity === 'complex' && focusArea !== 'investigate') {
      logger.debug('Upgrading model for complex task', { focusArea, complexity });
      return {
        model: 'claude-3-opus-20240229',
        reason: `Complex task in ${focusArea} phase`,
        estimatedCostPerCall: estimateCostPerCall('claude-3-opus-20240229')
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
      selectedModel = preferCostEffective ? 'claude-3-haiku-20240307' : 'claude-sonnet-4-20250514';
      reason = preferCostEffective ? 'Cost-effective for simple task' : 'Balanced model for simple task';
      break;
    case 'complex':
      selectedModel = 'claude-3-opus-20240229';
      reason = 'Complex task requires advanced reasoning';
      break;
    case 'medium':
    default:
      selectedModel = 'claude-sonnet-4-20250514';
      reason = 'Standard model for medium complexity task';
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
    case 'claude-3-haiku-20240307':
      return 'Claude 3 Haiku';
    case 'claude-sonnet-4-20250514':
      return 'Claude Sonnet 4';
    case 'claude-3-opus-20240229':
      return 'Claude 3 Opus';
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
  // Upgrade if multiple failures with simpler model
  if (consecutiveFailures >= 3 && currentModel === 'claude-3-haiku-20240307') {
    return {
      shouldUpgrade: true,
      suggestedModel: 'claude-sonnet-4-20250514',
      reason: 'Multiple failures with Haiku, upgrading to Sonnet'
    };
  }

  // Upgrade for complex tasks if using basic model
  if (taskComplexity === 'complex' && currentModel !== 'claude-3-opus-20240229') {
    return {
      shouldUpgrade: true,
      suggestedModel: 'claude-3-opus-20240229',
      reason: 'Complex task benefits from Opus capabilities'
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
