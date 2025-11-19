"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useVerificationAnalytics,
  useGradeDetail,
} from "@/lib/hooks/useVerificationAnalytics";
import {
  BarChart3,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Download,
  Eye,
  X,
} from "lucide-react";

/**
 * Internal developer dashboard for viewing verification analytics
 * NEVER shown to end users - this is for prompt engineering and quality monitoring
 */

// Hook for health data
function useVerificationHealth() {
  return useQuery({
    queryKey: ["verification-health"],
    queryFn: async () => {
      const response = await fetch("/api/verification/health");
      if (!response.ok) throw new Error("Failed to fetch health");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export default function VerificationDashboard() {
  const [selectedAuditId, setSelectedAuditId] = useState<string | undefined>();

  const { data: analytics, isLoading, error } = useVerificationAnalytics({});
  const { data: health } = useVerificationHealth();
  const { data: gradeDetail } = useGradeDetail(selectedAuditId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" />
          <p>Failed to load analytics</p>
        </div>
      </div>
    );
  }

  const avgScores = analytics?.averageScores;
  const hasData = analytics && analytics.totalGraded > 0;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Translation Verification Analytics
          </h1>
          <p className="text-gray-600">
            Internal quality monitoring for AI-generated translations
          </p>
        </div>

        {/* Warning banner */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-medium">
              Internal Use Only: This data is never shown to end users
            </p>
          </div>
        </div>

        {/* Health Status */}
        {health && (
          <div
            className={`mb-6 p-4 rounded-lg border-2 ${
              health.status === "healthy"
                ? "bg-green-50 border-green-200"
                : health.status === "degraded"
                ? "bg-yellow-50 border-yellow-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    health.status === "healthy"
                      ? "bg-green-500 animate-pulse"
                      : health.status === "degraded"
                      ? "bg-yellow-500 animate-pulse"
                      : "bg-red-500 animate-pulse"
                  }`}
                />
                <div>
                  <h3 className="font-semibold text-gray-900">
                    System Status:{" "}
                    <span className="capitalize">{health.status}</span>
                  </h3>
                  <p className="text-sm text-gray-600">
                    Last 15min: {health.metrics.last15min.total} operations,{" "}
                    {health.metrics.last15min.successRate.toFixed(1)}% success
                    rate, {health.metrics.last15min.avgDuration}ms avg latency
                  </p>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Updated {new Date(health.timestamp).toLocaleTimeString()}
              </div>
            </div>

            {/* Feature flags status */}
            <div className="mt-3 flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Track A (Internal):</span>
                <span
                  className={`px-2 py-0.5 rounded ${
                    health.features.trackA
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {health.features.trackA ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Track B (Context):</span>
                <span
                  className={`px-2 py-0.5 rounded ${
                    health.features.trackB
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {health.features.trackB ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
        )}

        {!hasData ? (
          /* No data state */
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No verification data yet
            </h2>
            <p className="text-gray-600">
              Complete some translations with verification enabled to see
              analytics
            </p>
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatCard
                title="Lines Graded"
                value={analytics.totalGraded.toString()}
                icon={<CheckCircle className="w-6 h-6 text-green-600" />}
              />
              <StatCard
                title="Average Overall Score"
                value={avgScores?.overall.toFixed(1) || "N/A"}
                subtitle="out of 10"
                icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
                color={
                  avgScores && avgScores.overall >= 7
                    ? "green"
                    : avgScores && avgScores.overall >= 5
                    ? "yellow"
                    : "red"
                }
              />
              <StatCard
                title="Low Score Lines"
                value={analytics.lowScoreLines.length.toString()}
                subtitle="below 6/10"
                icon={<AlertCircle className="w-6 h-6 text-red-600" />}
                color="red"
              />
            </div>

            {/* Dimension Scores */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">
                Score Breakdown by Dimension
              </h2>
              <div className="space-y-4">
                {avgScores &&
                  Object.entries(avgScores)
                    .filter(([key]) => key !== "overall")
                    .map(([dimension, score]) => (
                      <DimensionBar
                        key={dimension}
                        dimension={dimension.replace(/_/g, " ")}
                        score={score}
                      />
                    ))}
              </div>
            </div>

            {/* Score Distribution Chart */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Score Distribution</h2>
              <div className="flex items-end justify-between h-64 gap-2">
                {analytics.scoreDistribution &&
                  Object.entries(analytics.scoreDistribution).map(
                    ([score, count]) => {
                      const maxCount = Math.max(
                        ...Object.values(analytics.scoreDistribution!)
                      );
                      const heightPercent =
                        maxCount > 0 ? (count / maxCount) * 100 : 0;

                      return (
                        <div
                          key={score}
                          className="flex-1 flex flex-col items-center"
                        >
                          <div className="w-full flex flex-col justify-end h-full">
                            <div
                              className="bg-blue-500 rounded-t"
                              style={{ height: `${heightPercent}%` }}
                              title={`${count} lines with score ${score}`}
                            />
                          </div>
                          <div className="text-xs text-gray-600 mt-2">
                            {score}
                          </div>
                          <div className="text-xs text-gray-400">{count}</div>
                        </div>
                      );
                    }
                  )}
              </div>
              <div className="text-center text-sm text-gray-600 mt-4">
                Overall Score (0-10)
              </div>
            </div>

            {/* Low Score Lines Table */}
            {analytics.lowScoreLines.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  Lines Needing Attention
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Score
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Line
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Issues
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {analytics.lowScoreLines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                line.score < 4
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {line.score.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            Line {line.lineIndex}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {line.issues.slice(0, 2).join(", ")}
                            {line.issues.length > 2 && "..."}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(line.gradedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            {line.auditId && (
                              <button
                                onClick={() => {
                                  setSelectedAuditId(line.auditId);
                                }}
                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                              >
                                <Eye className="w-4 h-4" />
                                View Details
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Export Button */}
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => {
                  const dataStr = JSON.stringify(analytics, null, 2);
                  const dataBlob = new Blob([dataStr], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(dataBlob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `verification-analytics-${new Date().toISOString()}.json`;
                  link.click();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Data
              </button>
            </div>
          </>
        )}

        {/* Grade Detail Modal */}
        {gradeDetail && (
          <GradeDetailModal
            grade={gradeDetail}
            onClose={() => setSelectedAuditId(undefined)}
          />
        )}
      </div>
    </div>
  );
}

// Helper Components
function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = "blue",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color?: "blue" | "green" | "yellow" | "red";
}) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    yellow: "bg-yellow-50 border-yellow-200",
    red: "bg-red-50 border-red-200",
  };

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-6`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function DimensionBar({
  dimension,
  score,
}: {
  dimension: string;
  score: number;
}) {
  const percentage = (score / 10) * 100;
  const color =
    score >= 7 ? "bg-green-500" : score >= 5 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-700 capitalize">
          {dimension}
        </span>
        <span className="text-sm font-semibold text-gray-900">
          {score.toFixed(1)}/10
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function GradeDetailModal({
  grade,
  onClose,
}: {
  grade: any;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold">Grade Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Grade content */}
          <div className="space-y-4">
            {grade.grade && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Overall Score</h3>
                <p className="text-3xl font-bold text-blue-600">
                  {grade.grade.overall_score?.toFixed(1)}/10
                </p>
              </div>
            )}

            {grade.grade?.scores && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Dimension Scores</h3>
                <div className="space-y-2">
                  {Object.entries(grade.grade.scores).map(([dim, score]) => (
                    <DimensionBar
                      key={dim}
                      dimension={dim.replace(/_/g, " ")}
                      score={score as number}
                    />
                  ))}
                </div>
              </div>
            )}

            {grade.grade?.issues && grade.grade.issues.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Issues</h3>
                <ul className="list-disc list-inside space-y-1">
                  {grade.grade.issues.map((issue: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-700">
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {grade.grade?.strengths && grade.grade.strengths.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Strengths</h3>
                <ul className="list-disc list-inside space-y-1">
                  {grade.grade.strengths.map(
                    (strength: string, idx: number) => (
                      <li key={idx} className="text-sm text-gray-700">
                        {strength}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

            <div className="mt-4 pt-4 border-t">
              <h3 className="text-lg font-semibold mb-2">Raw Data</h3>
              <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(grade, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
