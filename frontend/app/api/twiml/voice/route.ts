import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const amdStrategy = searchParams.get("amdStrategy") || "twilio";

    console.log("📞 TwiML Voice webhook called");
    console.log("AMD Strategy:", amdStrategy);

    const response = new VoiceResponse();

    // Play a greeting message
    response.say(
      {
        voice: "Polly.Joanna",
        language: "en-US",
      },
      "Hello, this is a test call from the A M D telephony system. " +
      "This call is being used to test answering machine detection. " +
      "Thank you for your time."
    );

    // Pause for a moment
    response.pause({ length: 2 });

    // Say goodbye
    response.say(
      {
        voice: "Polly.Joanna",
        language: "en-US",
      },
      "Goodbye."
    );

    // Hang up
    response.hangup();

    console.log("✅ TwiML response generated successfully");

    return new NextResponse(response.toString(), {
      status: 200,
      headers: {
        "Content-Type": "text/xml",
      },
    });
  } catch (error) {
    console.error("❌ TwiML generation error:", error);

    // Return a simple fallback TwiML
    const fallbackResponse = new VoiceResponse();
    fallbackResponse.say("An error occurred. Goodbye.");
    fallbackResponse.hangup();

    return new NextResponse(fallbackResponse.toString(), {
      status: 200,
      headers: {
        "Content-Type": "text/xml",
      },
    });
  }
}

// Allow GET for debugging
export async function GET(request: NextRequest) {
  const response = new VoiceResponse();
  response.say("Test TwiML endpoint is working.");
  response.hangup();

  return new NextResponse(response.toString(), {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
    },
  });
}