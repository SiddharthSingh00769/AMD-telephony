import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export type GeminiAMDResult = {
  result: "human" | "machine" | "unknown";
  confidence: number;
  reasoning: string;
  detectionTime: number;
};

/**
 * Download audio file and convert to base64 for Gemini analysis
 */
async function downloadAudioAsBase64(audioUrl: string): Promise<string> {
  try {
    console.log("📥 Downloading audio from:", audioUrl);
    
    // Get Twilio credentials for authentication
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials not found in environment variables");
    }
    
    // Create Basic Auth header
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    
    // Fetch audio with authentication
    const response = await fetch(audioUrl, {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
    }

    // Get audio as array buffer
    const arrayBuffer = await response.arrayBuffer();
    
    // Convert to base64
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    console.log("✅ Audio downloaded, size:", arrayBuffer.byteLength, "bytes");
    
    return base64;
  } catch (error) {
    console.error("❌ Error downloading audio:", error);
    throw error;
  }
}

/**
 * Detect if call was answered by human or machine using Gemini
 */
export async function detectWithGemini(
  audioUrl: string,
  recordingDuration: number
): Promise<GeminiAMDResult> {
  const startTime = Date.now();

  try {
    console.log("\n🤖 ===== GEMINI AMD STARTING =====");
    console.log("Audio URL:", audioUrl);
    console.log("Duration:", recordingDuration, "seconds");

    // Download audio file
    const audioBase64 = await downloadAudioAsBase64(audioUrl);

    // Use Gemini model with vision/audio capabilities
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash"  
    });

    // Create the analysis prompt
    const prompt = `You are an expert answering machine detection (AMD) system analyzing phone call recordings.

    TASK:
    Determine if this call was answered by a HUMAN or an ANSWERING MACHINE.

    IMPORTANT:
    At the beginning of every call, you may hear a Twilio system message like:
    "You have a trial account. You can remove this message at any time by upgrading to a full account. Press any key to execute your code."
    ➡️ Completely IGNORE this segment. It is NOT part of the actual call. 
    Start your analysis ONLY after this message ends.

    ALSO IGNORE this automated ENDING message (if present):
    "This is a test call. The answering machine detection is now complete. Thank you for answering."
    ➡️ This is NOT spoken by a human. It is a pre-recorded Twilio test message and must not be mistaken for a human response.

    AUDIO DETAILS:
    - Recording URL: ${audioUrl}
    - Duration: ${recordingDuration} seconds
    - Format: Phone call recording (WAV/MP3)

    CRITICAL DETECTION RULES:

    🤖 ANSWERING MACHINE indicators:
    1. Pre-recorded greeting phrases:
      - "Hi, you've reached..."
      - "Thank you for calling..."
      - "Please leave a message..."
      - "I'm not available right now..."
      - "You have reached the voicemail of..."
      - "Press 1 for...", "Press 2 for..."
    2. Scripted, professional tone with perfect clarity
    3. Consistent pacing, no filler words
    4. Background music or hold tones
    5. Beep sound after the message
    6. Menu options or IVR prompts
    7. Multiple rings followed by an automated voice

    👤 HUMAN indicators:
    1. Natural greetings like "Hello?", "Yes?", "Hi", "Who is this?"
    2. Spontaneous, conversational tone
    3. Background noise (TV, people, traffic)
    4. Filler words ("uh", "um", "like")
    5. Varying speech pace or intonation
    6. Questions asked quickly after pickup
    7. Emotional tone (curiosity, irritation, friendliness)

    EDGE CASES:
    - Only ringing/silence: return "unknown"
    - Very short recordings (<2s speech): return "unknown"
    - Poor audio quality or no distinguishable speech: return "unknown"
    - If the only audible speech is Twilio’s automated ending message ("This is a test call..."), return "unknown"
    - If the caller or callee remains silent throughout and only system messages are heard: return "unknown"

    CONFIDENCE SCORING:
    - 0.9-1.0 → Crystal clear evidence
    - 0.7-0.89 → Strong indicators
    - 0.5-0.69 → Moderate indicators
    - 0.3-0.49 → Weak indicators
    - 0.0-0.29 → Very unclear

    RESPONSE FORMAT (valid JSON only):
    {
      "result": "human" | "machine" | "unknown",
      "confidence": 0.0-1.0,
      "reasoning": "Brief explanation of what was heard and which indicators were present (ignore both the Twilio trial and ending messages)."
    }`;

    // Send audio and prompt to Gemini
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "audio/wav",  // Twilio recordings are usually WAV
          data: audioBase64
        }
      },
      { text: prompt }
    ]);

    const response = result.response;
    const text = response.text();

    console.log("🤖 Gemini raw response:", text);

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("❌ Could not parse Gemini response");
      throw new Error("Invalid JSON response from Gemini");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const detectionTime = Date.now() - startTime;

    // Validate result
    const validResults = ["human", "machine", "unknown"];
    if (!validResults.includes(parsed.result)) {
      console.error("❌ Invalid result:", parsed.result);
      throw new Error("Invalid detection result");
    }

    console.log("✅ Gemini AMD Result:", parsed.result);
    console.log("📊 Confidence:", (parsed.confidence * 100).toFixed(1) + "%");
    console.log("💭 Reasoning:", parsed.reasoning);
    console.log("⏱️ Detection time:", detectionTime + "ms");
    console.log("===== GEMINI AMD COMPLETE =====\n");

    return {
      result: parsed.result,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      detectionTime,
    };

  } catch (error) {
    console.error("❌ Gemini AMD error:", error);
    
    const detectionTime = Date.now() - startTime;
    
    return {
      result: "unknown",
      confidence: 0.0,
      reasoning: `Error during analysis: ${error instanceof Error ? error.message : "Unknown error"}`,
      detectionTime,
    };
  }
}

/**
 * Alternative: Simplified detection for testing
 * Uses basic heuristics when Gemini is unavailable
 */
export async function detectWithGeminiSimple(
  audioUrl: string,
  recordingDuration: number
): Promise<GeminiAMDResult> {
  const startTime = Date.now();

  try {
    console.log("\n🤖 ===== GEMINI SIMPLE AMD =====");
    
    // Download audio
    const audioBase64 = await downloadAudioAsBase64(audioUrl);
    
    // Use Flash model with simpler prompt
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash" 
    });

    const prompt = `Analyze this phone call audio. Is it answered by:
- "human" - Real person speaking naturally
- "machine" - Voicemail/answering machine
- "unknown" - Can't determine

Respond ONLY with JSON:
{"result": "human|machine|unknown", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "audio/wav",
          data: audioBase64
        }
      },
      { text: prompt }
    ]);

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error("Invalid response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const detectionTime = Date.now() - startTime;

    console.log("✅ Result:", parsed.result, `(${(parsed.confidence * 100).toFixed(0)}%)`);
    console.log("===== GEMINI SIMPLE COMPLETE =====\n");

    return {
      result: parsed.result,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      detectionTime,
    };

  } catch (error) {
    console.error("❌ Error:", error);
    
    return {
      result: "unknown",
      confidence: 0.0,
      reasoning: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
      detectionTime: Date.now() - startTime,
    };
  }
}