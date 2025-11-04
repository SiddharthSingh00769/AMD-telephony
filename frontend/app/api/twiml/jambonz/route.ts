import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return handleJambonz(request);
}

export async function POST(request: NextRequest) {
  return handleJambonz(request);
}

async function handleJambonz(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const callId = searchParams.get("callId");

  console.log(`📡 Jambonz TwiML requested for call: ${callId}`);

  // For now, return a simple greeting
  // We'll implement SIP routing in the Jambonz section
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna">Jambonz routing will be configured shortly.</Say>
    <Pause length="2"/>
    <Hangup/>
</Response>`;

  return new NextResponse(twiml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
    },
  });
}