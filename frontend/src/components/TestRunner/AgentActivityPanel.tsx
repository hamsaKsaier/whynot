import React, { useEffect, useRef } from 'react';
import { FiLoader, FiCheckCircle, FiXCircle, FiAlertCircle, FiMessageCircle } from 'react-icons/fi';
import { EmptyState } from '../common/EmptyState';

export interface AgentMessage {
  stepIndex: number;
  type: 'analyzing' | 'recovery_attempt' | 'recovery_success' | 'recovery_failed' | 'needs_help';
  message: string;
  data?: any;
  timestamp: number;
}

interface AgentActivityPanelProps {
  messages: AgentMessage[];
  currentStepIndex?: number;
}

export const AgentActivityPanel: React.FC<AgentActivityPanelProps> = ({
  messages,
  currentStepIndex
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Filter messages for current step or show all
  const displayMessages = currentStepIndex !== undefined
    ? messages.filter(m => m.stepIndex === currentStepIndex)
    : messages;

  const getIcon = (type: AgentMessage['type']) => {
    switch (type) {
      case 'analyzing':
        return <FiLoader className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'recovery_attempt':
        return <FiLoader className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'recovery_success':
        return <FiCheckCircle className="h-4 w-4 text-green-500" />;
      case 'recovery_failed':
        return <FiXCircle className="h-4 w-4 text-red-500" />;
      case 'needs_help':
        return <FiMessageCircle className="h-4 w-4 text-sky-500" />;
      default:
        return <FiAlertCircle className="h-4 w-4 text-slate-400" />;
    }
  };

  const getBgColor = (type: AgentMessage['type']) => {
    switch (type) {
      case 'analyzing':
        return 'bg-blue-50 border-blue-200';
      case 'recovery_attempt':
        return 'bg-yellow-50 border-yellow-200';
      case 'recovery_success':
        return 'bg-green-50 border-green-200';
      case 'recovery_failed':
        return 'bg-red-50 border-red-200';
      case 'needs_help':
        return 'bg-sky-50 border-sky-200';
      default:
        return 'bg-slate-900 border-slate-700';
    }
  };

  if (displayMessages.length === 0) {
    return (
      <div className="h-full bg-slate-800 border-t border-slate-700 p-4">
        <h3 className="font-semibold text-white mb-4">Agent Activity</h3>
        <EmptyState
          icon={<FiMessageCircle />}
          title="No agent activity yet"
          description="The agent will show real-time analysis and recovery attempts here during test execution"
          tip="Tip: Start a test execution to see the agent in action"
          className="py-8"
        />
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-800 border-t border-slate-700 flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <h3 className="font-semibold text-white">Agent Activity</h3>
        <p className="text-xs text-slate-400 mt-1">
          Real-time analysis and recovery attempts
        </p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {displayMessages.map((message, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border ${getBgColor(message.type)} transition-all`}
          >
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(message.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white whitespace-pre-wrap">
                  {message.message}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Step {message.stepIndex + 1} • {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};





