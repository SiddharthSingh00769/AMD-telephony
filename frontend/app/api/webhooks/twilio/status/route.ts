import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const callId = searchParams.get("callId");

    console.log("📊 ===== STATUS WEBHOOK RECEIVED =====");
    console.log("Call ID:", callId);

    const formData = await request.formData();
    
    const callSid = formData.get("CallSid") as string;
    const callStatus = formData.get("CallStatus") as string;
    const duration = formData.get("CallDuration") as string;
    const answeredBy = formData.get("AnsweredBy") as string;
    const machineDetectionDuration = formData.get("MachineDetectionDuration") as string;

    console.log("Call SID:", callSid);
    console.log("Status:", callStatus);
    console.log("Duration:", duration);
    console.log("✅ AnsweredBy (AMD):", answeredBy);
    console.log("AMD Duration:", machineDetectionDuration);

    if (!callId) {
      console.warn("⚠️ No callId provided");
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const amdMapping: Record<string, { result: string; confidence: number }> = {
      "human": { result: "human", confidence: 0.95 },
      "machine_start": { result: "machine", confidence: 0.85 },
      "machine_end_beep": { result: "machine", confidence: 0.90 },
      "machine_end_silence": { result: "machine", confidence: 0.80 },
      "machine_end_other": { result: "machine", confidence: 0.75 },
      "fax": { result: "fax", confidence: 0.95 },
      "unknown": { result: "unknown", confidence: 0.60 },
    };

    const updateData: any = {
      updatedAt: new Date(),
    };

    // Only update status if it's provided (regular status webhooks have this)
    if (callStatus) {
      updateData.status = callStatus;
    }

    // Handle call duration (only in final status webhook)
    if (duration) {
      updateData.duration = parseInt(duration);
      console.log(`✅ Call Duration: ${duration}s`);
    }

    // Handle AMD results (only in AMD callback)
    if (answeredBy) {
      const mapped = amdMapping[answeredBy.toLowerCase()] || { 
        result: "unknown", 
        confidence: 0.50 
      };
      updateData.amdResult = mapped.result;
      updateData.confidence = mapped.confidence;
      
      console.log(`✅ AMD Result: ${mapped.result} (${(mapped.confidence * 100).toFixed(0)}%)`);
    }

    // Handle AMD duration (only in AMD callback)
    if (machineDetectionDuration) {
      updateData.amdDuration = parseInt(machineDetectionDuration);
      console.log(`✅ AMD Duration: ${machineDetectionDuration}ms`);
    }

    await prisma.call.update({
      where: { id: callId },
      data: updateData,
    });

    console.log(`✅ Updated call ${callId}`);
    console.log("===== STATUS WEBHOOK COMPLETE =====\n");

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error("❌ Status webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}