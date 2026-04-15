/**
 * ReportTab — unified QA Lead synthesis report for investor demo.
 *
 * Shows: quality score, summary, findings by agent, critical clusters,
 * and recommendations. Designed for clarity and visual impact.
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
import {
  Shield, AlertTriangle, CheckCircle, Globe,
  Zap, Target,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface CriticalCluster {
  page: string;
  issues: string[];
  priority: string;
  recommendation: string;
}

interface SynthesisReport {
  summary: string;
  quality_score: number;
  findings_by_agent: Record<string, any>;
  critical_clusters: CriticalCluster[];
  recommendations: string[];
}

function QualityBadge({ score }: { score: number }) {
  let badgeClass = 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
  let label = 'Poor';
  if (score >= 90) {
    badgeClass = 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
    label = 'Excellent';
  } else if (score >= 70) {
    badgeClass = 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800';
    label = 'Good';
  } else if (score >= 50) {
    badgeClass = 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
    label = 'Needs Work';
  }

  return (
    <Badge variant="outline" className={cn('gap-2 px-4 py-2 text-base', badgeClass)}>
      <span className="text-2xl font-bold">{score}</span>
      <span className="text-sm font-medium">{label}</span>
    </Badge>
  );
}

function AgentSection({ agentType, data }: { agentType: string; data: any }) {
  const icons: Record<string, React.ReactNode> = {
    exploratory: <Globe className="h-4 w-4 text-sky-500 dark:text-sky-400" />,
    security: <Shield className="h-4 w-4 text-red-500 dark:text-red-400" />,
    api: <Zap className="h-4 w-4 text-orange-500 dark:text-orange-400" />,
    api_tester: <Zap className="h-4 w-4 text-orange-500 dark:text-orange-400" />,
    auto: <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />,
    auto_tester: <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />,
  };

  const labels: Record<string, string> = {
    exploratory: 'Exploratory Tester',
    security: 'Security Tester',
    api: 'API Tester',
    api_tester: 'API Tester',
    auto: 'Auto Tester',
    auto_tester: 'Auto Tester',
  };

  const stats: string[] = [];
  if (data.pages) stats.push(`${data.pages} pages`);
  if (data.bugs) stats.push(`${data.bugs} bugs`);
  if (data.tests) stats.push(`${data.tests} tests`);
  if (data.endpoints) stats.push(`${data.endpoints} endpoints`);
  if (data.vulnerabilities) stats.push(`${data.vulnerabilities} vulnerabilities`);
  if (data.headers_missing) stats.push(`${data.headers_missing} missing headers`);
  if (data.errors) stats.push(`${data.errors} errors`);
  if (data.tests_generated) stats.push(`${data.tests_generated} tests`);
  if (data.tests_passed) stats.push(`${data.tests_passed} passed`);
  if (data.tests_failed) stats.push(`${data.tests_failed} failed`);

  return {
    agentType,
    icon: icons[agentType] || <Target className="h-4 w-4 text-muted-foreground" />,
    label: labels[agentType] || agentType,
    statsText: stats.join(' \u00B7 '),
    description: data.description,
  };
}

function ClusterCard({ cluster }: { cluster: CriticalCluster }) {
  const priorityClass: Record<string, string> = {
    critical: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30',
    high: 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30',
    medium: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30',
    low: 'border-border bg-muted/30',
  };

  return (
    <Card className={cn('p-4', priorityClass[cluster.priority] || priorityClass.medium)}>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className={cn('h-4 w-4', cluster.priority === 'critical' ? 'text-red-500 dark:text-red-400' : 'text-orange-500 dark:text-orange-400')} />
        <span className="text-sm font-medium text-foreground">{cluster.page}</span>
        <Badge
          variant="outline"
          className={cn(
            'text-xs uppercase font-bold',
            cluster.priority === 'critical'
              ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
              : 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'
          )}
        >
          {cluster.priority}
        </Badge>
      </div>
      <ul className="space-y-1 mb-2">
        {cluster.issues.map((issue, i) => (
          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
            <span className="text-red-500 dark:text-red-400 mt-0.5">{'\u2022'}</span>
            {issue}
          </li>
        ))}
      </ul>
      <p className="text-xs text-sky-600 dark:text-sky-400 italic">{cluster.recommendation}</p>
    </Card>
  );
}

interface ReportTabProps {
  report: SynthesisReport | null;
}

export const ReportTab: React.FC<ReportTabProps> = ({ report }) => {
  if (!report) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Target className="w-8 h-8 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Report will appear after the scan completes.</p>
      </div>
    );
  }

  const agentSections = report.findings_by_agent
    ? Object.entries(report.findings_by_agent).map(([agent, data]) => AgentSection({ agentType: agent, data }))
    : [];

  return (
    <div className="space-y-6">
      {/* Summary + Quality Score */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground mb-1">Scan Report</h3>
          <p className="text-sm text-muted-foreground">{report.summary}</p>
        </div>
        <QualityBadge score={report.quality_score} />
      </div>

      {/* Findings by Agent */}
      {agentSections.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Findings by Agent</h4>
          <Accordion type="multiple">
            {agentSections.map((section) => (
              <AccordionItem key={section.agentType} value={section.agentType}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 flex-1">
                    {section.icon}
                    <span className="font-medium text-foreground">{section.label}</span>
                    <span className="text-xs text-muted-foreground ms-auto me-2">{section.statsText}</span>
                  </div>
                </AccordionTrigger>
                {section.description && (
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </AccordionContent>
                )}
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      <Separator />

      {/* Critical Clusters */}
      {report.critical_clusters && report.critical_clusters.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
            Critical Areas ({report.critical_clusters.length})
          </h4>
          <div className="space-y-3">
            {report.critical_clusters.map((cluster, i) => (
              <ClusterCard key={i} cluster={cluster} />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations && report.recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Recommendations</h4>
          <ul className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-sky-500 dark:text-sky-400 mt-0.5 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
