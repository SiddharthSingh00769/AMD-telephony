import { NextRequest, NextResponse } from "next/server";

/**
 * GET/POST /api/twiml/stream-ml
 * Returns TwiML to stream audio to ML models (Hugging Face or Gemini)
 */
export async function GET(request: NextRequest) {
  return handleStreamML(request);
}

export async function POST(request: NextRequest) {
  return handleStreamML(request);
}

async function handleStreamML(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const callId = searchParams.get("callId");
  const model = searchParams.get("model"); // "huggingface" or "gemini"

  console.log(`🎙️ Stream TwiML requested for call: ${callId}, model: ${model}`);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // TwiML that streams audio to our WebSocket endpoint
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Start>
        <Stream url="wss://${baseUrl.replace(/^https?:\/\//, '')}/api/ws/audio-stream?callId=${callId}&model=${model}">
            <Parameter name="callId" value="${callId}" />
            <Parameter name="model" value="${model}" />
        </Stream>
    </Start>
    <Pause length="10"/>
    <Say voice="Polly.Joanna">Analyzing audio. Please hold.</Say>
</Response>`;

  return new NextResponse(twiml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
    },
  });
}