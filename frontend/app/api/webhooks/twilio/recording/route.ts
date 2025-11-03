// app/api/webhooks/twilio/recording/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { detectWithGemini } from "@/lib/amd/gemini";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const callId = searchParams.get("callId");

    console.log("\n🎙️ ===== RECORDING WEBHOOK RECEIVED =====");
    console.log("Call ID:", callId);

    if (!callId) {
      console.warn("⚠️ No callId provided");
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const formData = await request.formData();
    
    const recordingSid = formData.get("RecordingSid") as string;
    const recordingUrl = formData.get("RecordingUrl") as string;
    const recordingStatus = formData.get("RecordingStatus") as string;
    const recordingDuration = formData.get("RecordingDuration") as string;

    console.log("Recording SID:", recordingSid);
    console.log("Recording URL:", recordingUrl);
    console.log("Recording Status:", recordingStatus);
    console.log("Duration:", recordingDuration, "seconds");

    // Only process completed recordings
    if (recordingStatus !== "completed") {
      console.log("⏳ Recording not completed yet, skipping");
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Get call from database
    const call = await prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      console.error("❌ Call not found:", callId);
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    console.log("📋 AMD Strategy:", call.amdStrategy);

    // Route to appropriate AMD service based on strategy
    if (call.amdStrategy === "gemini") {
      console.log("🤖 Starting Gemini AMD analysis...");

      try {
        // Analyze with Gemini
        const amdResult = await detectWithGemini(
          recordingUrl,
          parseInt(recordingDuration) || 0
        );

        console.log("✅ Gemini AMD Result:", amdResult.result);
        console.log("📊 Confidence:", (amdResult.confidence * 100).toFixed(1) + "%");
        console.log("💭 Reasoning:", amdResult.reasoning);

        // Update call record
        await prisma.call.update({
          where: { id: callId },
          data: {
            amdResult: amdResult.result,
            confidence: amdResult.confidence,
            amdDuration: amdResult.detectionTime,
            metadata: {
              ...(call.metadata as any),
              gemini: {
                reasoning: amdResult.reasoning,
                recordingUrl,
                recordingDuration: parseInt(recordingDuration),
                detectionTime: amdResult.detectionTime,
              },
            },
          },
        });

        console.log("✅ Call updated with Gemini AMD result");

      } catch (error) {
        console.error("❌ Gemini AMD error:", error);
        
        // Update call with error
        await prisma.call.update({
          where: { id: callId },
          data: {
            amdResult: "unknown",
            confidence: 0.5,
            errorMessage: `Gemini AMD failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        });
      }

    } else if (call.amdStrategy === "huggingface") {
      console.log("🤖 Starting HuggingFace AMD analysis...");

      try {
        // Call Python FastAPI service
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";
        
        console.log("📡 Calling Python service:", pythonServiceUrl);
        
        const response = await fetch(`${pythonServiceUrl}/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            audio_url: recordingUrl,
            call_id: callId,
          }),
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (!response.ok) {
          throw new Error(`Python service returned ${response.status}: ${response.statusText}`);
        }

        const amdResult = await response.json();

        console.log("✅ HuggingFace AMD Result:", amdResult.result);
        console.log("📊 Confidence:", (amdResult.confidence * 100).toFixed(1) + "%");
        console.log("💭 Reasoning:", amdResult.reasoning);
        console.log("⏱️ Detection time:", amdResult.detection_time + "ms");
        console.log("🔧 Model:", amdResult.model_used);

        // Update call record
        await prisma.call.update({
          where: { id: callId },
          data: {
            amdResult: amdResult.result,
            confidence: amdResult.confidence,
            amdDuration: amdResult.detection_time,
            metadata: {
              ...(call.metadata as any),
              huggingface: {
                reasoning: amdResult.reasoning,
                model: amdResult.model_used,
                recordingUrl,
                recordingDuration: parseInt(recordingDuration),
                detectionTime: amdResult.detection_time,
              },
            },
          },
        });

        console.log("✅ Call updated with HuggingFace AMD result");

      } catch (error) {
        console.error("❌ HuggingFace service error:", error);
        
        // Update call with error
        await prisma.call.update({
          where: { id: callId },
          data: {
            amdResult: "unknown",
            confidence: 0.5,
            errorMessage: `HuggingFace AMD failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        });
      }

    } else if (call.amdStrategy === "jambonz") {
      console.log("🤖 Jambonz AMD - Placeholder Implementation");
      console.log("ℹ️ Note: Full Jambonz requires SIP infrastructure + dedicated server");

      try {
        // Jambonz would require:
        // 1. SIP trunk configuration
        // 2. Jambonz server installation
        // 3. Custom AMD application
        // 4. WebSocket connection for real-time audio
        
        // For now, we'll use a simplified heuristic based on recording duration
        // In production, Jambonz would analyze audio in real-time during the call
        
        const duration = parseInt(recordingDuration) || 0;
        
        console.log("📊 Analyzing call duration:", duration + "s");
        
        // Simple heuristic-based detection:
        // - Short calls (< 5s) = likely machine (quick greeting)
        // - Medium calls (5-15s) = likely human (conversation)
        // - Long calls (> 15s) = analyze pattern
        
        let result: "human" | "machine" | "unknown" = "unknown";
        let confidence = 0.5;
        let reasoning = "";
        
        if (duration < 5) {
          result = "machine";
          confidence = 0.70;
          reasoning = "Short duration (< 5s) suggests automated greeting";
        } else if (duration >= 5 && duration <= 15) {
          result = "human";
          confidence = 0.75;
          reasoning = `Medium duration (${duration}s) with natural conversation pattern`;
        } else if (duration > 15) {
          result = "human";
          confidence = 0.80;
          reasoning = `Extended conversation (${duration}s) indicates human interaction`;
        } else {
          result = "unknown";
          confidence = 0.50;
          reasoning = "Unable to determine from duration alone";
        }
        
        console.log("✅ Jambonz AMD Result:", result);
        console.log("📊 Confidence:", (confidence * 100).toFixed(1) + "%");
        console.log("💭 Reasoning:", reasoning);
        console.log("⚠️ Note: This is a placeholder - full Jambonz requires SIP infrastructure");
        
        // Update call record with placeholder result
        await prisma.call.update({
          where: { id: callId },
          data: {
            amdResult: result,
            confidence: confidence,
            amdDuration: duration * 1000, // Convert to ms
            metadata: {
              ...(call.metadata as any),
              jambonz: {
                reasoning: reasoning,
                recordingUrl,
                recordingDuration: duration,
                implementationType: "placeholder",
                note: "Heuristic-based placeholder - full Jambonz requires SIP trunk and dedicated server",
                requiredInfrastructure: [
                  "Jambonz server installation (Ubuntu 20.04+ with 4GB RAM)",
                  "SIP trunk configuration to carrier (Twilio/etc)",
                  "WebSocket connection for real-time audio streaming",
                  "Custom AMD application with JavaScript",
                  "Public IP address with SSL certificate"
                ],
                fullImplementationTime: "8-12 hours",
                documentation: "See /docs/JAMBONZ.md for complete implementation plan"
              },
            },
          },
        });
        
        console.log("✅ Call updated with Jambonz AMD result (placeholder)");

      } catch (error) {
        console.error("❌ Jambonz placeholder error:", error);
        
        await prisma.call.update({
          where: { id: callId },
          data: {
            amdResult: "unknown",
            confidence: 0.5,
            errorMessage: `Jambonz placeholder failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        });
      }

    } else {
      console.log("ℹ️ No AMD processing needed for strategy:", call.amdStrategy);
      console.log("💡 Twilio Native AMD is processed via status webhook, not recording webhook");
    }

    console.log("===== RECORDING WEBHOOK COMPLETE =====\n");

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error("❌ Recording webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}