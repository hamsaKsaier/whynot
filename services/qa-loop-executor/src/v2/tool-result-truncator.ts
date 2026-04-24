/**
 * Tool-result truncation — Task 6 (prompt compression payoff).
 *
 * Token-composition telemetry showed `toolResultsAccumulatedAvg` is 89% of
 * every LLM call's input tokens (Scan A baseline: 20,998 / 23,633 avg).
 * Tool-result residual dominates; conversation history, system prompt,
 * tool defs, and project context are all <10% combined.
 *
 * This module caps the string representation of each tool result BEFORE
 * it becomes the content of the next step's `tool` role message, so we
 * shrink input tokens without touching:
 *   - the system prompt (cache-stable)
 *   - tool definitions (cache-stable)
 *   - the tool's actual return value for any post-scan persistence
 *     (we only modify what the model sees)
 *
 * Gated by `ENABLE_PROMPT_COMPRESSION=true`. Default off so Scan A
 * semantics are preserved until Scan B validates the tradeoff.
 *
 * Hook point: `BaseAgent.buildToolsWithExecute()` — the `execute`
 * callback returns the string/object that the AI SDK appends to the
 * conversation as a `tool` role message. Applying the cap there is
 * the single narrowest intercept.
 */

/**
 * Default hard cap (chars) for any tool not overridden below. Aggressive
 * enough to kill most tool-result bloat, lenient enough that standard
 * action tools (click / navigate / form_fill returning tiny JSON) pass
 * through untouched.
 */
const DEFAULT_CAP = 4000;

/**
 * Per-tool caps chosen from the baseline token-composition data + Task 6
 * brief. Smaller for tools that historically returned the biggest payloads
 * (snapshot, evaluate, console, network arrays).
 */
const PER_TOOL_CAPS: Record<string, number> = {
  // Playwright MCP
  browser_snapshot: 3000,             // DOM/a11y trees
  browser_network_requests: 2500,     // Request array
  browser_evaluate: 2000,             // Arbitrary JS returns
  browser_console_messages: 2000,     // Log arrays
  // Chrome DevTools MCP (stricter char caps on top of per-tool line caps
  // already applied in chrome-devtools-mcp.ts#truncateCdpToolResult)
  cdp_list_network_requests: 2500,
  cdp_list_console_messages: 2000,
  cdp_lighthouse_audit: 3000,
  cdp_performance_analyze_insight: 3000,
  cdp_take_snapshot: 3000,
  cdp_evaluate_script: 2000,
};

/**
 * Tools that return base64 image payloads. We strip the payload entirely
 * from the agent's conversation history and replace with a short stub —
 * the screenshot has already been emitted to the WebSocket stream for the
 * frontend preview (mcp-browser.ts#handleBrowserTool), so the model doesn't
 * need to see the bytes to continue its work.
 */
const SCREENSHOT_TOOLS = new Set<string>([
  'browser_take_screenshot',
  'cdp_take_screenshot',
]);

/** Marker appended to truncated text results. */
function truncationMarker(elided: number): string {
  return `\n\n[TRUNCATED: ${elided} chars elided. Call the tool again with a more specific filter if you need more.]`;
}

/** Marker replacing stripped screenshots. */
function screenshotStub(approxBytes: number): string {
  return `[Screenshot captured (${approxBytes} bytes, mime=image/png). Not included in conversation history. Call browser_take_screenshot again to re-capture for analysis.]`;
}

export interface TruncationOutcome {
  /** The result to hand back to the AI SDK (may equal input if no change). */
  truncated: any;
  /** Char length of the original stringified result. */
  charsBefore: number;
  /** Char length of the result after truncation. */
  charsAfter: number;
  /** True if we shortened (or replaced) the result. */
  wasTruncated: boolean;
  /** True if this was a screenshot payload that got stripped to a stub. */
  wasScreenshotStripped: boolean;
}

/**
 * Heuristic screenshot sniff — some tools return a screenshot inside a
 * wrapping object (e.g. `{success: true, screenshot: '<base64>'}`). We
 * treat any value containing a base64-looking string >= 10KB as an
 * image payload regardless of tool name.
 */
