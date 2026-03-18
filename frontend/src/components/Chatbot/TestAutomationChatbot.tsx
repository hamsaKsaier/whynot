import React, { useState, useEffect, useRef } from 'react';
import {
  createChatSession,
  sendChatMessage,
  modifyTestFromChat,
  type ChatMessage,
  type ChatContext,
  type ChatResponse
} from '../../services/chatbot-api';

interface TestAutomationChatbotProps {
  context?: ChatContext;
  onTestGenerated?: (testCase: any) => void;
  onTestModified?: (modifications: any) => void; // Legacy: for non-testing modifications
  onTestModificationRequested?: (modifiedTestCase: any) => void; // NEW: Request to test modification before saving
  autoOpen?: boolean;
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export const TestAutomationChatbot: React.FC<TestAutomationChatbotProps> = ({
  context,
  onTestGenerated,
  onTestModified,
  onTestModificationRequested,
  autoOpen = false,
  className = '',
  isOpen: isOpenProp,
  onClose: onCloseProp
}) => {
  const [isOpenInternal, setIsOpenInternal] = useState(autoOpen);
  const isOpen = isOpenProp !== undefined ? isOpenProp : isOpenInternal;
  const handleClose = () => {
    if (onCloseProp) onCloseProp();
    else setIsOpenInternal(false);
  };
  const setOpen = (open: boolean) => {
    if (open && onCloseProp === undefined) setIsOpenInternal(true);
    else if (!open) handleClose();
  };
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Initialize session when component mounts or context changes
  useEffect(() => {
    if (isOpen && !sessionId && !isInitializing) {
      initializeSession();
    }
  }, [isOpen, context]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeSession = async () => {
    setIsInitializing(true);
    try {
      const session = await createChatSession(context);
      // API returns session.id (not session.session_id)
      const newSessionId = (session.id || session.session_id) ?? null;
      setSessionId(newSessionId);
      sessionIdRef.current = newSessionId;
      if (session.messages) {
        setMessages(session.messages);
      } else {
        // Add welcome message
        setMessages([{
          role: 'assistant',
          content: 'Hello! I\'m your test automation assistant. How can I help you today?\n\nI can:\n• Generate new test cases\n• Modify existing tests\n• Debug test failures\n• Answer questions about test automation\n• Configure test settings',
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error: any) {
      console.error('Failed to initialize chat session:', error);
      setMessages([{
        role: 'assistant',
        content: 'Sorry, I couldn\'t initialize the chat session. Please try again.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Ensure session is initialized before sending
    if (!sessionId && !isInitializing) {
      await initializeSession();
      return; // Will retry after session is created
    }

    if (!sessionId) {
      // Still initializing, wait a bit and try again
      setTimeout(() => handleSend(), 200);
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    const messageContent = input.trim();
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response: ChatResponse = await sendChatMessage(sessionId, messageContent, context);

      if (response.success) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.message,
          timestamp: new Date().toISOString(),
          metadata: {
            intent: response.intent,
            actions: response.actions,
            confidence: response.confidence
          }
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Handle generated test
        if (response.generated_test && onTestGenerated) {
          onTestGenerated(response.generated_test);
        }

        // Handle modifications - check if user wants to modify test
        if (response.intent === 'modify_test' && context?.test_case) {
          // User wants to modify - call modifyTestFromChat API
          try {
            setIsLoading(true);
            const modifiedTestCase = await modifyTestFromChat(
              context.test_case,
              messageContent,
              context.step_index,
              context.step
            );

            // Add message explaining what will happen
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: 'I\'ve prepared the modifications. Testing them now to ensure they work...',
              timestamp: new Date().toISOString()
            }]);

            // Request parent to test this modification (test-before-commit)
            if (onTestModificationRequested) {
              onTestModificationRequested(modifiedTestCase);
            } else if (onTestModified) {
              // Fallback: if no test handler, use direct modification (legacy)
              onTestModified(modifiedTestCase);
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'I\'ve modified the test case. The changes have been applied.',
                timestamp: new Date().toISOString()
              }]);
            }
          } catch (error: any) {
            console.error('Failed to modify test case:', error);
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `Failed to modify test case: ${error.message || 'Unknown error'}`,
              timestamp: new Date().toISOString()
            }]);
          } finally {
            setIsLoading(false);
          }
        } else if (response.modifications && onTestModified) {
          // Legacy: handle modifications from response (non-testing flow)
          onTestModified(response.modifications);
        }
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.error || 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I couldn\'t process your message. Please try again.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Get step-aware quick actions if opened from step context
  const getQuickActions = () => {
    if (context?.step_index !== undefined && context?.step) {
      return [
        { label: 'Change Selector', action: 'Change the selector for this step' },
        { label: 'Delete Step', action: 'Delete this step' },
        { label: 'Add Step After', action: 'Add a step after this one' },
        { label: 'Modify Step', action: 'Modify this step' }
      ];
    }
    return [
      { label: 'Generate Test', action: 'Create a new test case for me' },
      { label: 'Modify Test', action: 'Help me modify this test' },
      { label: 'Debug Failure', action: 'Why did this test fail?' },
      { label: 'Ask Question', action: 'How does this work?' }
    ];
  };

  const quickActions = getQuickActions();

  const handleQuickAction = async (action: string) => {
    setInput(action);

    // Ensure session is initialized before sending
    if (!sessionIdRef.current && !isInitializing) {
      await initializeSession();
    }

    // Wait for session to be ready, then auto-send
    const attemptSend = async (retries = 0) => {
      const currentSessionId = sessionIdRef.current;

      if (!currentSessionId) {
        if (retries < 10) {
          setTimeout(() => attemptSend(retries + 1), 200);
          return;
        } else {
          // Fallback: set input and let handleSend handle it
          setInput(action);
          setTimeout(() => handleSend(), 100);
          return;
        }
      }

      const userMessage: ChatMessage = {
        role: 'user',
        content: action.trim(),
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);

      try {
        const response: ChatResponse = await sendChatMessage(currentSessionId, action.trim(), context);

        if (response.success) {
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: response.message,
            timestamp: new Date().toISOString(),
            metadata: {
              intent: response.intent,
              actions: response.actions,
              confidence: response.confidence
            }
          };
          setMessages(prev => [...prev, assistantMessage]);

          if (response.generated_test && onTestGenerated) {
            onTestGenerated(response.generated_test);
          }

          if (response.modifications && onTestModified) {
            onTestModified(response.modifications);
          }
        } else {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: response.error || 'Sorry, I encountered an error. Please try again.',
            timestamp: new Date().toISOString()
          }]);
        }
      } catch (error: any) {
        console.error('Failed to send message:', error);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I couldn\'t process your message. Please try again.',
          timestamp: new Date().toISOString()
        }]);
      } finally {
        setIsLoading(false);
      }
    };

    // Start sending after a short delay to allow state updates
    setTimeout(() => attemptSend(), 300);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-4 right-4 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors ${className}`}
        title="Open AI Assistant"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
        <div>
          <h3 className="font-semibold">AI Test Assistant</h3>
          {context?.test_case_id && (
            <p className="text-xs text-blue-100">Test Case Context</p>
          )}
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-white hover:text-gray-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isInitializing ? (
          <div className="text-center text-gray-500">Initializing chat...</div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                  }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.metadata?.actions && msg.metadata.actions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.metadata.actions.map((action: any, actionIdx: number) => (
                      <button
                        key={actionIdx}
                        className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded"
                        onClick={() => {
                          // Handle action
                        }}
                      >
                        {action.label || action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <div className="text-xs text-gray-500 mb-2">Quick Actions:</div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((qa, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickAction(qa.action)}
                className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
              >
                {qa.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading || isInitializing || !sessionId}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {(() => {
              if (isLoading) return 'Sending...';
              if (!input.trim() && (isInitializing || !sessionId)) return 'Initializing...';
              return 'Send';
            })()}
          </button>
        </div>
      </div>
    </div>
  );
};
