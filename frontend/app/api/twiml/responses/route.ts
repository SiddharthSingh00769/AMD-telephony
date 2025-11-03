// app/api/twiml/response/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const callId = searchParams.get("callId");

    console.log("📞 ===== TWIML RESPONSE HANDLER =====");
    console.log("Call ID:", callId);

    const formData = await request.formData();
    const speechResult = formData.get("SpeechResult") as string;
    const digits = formData.get("Digits") as string;

    console.log("Speech Result:", speechResult);
    console.log("Digits Pressed:", digits);

    // Build response based on what user said/pressed
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna" language="en-US">
        Thank you! I heard you loud and clear.
        ${speechResult ? `You said: ${speechResult.substring(0, 50)}.` : ''}
        ${digits ? `You pressed: ${digits}.` : ''}
    </Say>
    <Pause length="1"/>
    <Say voice="Polly.Joanna">
        This test is now complete. Goodbye!
    </Say>
    <Hangup/>
</Response>`;

    console.log("✅ Response TwiML Generated");
    console.log("===== TWIML RESPONSE COMPLETE =====\n");

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        "Content-Type": "text/xml",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });

  } catch (error) {
    console.error("❌ Response TwiML ERROR:", error);
    
    const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Thank you. Goodbye!</Say>
    <Hangup/>
</Response>`;

    return new NextResponse(fallbackTwiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}