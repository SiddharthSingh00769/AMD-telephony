"use client";

import { useState, useEffect, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { dialAction, getCallStatus } from "@/app/actions/call";

type AMD_STRATEGY = "twilio" | "jambonz" | "huggingface" | "gemini";

type CallStatus = {
  status: string;
  amdResult?: string | null;
  message?: string;
  confidence?: number | null;
};

function DialButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg"
    >
      {pending ? (
        <span className="flex items-center justify-center">
          <svg
            className="animate-spin h-6 w-6 mr-3"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Dialing...
        </span>
      ) : (
        "📞 Dial Now"
      )}
    </button>
  );
}

export default function DashboardPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [amdStrategy, setAmdStrategy] = useState<AMD_STRATEGY>("twilio");
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
  const [state, formAction] = useActionState(dialAction, null);

  // Helper function to get loading messages based on strategy
  const getAnalyzingMessage = (strategy: AMD_STRATEGY): string => {
    switch (strategy) {
      case "gemini":
        return "🤖 Gemini AI analyzing audio recording...";
      case "huggingface":
        return "🤗 HuggingFace ML model analyzing audio...";
      case "jambonz":
        return "📡 Jambonz SIP processing audio...";
      case "twilio":
        return "📞 Twilio AMD analyzing audio...";
      default:
        return "Analyzing recording...";
    }
  };

  const getWaitingMessage = (strategy: AMD_STRATEGY): string => {
    switch (strategy) {
      case "gemini":
        return "Waiting for Gemini AI analysis...";
      case "huggingface":
        return "Waiting for HuggingFace analysis...";
      case "jambonz":
        return "Waiting for Jambonz analysis...";
      case "twilio":
        return "Waiting for Twilio AMD result...";
      default:
        return "Processing...";
    }
  };

  // Poll for call status when call is initiated
  useEffect(() => {
    if (state?.success && state.callId) {
      console.log("✅ Call initiated, starting status polling");
      pollCallStatus(state.callId);
    }

    if (state?.error) {
      console.error("❌ Dial error:", state.error);
    }
  }, [state]);

  const pollCallStatus = async (callId: string) => {
    // Poll duration varies by strategy
    const maxAttempts = amdStrategy === "gemini" || amdStrategy === "huggingface" ? 60 : 30;
    let attempts = 0;

    const interval = setInterval(async () => {
      try {
        attempts++;

        const data = await getCallStatus(callId);

        if (data.error) {
          console.error("Status polling error:", data.error);
          clearInterval(interval);
          return;
        }

        // Dynamic status message based on selected strategy
        const statusMessage = 
          data.status === "completed" && !data.amdResult 
            ? getAnalyzingMessage(amdStrategy)
            : data.status;

        setCallStatus({
          status: statusMessage ?? "unknown",
          amdResult: data.amdResult ?? null,
          confidence: data.confidence ?? null,
          message:
            data.amdResult
              ? `AMD Result: ${data.amdResult} (${
                  data.confidence ? (data.confidence * 100).toFixed(1) + "%" : "N/A"
                })`
              : data.status === "completed"
              ? getWaitingMessage(amdStrategy)
              : "Processing...",
        });

        // Stop polling when we have an AMD result OR max attempts
        if (
          (data.status === "completed" && data.amdResult) ||
          attempts >= maxAttempts
        ) {
          clearInterval(interval);
          console.log("✅ Polling stopped:", data.amdResult ? "Got AMD result" : "Max attempts reached");
        }
      } catch (err) {
        console.error("Status polling error:", err);
        if (attempts >= maxAttempts) {
          clearInterval(interval);
        }
      }
    }, 2000); // Poll every 2 seconds
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Make a Call</h2>
        <p className="mt-1 text-sm text-gray-600">
          Dial a number and test different AMD strategies
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Dial Form - Left Column */}
        <div className="lg:col-span-2">
          <form action={formAction} className="bg-white rounded-xl shadow-md p-6 space-y-6">
            {/* Phone Number Input */}
            <div>
              <label
                htmlFor="phoneNumber"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Phone Number
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1-800-774-2678"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <p className="mt-2 text-sm text-gray-500">
                Format: +1XXXXXXXXXX or XXXXXXXXXX
              </p>
            </div>

            {/* AMD Strategy Selection */}
            <div>
              <label
                htmlFor="amdStrategy"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                AMD Detection Strategy
              </label>
              <select
                id="amdStrategy"
                name="amdStrategy"
                value={amdStrategy}
                onChange={(e) => setAmdStrategy(e.target.value as AMD_STRATEGY)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              >
                <option value="twilio">Twilio Native AMD</option>
                <option value="jambonz">Jambonz SIP-Enhanced</option>
                <option value="huggingface">Hugging Face ML Model</option>
                <option value="gemini">Google Gemini 2.5 Flash</option>
              </select>

              {/* Strategy Descriptions */}
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  {amdStrategy === "twilio" && (
                    <span>
                      <strong>Twilio Native:</strong> Built-in AMD using voice
                      frequency analysis. Fast and reliable (~85% accuracy).
                    </span>
                  )}
                  {amdStrategy === "jambonz" && (
                    <span>
                      <strong>Jambonz:</strong> SIP-based AMD with custom
                      recognizers. More configurable (~90% accuracy).
                    </span>
                  )}
                  {amdStrategy === "huggingface" && (
                    <span>
                      <strong>Hugging Face:</strong> ML model trained on
                      wav2vec. Best accuracy (~92%) but requires Python
                      service.
                    </span>
                  )}
                  {amdStrategy === "gemini" && (
                    <span>
                      <strong>Gemini:</strong> Google's multimodal AI analyzes
                      audio semantically. Good for edge cases (~88% accuracy).
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Success Message */}
            {state?.success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">
                  ✅ {state.message}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Call SID: {state.callSid}
                </p>
              </div>
            )}

            {/* Error Display */}
            {state?.error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{state.error}</p>
              </div>
            )}

            {/* Dial Button */}
            <DialButton />
          </form>
        </div>

        {/* Call Status & Test Numbers - Right Column */}
        <div className="space-y-6">
          {/* Call Status */}
          {callStatus && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Call Status
              </h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Status:
                  </span>
                  <p className="text-base text-gray-900 mt-1">
                    {callStatus.status}
                  </p>
                </div>

                {callStatus.amdResult && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">
                      AMD Result:
                    </span>
                    <p className="text-base font-semibold text-gray-900 mt-1">
                      <span
                        className={
                          callStatus.amdResult === "human"
                            ? "text-green-600"
                            : callStatus.amdResult === "machine"
                            ? "text-orange-600"
                            : "text-gray-600"
                        }
                      >
                        {callStatus.amdResult.toUpperCase()}
                      </span>
                    </p>
                  </div>
                )}

                {callStatus.confidence !== undefined && callStatus.confidence !== null && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">
                      Confidence:
                    </span>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">
                          {(callStatus.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            callStatus.confidence >= 0.8
                              ? "bg-green-600"
                              : callStatus.confidence >= 0.6
                              ? "bg-blue-600"
                              : "bg-yellow-600"
                          }`}
                          style={{
                            width: `${callStatus.confidence * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {callStatus.message && (
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      {callStatus.message}
                    </p>
                  </div>
                )}

                {/* Show analyzing indicator */}
                {callStatus.status.includes("analyzing") && (
                  <div className="pt-3 flex items-center text-blue-600">
                    <svg
                      className="animate-spin h-5 w-5 mr-2"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span className="text-sm">Processing...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Test Numbers */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📋 Test Numbers (Voicemail)
            </h3>
            <ul className="space-y-3">
              <li>
                <button
                  onClick={() => setPhoneNumber("+18007742678")}
                  type="button"
                  className="text-left w-full hover:bg-yellow-100 p-2 rounded transition"
                >
                  <div className="font-medium text-gray-900">Costco</div>
                  <div className="text-sm text-gray-600">
                    +1-800-774-2678
                  </div>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setPhoneNumber("+18008066453")}
                  type="button"
                  className="text-left w-full hover:bg-yellow-100 p-2 rounded transition"
                >
                  <div className="font-medium text-gray-900">Nike</div>
                  <div className="text-sm text-gray-600">
                    +1-800-806-6453
                  </div>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setPhoneNumber("+18882211161")}
                  type="button"
                  className="text-left w-full hover:bg-yellow-100 p-2 rounded transition"
                >
                  <div className="font-medium text-gray-900">PayPal</div>
                  <div className="text-sm text-gray-600">
                    +1-888-221-1161
                  </div>
                </button>
              </li>
            </ul>
            <p className="mt-4 text-xs text-gray-600">
              Click any number to auto-fill the form
            </p>
          </div>

          {/* Strategy Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              ℹ️ Current Strategy
            </h3>
            <div className="space-y-2">
              <p className="text-sm font-medium text-blue-900">
                {amdStrategy === "twilio" && "📞 Twilio Native AMD"}
                {amdStrategy === "jambonz" && "📡 Jambonz SIP-Enhanced"}
                {amdStrategy === "huggingface" && "🤗 HuggingFace ML Model"}
                {amdStrategy === "gemini" && "🤖 Google Gemini AI"}
              </p>
              <p className="text-xs text-blue-700">
                {amdStrategy === "twilio" && "Real-time detection during call"}
                {amdStrategy === "jambonz" && "SIP-level detection with custom rules"}
                {amdStrategy === "huggingface" && "Post-call ML analysis (~15-30s)"}
                {amdStrategy === "gemini" && "Post-call AI analysis (~20-40s)"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}