function looksLikeBase64Image(value: any): { hit: boolean; approxBytes: number } {
  if (typeof value === 'string') {
    if (value.length >= 10_000 && /^[A-Za-z0-9+/=\n]+$/.test(value.slice(0, 200))) {
      return { hit: true, approxBytes: Math.floor(value.length * 0.75) };
    }
    return { hit: false, approxBytes: 0 };
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) {
      const probe = looksLikeBase64Image(v);
      if (probe.hit) return probe;
    }
  }
  return { hit: false, approxBytes: 0 };
}

/**
 * Apply the truncation rules. `toolName` is the fully-qualified tool name
 * (e.g. `browser_snapshot`, `cdp_list_network_requests`). Safe to call on
 * any value shape — strings, objects, arrays, null, undefined.
 */
export function truncateToolResult(toolName: string, result: any): TruncationOutcome {
  const asString = typeof result === 'string'
    ? result
    : (() => { try { return JSON.stringify(result ?? null); } catch { return String(result); } })();
  const charsBefore = asString.length;

  // Screenshot handling — explicit tool name OR heuristic base64 sniff.
  // mcp-browser.ts already short-circuits `browser_take_screenshot` to a
  // tiny success message before we see it, but this is a belt+braces
  // catch for any tool that smuggles an image through a wrapper.
  const imageProbe = looksLikeBase64Image(result);
  if (SCREENSHOT_TOOLS.has(toolName) || imageProbe.hit) {
    const bytes = imageProbe.approxBytes || Math.floor(charsBefore * 0.75);
    const stub = screenshotStub(bytes);
    return {
      truncated: stub,
      charsBefore,
      charsAfter: stub.length,
      wasTruncated: charsBefore > stub.length,
      wasScreenshotStripped: true,
    };
  }

  const cap = PER_TOOL_CAPS[toolName] ?? DEFAULT_CAP;
  if (charsBefore <= cap) {
    return {
      truncated: result,
      charsBefore,
      charsAfter: charsBefore,
      wasTruncated: false,
      wasScreenshotStripped: false,
    };
  }

  const body = asString.slice(0, cap);
  const elided = charsBefore - cap;
  const truncated = body + truncationMarker(elided);

  return {
    truncated,
    charsBefore,
    charsAfter: truncated.length,
    wasTruncated: true,
    wasScreenshotStripped: false,
  };
}

/** Single place to check the feature flag. */
export function isPromptCompressionEnabled(): boolean {
  return process.env.ENABLE_PROMPT_COMPRESSION === 'true';
}

/**
 * Per-agent aggregate state, populated by BaseAgent as each tool call
 * runs. Orchestrator rolls agent-level stats into the session-wide
 * `toolResultTruncation` block.
 */
export interface ToolTruncationStats {
  enabled: boolean;
  totalToolCalls: number;
  toolsTruncatedCount: number;
  totalCharsBeforeTruncation: number;
  totalCharsAfterTruncation: number;
  /** Per-tool rollup for the top offenders list. */
  perTool: Record<string, {
    invocations: number;
    truncatedInvocations: number;
    sumCharsBefore: number;
    sumCharsAfter: number;
  }>;
}

export function emptyTruncationStats(enabled: boolean): ToolTruncationStats {
  return {
    enabled,
    totalToolCalls: 0,
    toolsTruncatedCount: 0,
    totalCharsBeforeTruncation: 0,
    totalCharsAfterTruncation: 0,
    perTool: {},
  };
}

/** Accumulate a single tool-call outcome into the stats object. */
export function recordTruncation(
  stats: ToolTruncationStats,
  toolName: string,
  outcome: TruncationOutcome,
): void {
  stats.totalToolCalls++;
  stats.totalCharsBeforeTruncation += outcome.charsBefore;
  stats.totalCharsAfterTruncation += outcome.charsAfter;
  if (outcome.wasTruncated) stats.toolsTruncatedCount++;

  const slot = stats.perTool[toolName] ?? (stats.perTool[toolName] = {
    invocations: 0,
    truncatedInvocations: 0,
    sumCharsBefore: 0,
    sumCharsAfter: 0,
  });
  slot.invocations++;
  if (outcome.wasTruncated) slot.truncatedInvocations++;
  slot.sumCharsBefore += outcome.charsBefore;
  slot.sumCharsAfter += outcome.charsAfter;
}
