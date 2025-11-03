"use client";

import { useEffect, useState } from "react";
import { getTestResults } from "@/app/actions/call";

type Summary = {
  totalCalls: number;
  byStrategy: Record<string, number>;
  byResult: Record<string, number>;
  averageConfidence: Record<string, number>;
  averageDuration: Record<string, number>;
  successRate: Record<string, number>;
};

type DetailedCall = {
  id: string;
  phoneNumber: string;
  amdResult: string | null;
  confidence: number | null;
  duration: number | null;
  amdDuration: number | null;
  createdAt: Date;
};

type DetailedResult = {
  strategy: string;
  calls: DetailedCall[];
};

export default function TestResultsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [detailedResults, setDetailedResults] = useState<DetailedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  const fetchResults = async () => {
    setLoading(true);
    setError(null);

    const result = await getTestResults();

    if (result.error) {
      setError(result.error);
    } else if (result.summary && result.detailedResults) {
      setSummary(result.summary);
      setDetailedResults(result.detailedResults);
      if (result.detailedResults.length > 0 && !selectedStrategy) {
        setSelectedStrategy(result.detailedResults[0].strategy);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const strategyColors: Record<string, string> = {
    twilio: "bg-blue-500",
    gemini: "bg-purple-500",
    huggingface: "bg-green-500",
    jambonz: "bg-orange-500",
  };

  const strategyEmojis: Record<string, string> = {
    twilio: "📞",
    gemini: "🤖",
    huggingface: "🧠",
    jambonz: "🔊",
  };

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatConfidence = (value: number) => `${(value * 100).toFixed(0)}%`;
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(0);
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4 animate-spin inline-block">⏳</div>
            <p className="text-gray-600">Loading test results...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!summary || summary.totalCalls === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No test data yet</h3>
            <p className="text-gray-600 mb-6">Make some calls to see AMD comparison results</p>
            <a
              href="/dashboard"
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Start Testing
            </a>
          </div>
        </div>
      </div>
    );
  }

  const strategies = Object.keys(summary.byStrategy);
  const selectedData = detailedResults.find((d) => d.strategy === selectedStrategy);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📊 Test Results & Comparison</h1>
            <p className="text-gray-600 mt-1">Compare AMD strategy performance</p>
          </div>
          <button
            onClick={fetchResults}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <span className={loading ? "inline-block animate-spin" : ""}>🔄</span>
            Refresh
          </button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-sm text-gray-600 mb-1">Total Tests</div>
            <div className="text-3xl font-bold text-gray-900">{summary.totalCalls}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-sm text-gray-600 mb-1">Strategies Tested</div>
            <div className="text-3xl font-bold text-gray-900">{strategies.length}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-sm text-gray-600 mb-1">Human Detected</div>
            <div className="text-3xl font-bold text-green-600">{summary.byResult.human || 0}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-sm text-gray-600 mb-1">Machine Detected</div>
            <div className="text-3xl font-bold text-red-600">{summary.byResult.machine || 0}</div>
          </div>
        </div>

        {/* Strategy Comparison Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Strategy Comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Strategy
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Calls
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Human Detection Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Confidence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Performance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {strategies.map((strategy) => {
                  const successRate = summary.successRate[strategy] || 0;
                  const confidence = summary.averageConfidence[strategy] || 0;
                  const duration = summary.averageDuration[strategy] || 0;
                  const callCount = summary.byStrategy[strategy] || 0;

                  return (
                    <tr
                      key={strategy}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedStrategy(strategy)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{strategyEmojis[strategy]}</span>
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {strategy}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {callCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                            <div
                              className={`h-2 rounded-full ${strategyColors[strategy]}`}
                              style={{ width: `${successRate}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-900">{formatPercent(successRate)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {confidence > 0 ? formatConfidence(confidence) : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {duration > 0 ? formatDuration(duration) : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {successRate >= 80 && confidence >= 0.8 ? (
                          <span className="text-green-600">⭐ Excellent</span>
                        ) : successRate >= 60 && confidence >= 0.7 ? (
                          <span className="text-blue-600">✓ Good</span>
                        ) : successRate >= 40 ? (
                          <span className="text-yellow-600">⚠ Fair</span>
                        ) : (
                          <span className="text-red-600">✗ Poor</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Results by Strategy */}
        {selectedData && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-2xl">{strategyEmojis[selectedStrategy!]}</span>
                Detailed Results: {selectedStrategy?.toUpperCase()}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Result
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Confidence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      AMD Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedData.calls.map((call) => (
                    <tr key={call.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {call.phoneNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {call.amdResult === "human" ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ Human
                          </span>
                        ) : call.amdResult === "machine" ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            ✗ Machine
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            ? Unknown
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {call.confidence ? formatConfidence(call.confidence) : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {call.duration ? formatDuration(call.duration) : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {call.amdDuration ? `${call.amdDuration}ms` : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(call.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">💡 Recommendations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategies.map((strategy) => {
              const successRate = summary.successRate[strategy] || 0;
              const confidence = summary.averageConfidence[strategy] || 0;
              const rating = successRate >= 80 && confidence >= 0.8 ? "excellent" : 
                            successRate >= 60 && confidence >= 0.7 ? "good" : 
                            successRate >= 40 ? "fair" : "poor";
              
              return (
                <div key={strategy} className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{strategyEmojis[strategy]}</span>
                    <span className="font-semibold text-gray-900 capitalize">{strategy}</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {rating === "excellent" && "✓ Best choice for production. High accuracy and reliability."}
                    {rating === "good" && "✓ Reliable for most use cases. Good balance of speed and accuracy."}
                    {rating === "fair" && "⚠ May need tuning. Consider testing with more calls."}
                    {rating === "poor" && "✗ Needs improvement. Review configuration and test conditions."}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}