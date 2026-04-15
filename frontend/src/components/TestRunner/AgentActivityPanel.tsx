import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('runner');
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
        return <FiAlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getBgColor = (type: AgentMessage['type']) => {
    switch (type) {
      case 'analyzing':
        return 'bg-blue-900/20 border-blue-800';
      case 'recovery_attempt':
        return 'bg-yellow-900/20 border-yellow-800';
      case 'recovery_success':
        return 'bg-green-900/20 border-green-800';
      case 'recovery_failed':
        return 'bg-red-900/20 border-red-800';
      case 'needs_help':
        return 'bg-sky-900/20 border-sky-800';
      default:
        return 'bg-muted border-border';
    }
  };

  if (displayMessages.length === 0) {
    return (
      <div className="h-full bg-card border-t border-border p-3 sm:p-4">
        <h3 className="font-semibold text-foreground text-sm sm:text-base mb-3 sm:mb-4">{t('runner.agent.title')}</h3>
        <EmptyState
          icon={<FiMessageCircle />}
          title={t('runner.agent.noActivity')}
          description={t('runner.agent.noActivityDesc')}
          tip={t('runner.agent.noActivityTip')}
          className="py-8"
        />
      </div>
    );
  }

  return (
    <div className="h-full bg-card border-t border-border flex flex-col">
      <div className="p-3 sm:p-4 border-b border-border">
        <h3 className="font-semibold text-foreground text-sm sm:text-base">{t('runner.agent.title')}</h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
          {t('runner.agent.subtitle')}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3">
        {displayMessages.map((message, index) => (
          <div
            key={index}
            className={`p-2.5 sm:p-3 rounded-lg border ${getBgColor(message.type)} transition-colors duration-150`}
          >
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(message.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs sm:text-sm text-foreground whitespace-pre-wrap break-words">
                  {message.message}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  {t('runner.agent.step', { step: message.stepIndex + 1 })} • {new Date(message.timestamp).toLocaleTimeString()}
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





