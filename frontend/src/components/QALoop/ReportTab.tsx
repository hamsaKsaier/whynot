/**
 * ReportTab — unified QA Lead synthesis report for investor demo.
 *
 * Shows: quality score, summary, findings by agent, critical clusters,
 * and recommendations. Designed for clarity and visual impact.
 */
import React, { useState } from 'react';
import {
  FiShield, FiAlertTriangle, FiCheckCircle, FiGlobe,
  FiChevronDown, FiChevronUp, FiZap, FiTarget,
} from 'react-icons/fi';

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
  let color = 'bg-red-900/60 text-red-300 border-red-700/40';
  let label = 'Poor';
  if (score >= 90) { color = 'bg-green-900/60 text-green-300 border-green-700/40'; label = 'Excellent'; }
  else if (score >= 70) { color = 'bg-sky-900/60 text-sky-300 border-sky-700/40'; label = 'Good'; }
  else if (score >= 50) { color = 'bg-yellow-900/60 text-yellow-300 border-yellow-700/40'; label = 'Needs Work'; }

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${color}`}>
      <span className="text-2xl font-bold">{score}</span>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

function AgentSection({ agentType, data }: { agentType: string; data: any }) {
  const [expanded, setExpanded] = useState(false);

  const icons: Record<string, React.ReactNode> = {
    exploratory: <FiGlobe className="text-sky-400" />,
    security: <FiShield className="text-red-400" />,
    api: <FiZap className="text-orange-400" />,
    api_tester: <FiZap className="text-orange-400" />,
    auto: <FiCheckCircle className="text-green-400" />,
    auto_tester: <FiCheckCircle className="text-green-400" />,
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

  return (
    <div className="border border-slate-700/40 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800/60 hover:bg-slate-800 transition-colors text-left"
      >
        <span className="text-lg">{icons[agentType] || <FiTarget />}</span>
        <span className="font-medium text-gray-200 flex-1">{labels[agentType] || agentType}</span>
        <span className="text-xs text-slate-400">{stats.join(' \u00B7 ')}</span>
        {expanded ? <FiChevronUp className="text-slate-400" /> : <FiChevronDown className="text-slate-400" />}
      </button>
      {expanded && data.description && (
        <div className="px-4 py-3 text-sm text-slate-300 bg-slate-900/40 border-t border-slate-700/30">
          {data.description}
        </div>
      )}
    </div>
  );
}

function ClusterCard({ cluster }: { cluster: CriticalCluster }) {
  const priorityColor: Record<string, string> = {
    critical: 'border-red-500/60 bg-red-950/30',
    high: 'border-orange-500/60 bg-orange-950/30',
    medium: 'border-yellow-500/60 bg-yellow-950/30',
    low: 'border-slate-600/60 bg-slate-900/30',
  };

  return (
    <div className={`rounded-lg border p-4 ${priorityColor[cluster.priority] || priorityColor.medium}`}>
      <div className="flex items-center gap-2 mb-2">
        <FiAlertTriangle className={cluster.priority === 'critical' ? 'text-red-400' : 'text-orange-400'} />
        <span className="text-sm font-medium text-gray-200">{cluster.page}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full uppercase font-bold ${
          cluster.priority === 'critical' ? 'bg-red-900/60 text-red-300' : 'bg-orange-900/60 text-orange-300'
        }`}>{cluster.priority}</span>
      </div>
      <ul className="space-y-1 mb-2">
        {cluster.issues.map((issue, i) => (
          <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
            <span className="text-red-400 mt-0.5">\u2022</span>
            {issue}
          </li>
        ))}
      </ul>
      <p className="text-xs text-sky-400 italic">{cluster.recommendation}</p>
    </div>
  );
}

interface ReportTabProps {
  report: SynthesisReport | null;
}

export const ReportTab: React.FC<ReportTabProps> = ({ report }) => {
  if (!report) {
    return (
      <div className="text-center py-12 text-slate-400">
        <FiTarget className="w-8 h-8 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Report will appear after the scan completes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary + Quality Score */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-100 mb-1">Scan Report</h3>
          <p className="text-sm text-slate-300">{report.summary}</p>
        </div>
        <QualityBadge score={report.quality_score} />
      </div>

      {/* Findings by Agent */}
      {report.findings_by_agent && Object.keys(report.findings_by_agent).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Findings by Agent</h4>
          <div className="space-y-2">
            {Object.entries(report.findings_by_agent).map(([agent, data]) => (
              <AgentSection key={agent} agentType={agent} data={data} />
            ))}
          </div>
        </div>
      )}

      {/* Critical Clusters */}
      {report.critical_clusters && report.critical_clusters.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <FiAlertTriangle className="text-red-400" />
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
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Recommendations</h4>
          <ul className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <FiCheckCircle className="text-sky-400 mt-0.5 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
