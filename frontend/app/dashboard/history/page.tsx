"use client";

import { useEffect, useState } from "react";
import { getCallHistory, deleteCall } from "@/app/actions/call";
import { Phone, Clock, CheckCircle, XCircle, AlertCircle, Trash2, RefreshCw } from "lucide-react";

type Call = {
  id: string;
  phoneNumber: string;
  direction: string;
  amdStrategy: string;
  status: string;
  amdResult: string | null;
  confidence: number | null;
  duration: number | null;
  amdDuration: number | null;
  twilioSid: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: any;
};

export default function CallHistoryPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const limit = 10;
  const totalPages = Math.ceil(total / limit);

  const fetchCalls = async () => {
    setLoading(true);
    setError(null);
    
    const result = await getCallHistory(page, limit);
    
    if (result.error) {
      setError(result.error);
    } else if (result.calls) {
      setCalls(result.calls);
      setTotal(result.total || 0);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchCalls();
  }, [page]);

  const handleDelete = async (callId: string) => {
    if (!confirm("Are you sure you want to delete this call record?")) {
      return;
    }

    setDeletingId(callId);
    const result = await deleteCall(callId);
    
    if (result.error) {
      alert(result.error);
    } else {
      await fetchCalls();
    }
    
    setDeletingId(null);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: any }> = {
      completed: { color: "bg-green-100 text-green-800", icon: CheckCircle },
      failed: { color: "bg-red-100 text-red-800", icon: XCircle },
      busy: { color: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
      "no-answer": { color: "bg-gray-100 text-gray-800", icon: AlertCircle },
      initiated: { color: "bg-blue-100 text-blue-800", icon: Clock },
      ringing: { color: "bg-blue-100 text-blue-800", icon: Phone },
    };

    const config = statusConfig[status] || { color: "bg-gray-100 text-gray-800", icon: AlertCircle };
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };

  const getAmdBadge = (result: string | null, confidence: number | null) => {
    if (!result) {
      return <span className="text-gray-400 text-sm">Pending</span>;
    }

    const amdConfig: Record<string, { color: string; label: string }> = {
      human: { color: "bg-green-100 text-green-800", label: "Human" },
      machine: { color: "bg-red-100 text-red-800", label: "Machine" },
      unknown: { color: "bg-gray-100 text-gray-800", label: "Unknown" },
      fax: { color: "bg-purple-100 text-purple-800", label: "Fax" },
    };

    const config = amdConfig[result] || { color: "bg-gray-100 text-gray-800", label: result };
    const confidencePercent = confidence ? (confidence * 100).toFixed(0) : "N/A";

    return (
      <div className="flex flex-col gap-1">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
          {config.label}
        </span>
        {confidence && (
          <span className="text-xs text-gray-500">{confidencePercent}% confident</span>
        )}
      </div>
    );
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Call History</h1>
            <p className="text-gray-600 mt-1">View and manage your call records</p>
          </div>
          <button
            onClick={fetchCalls}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-sm text-gray-600 mb-1">Total Calls</div>
            <div className="text-3xl font-bold text-gray-900">{total}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-sm text-gray-600 mb-1">Current Page</div>
            <div className="text-3xl font-bold text-gray-900">{page} / {totalPages || 1}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-sm text-gray-600 mb-1">Records per Page</div>
            <div className="text-3xl font-bold text-gray-900">{limit}</div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading call history...</p>
          </div>
        ) : calls.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Phone className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No calls yet</h3>
            <p className="text-gray-600 mb-6">Start making calls to see your history here</p>
            <a
              href="/dashboard"
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Make a Call
            </a>
          </div>
        ) : (
          <>
            {/* Call List */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        AMD Strategy
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        AMD Result
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {calls.map((call) => (
                      <tr key={call.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Phone className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm font-medium text-gray-900">
                              {call.phoneNumber}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            {call.amdStrategy}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(call.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getAmdBadge(call.amdResult, call.confidence)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex flex-col gap-1">
                            <span>Call: {formatDuration(call.duration)}</span>
                            {call.amdDuration && (
                              <span className="text-xs text-gray-500">
                                AMD: {call.amdDuration}ms
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(call.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleDelete(call.id)}
                            disabled={deletingId === call.id}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete call"
                          >
                            {deletingId === call.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <span className="text-sm text-gray-700">
                  Page {page} of {totalPages}
                </span>
                
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}