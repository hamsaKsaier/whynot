import axios from 'axios';
import type { TestStep } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010/api';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  metadata?: any;
}

export interface ChatSession {
  id: string; // API returns 'id', not 'session_id'
  session_id?: string; // For backwards compatibility
  test_case_id?: string;
  step_id?: string;
  execution_id?: string;
  context?: any;
  messages?: ChatMessage[];
  created_at?: string;
  updated_at?: string;
}

export interface ChatResponse {
  success: boolean;
  session_id: string;
  message: string;
  intent?: string;
  actions?: any[];
  generated_test?: any;
  modifications?: any;
  confidence?: number;
  error?: string;
}

export interface ChatContext {
  test_case_id?: string;
  step_id?: string;
  execution_id?: string;
  test_case?: any;
  execution_result?: any;
  failure_analysis?: any;
  page_state?: any;
  step_index?: number; // Position of step in test case
  step?: TestStep; // Full step object
  operation?: 'fix' | 'edit' | 'modify'; // Intent when opening
}

/**
 * Create a new chat session
 */
export async function createChatSession(context?: ChatContext): Promise<ChatSession> {
  const response = await axios.post(`${API_URL}/chat/session`, {
    test_case_id: context?.test_case_id,
    step_id: context?.step_id,
    execution_id: context?.execution_id,
    context: context
  });
  return response.data.session;
}

/**
 * Send a message in a chat session
 */
export async function sendChatMessage(
  sessionId: string,
  message: string,
  context?: ChatContext
): Promise<ChatResponse> {
  const response = await axios.post(`${API_URL}/chat/message`, {
    session_id: sessionId,
    message: message,
    context: context
  });
  return response.data;
}

/**
 * Get chat session with message history
 */
export async function getChatSession(sessionId: string): Promise<ChatSession> {
  const response = await axios.get(`${API_URL}/chat/session/${sessionId}`);
  return response.data.session;
}

/**
 * Generate test case from conversation
 */
export async function generateTestFromChat(
  conversation: ChatMessage[],
  userStory?: string
): Promise<any> {
  const response = await axios.post(`${API_URL}/chat/generate-test`, {
    conversation: conversation,
    user_story: userStory
  });
  return response.data.test_case;
}

/**
 * Modify test case based on chat
 */
export async function modifyTestFromChat(
  testCase: any,
  userRequest: string,
  stepIndex?: number,
  step?: TestStep
): Promise<any> {
  const response = await axios.post(`${API_URL}/chat/modify-test`, {
    test_case: testCase,
    user_request: userRequest,
    step_index: stepIndex,
    step: step
  });
  // Return full test case if available, otherwise modifications
  return response.data.test_case || response.data.modifications;
}


