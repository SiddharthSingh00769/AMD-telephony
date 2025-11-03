import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request: NextRequest) {
  try {
    console.log("\n📞 ===== TWIML ENDPOINT HIT (POST) =====");
    console.log("Time:", new Date().toISOString());
    
    const searchParams = request.nextUrl.searchParams;
    const callId = searchParams.get("callId");
    console.log("Call ID:", callId);

    const formData = await request.formData();
    const callSid = formData.get("CallSid");
    const from = formData.get("From");
    const answeredBy = formData.get("AnsweredBy");

    console.log("CallSid:", callSid);
    console.log("From:", from);
    console.log("AnsweredBy:", answeredBy);

    const response = new VoiceResponse();
    
    // CRITICAL: Pause FIRST to let AMD analyze YOUR voice before any TwiML audio
    console.log("⏳ Adding 5-second pause for AMD analysis...");
    response.pause({ length: 5 });  // 5 seconds of silence
    
    // THEN play greeting (after AMD has completed)
    response.say(
      { voice: "Polly.Joanna", language: "en-US" },
      "Hello! This is a test call. The answering machine detection is now complete. Thank you for answering."
    );
    response.hangup();

    const twimlString = response.toString();
    console.log("TwiML Generated:", twimlString);
    console.log("===== TWIML ENDPOINT COMPLETE =====\n");

    return new NextResponse(twimlString, {
      status: 200,
      headers: { 
        "Content-Type": "text/xml; charset=utf-8",
        "ngrok-skip-browser-warning": "69420"
      },
    });
  } catch (error) {
    console.error("❌ TwiML POST ERROR:", error);
    const fallback = new VoiceResponse();
    fallback.say("An error occurred.");
    fallback.hangup();
    return new NextResponse(fallback.toString(), {
      status: 200,
      headers: { 
        "Content-Type": "text/xml; charset=utf-8",
        "ngrok-skip-browser-warning": "69420"
      },
    });
  }
}

export async function GET(request: NextRequest) {
  console.log("\n📞 ===== TWIML ENDPOINT HIT (GET) =====");
  
  const response = new VoiceResponse();
  
  // Match the POST handler for testing
  console.log("⏳ GET: Adding 5-second pause for testing...");
  response.pause({ length: 5 });
  
  response.say(
    { voice: "Polly.Joanna", language: "en-US" },
    "Hello! This is a test call. The answering machine detection is now complete. Thank you for answering."
  );
  response.hangup();

  const twimlString = response.toString();
  console.log("TwiML (GET):", twimlString);

  return new NextResponse(twimlString, {
    status: 200,
    headers: { 
      "Content-Type": "text/xml; charset=utf-8",
      "ngrok-skip-browser-warning": "69420"
    },
  });
}