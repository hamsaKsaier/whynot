import axios from 'axios';
import { ElementSelector, ElementDescription } from '../domain/models';

export interface AgentRecoveryRequest {
  step_id: string;
  step_description: string;
  target_description: ElementDescription;
  attempted_selectors: ElementSelector[];
  error_message: string;
  html: string;
  screenshot_base64?: string;
}

export interface AgentRecoveryResponse {
  success: boolean;
  new_selectors?: ElementSelector[];
  agent_discussion?: any;
  final_decision?: any;
  error?: string;
}

export interface ClaudeFallbackResponse {
  success: boolean;
  recommended_selectors?: ElementSelector[];
  analysis?: string;
  confidence?: number;
  error?: string;
}

export class AgentRecovery {
  private aiServiceUrl: string;

  constructor(aiServiceUrl: string = 'http://localhost:8000') {
    this.aiServiceUrl = aiServiceUrl;
  }

  /**
   * Request agent-based recovery when selectors fail
   */
  async requestRecovery(request: AgentRecoveryRequest): Promise<AgentRecoveryResponse> {
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/api/agent-recovery`,
        request,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000 // 30 second timeout
        }
      );

      return {
        success: true,
        new_selectors: response.data.selected_selectors || [],
        agent_discussion: response.data.agent_discussion,
        final_decision: response.data.final_decision
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Agent recovery request failed'
      };
    }
  }

  /**
   * Request Claude fallback when agents fail
   */
  async requestClaudeFallback(
    request: AgentRecoveryRequest,
    agentDiscussion: any
  ): Promise<ClaudeFallbackResponse> {
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/api/resolve-selector-failure`,
        {
          ...request,
          agent_discussion: agentDiscussion
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000 // 60 second timeout for Claude
        }
      );

      return {
        success: true,
        recommended_selectors: response.data.recommended_selectors || [],
        analysis: response.data.analysis,
        confidence: response.data.confidence
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Claude fallback request failed'
      };
    }
  }
}



