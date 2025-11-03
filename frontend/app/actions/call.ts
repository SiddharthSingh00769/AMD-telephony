'use server'

import { z } from "zod";
import { getTwilioClient, getTwilioPhoneNumber, formatPhoneNumber, isValidPhoneNumber } from "@/lib/twilio";
import { PrismaClient } from "@prisma/client";
import { getSession } from "./auth";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

const dialRequestSchema = z.object({
  phoneNumber: z.string().refine(isValidPhoneNumber, {
    message: "Invalid phone number format",
  }),
  amdStrategy: z.enum(["twilio", "jambonz", "huggingface", "gemini"]),
});

type DialResult = {
  success?: boolean;
  error?: string;
  callId?: string;
  callSid?: string;
  phoneNumber?: string;
  amdStrategy?: string;
  status?: string;
  message?: string;
};

type CallStatusResult = {
  success?: boolean;
  error?: string;
  callId?: string;
  phoneNumber?: string;
  amdStrategy?: string;
  status?: string;
  amdResult?: string | null;
  confidence?: number | null;
  duration?: number | null;
  amdDuration?: number | null;
  twilioSid?: string | null;
  errorMessage?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: any;
};

type TestResultsData = {
  success?: boolean;
  error?: string;
  summary?: {
    totalCalls: number;
    byStrategy: Record<string, number>;
    byResult: Record<string, number>;
    averageConfidence: Record<string, number>;
    averageDuration: Record<string, number>;
    successRate: Record<string, number>;
  };
  detailedResults?: Array<{
    strategy: string;
    calls: Array<{
      id: string;
      phoneNumber: string;
      amdResult: string | null;
      confidence: number | null;
      duration: number | null;
      amdDuration: number | null;
      createdAt: Date;
    }>;
  }>;
};


export async function dialAction(
  prevState: DialResult | null,
  formData: FormData
): Promise<DialResult> {
  try {
    const session = await getSession();

    if (!session || !session.user) {
      return { error: "Unauthorized. Please sign in." };
    }

    console.log(`📞 Dial request from user: ${session.user.email}`);

    const rawData = {
      phoneNumber: formData.get("phoneNumber") as string,
      amdStrategy: formData.get("amdStrategy") as string,
    };

    const validatedData = dialRequestSchema.parse(rawData);
    const { phoneNumber, amdStrategy } = validatedData;
    const formattedNumber = formatPhoneNumber(phoneNumber);

    console.log(`📞 Dialing ${formattedNumber} with strategy: ${amdStrategy}`);

    const callRecord = await prisma.call.create({
      data: {
        userId: session.user.id,
        phoneNumber: formattedNumber,
        direction: "outbound",
        amdStrategy: amdStrategy,
        status: "initiated",
        metadata: {
          requestedAt: new Date().toISOString(),
        },
      },
    });

    console.log(`✅ Call record created: ${callRecord.id}`);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const twilioClient = getTwilioClient();
    const fromNumber = getTwilioPhoneNumber();

    let callParams: any = {
      to: formattedNumber,
      from: fromNumber,
      statusCallback: `${baseUrl}/api/webhooks/twilio/status?callId=${callRecord.id}`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
    };

    // Configure AMD based on strategy
    if (amdStrategy === "twilio") {
      // Twilio Native AMD with Async mode
      callParams.machineDetection = "Enable";
      callParams.asyncAmd = "true";
      callParams.machineDetectionTimeout = 5000;
      callParams.machineDetectionSpeechThreshold = 2500;
      callParams.machineDetectionSpeechEndThreshold = 1500;
      callParams.machineDetectionSilenceTimeout = 5000;
      callParams.asyncAmdStatusCallback = `${baseUrl}/api/webhooks/twilio/status?callId=${callRecord.id}`;
      callParams.asyncAmdStatusCallbackMethod = "POST";
      callParams.url = `${baseUrl}/api/twiml/greeting?callId=${callRecord.id}`;
      
      console.log("🤖 Twilio Async AMD enabled with enhanced detection");
      console.log("🔗 TwiML URL:", callParams.url);
      console.log("🔗 Status Callback:", callParams.statusCallback);
      console.log("🔗 AMD Callback:", callParams.asyncAmdStatusCallback);

    } else if (amdStrategy === "gemini") {
      // Gemini AMD - Record the call for AI analysis
      callParams.record = true;
      callParams.recordingStatusCallback = `${baseUrl}/api/webhooks/twilio/recording?callId=${callRecord.id}`;
      callParams.recordingStatusCallbackMethod = "POST";
      callParams.recordingChannels = "mono";
      callParams.trim = "trim-silence";
      callParams.url = `${baseUrl}/api/twiml/greeting?callId=${callRecord.id}`;
      
      console.log("🤖 Gemini AMD enabled (with recording)");
      console.log("🔗 TwiML URL:", callParams.url);
      console.log("🎙️ Recording Callback:", callParams.recordingStatusCallback);

    } else if (amdStrategy === "huggingface") {
      // HuggingFace AMD - Record for ML analysis
      callParams.record = true;
      callParams.recordingStatusCallback = `${baseUrl}/api/webhooks/twilio/recording?callId=${callRecord.id}`;
      callParams.recordingStatusCallbackMethod = "POST";
      callParams.recordingChannels = "mono";
      callParams.trim = "trim-silence";
      callParams.url = `${baseUrl}/api/twiml/greeting?callId=${callRecord.id}`;
      
      console.log("🤖 HuggingFace AMD enabled (with recording)");
      console.log("🔗 TwiML URL:", callParams.url);
      console.log("🎙️ Recording Callback:", callParams.recordingStatusCallback);

    } else if (amdStrategy === "jambonz") {
        // Jambonz AMD - Placeholder for now
        callParams.record = true;
        callParams.recordingStatusCallback = `${baseUrl}/api/webhooks/twilio/recording?callId=${callRecord.id}`;
        callParams.recordingStatusCallbackMethod = "POST";
        callParams.recordingChannels = "mono";
        callParams.url = `${baseUrl}/api/twiml/greeting?callId=${callRecord.id}`;
        
        console.log("🤖 Jambonz AMD enabled (placeholder)");
        console.log("🔗 TwiML URL:", callParams.url);
      }
 else {
      // Default - no AMD
      callParams.url = `${baseUrl}/api/twiml/greeting?callId=${callRecord.id}`;
      console.log("ℹ️ No AMD strategy - default call");
    }

    console.log("📞 Initiating Twilio call...");
    const call = await twilioClient.calls.create(callParams);
    console.log(`✅ Twilio call initiated: ${call.sid}`);

    await prisma.call.update({
      where: { id: callRecord.id },
      data: {
        twilioSid: call.sid,
        status: "initiated",
      },
    });

    revalidatePath("/dashboard");

    return {
      success: true,
      callId: callRecord.id,
      callSid: call.sid,
      phoneNumber: formattedNumber,
      amdStrategy: amdStrategy,
      status: "initiated",
      message: "Call initiated successfully",
    };

  } catch (error) {
    console.error("❌ Dial error:", error);

    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message || "Validation failed" };
    }

    return {
      error: error instanceof Error ? error.message : "Failed to initiate call",
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function getCallStatus(callId: string): Promise<CallStatusResult> {
  try {
    const session = await getSession();

    if (!session || !session.user) {
      return { error: "Unauthorized" };
    }

    const call = await prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      return { error: "Call not found" };
    }

    if (call.userId !== session.user.id) {
      return { error: "Forbidden" };
    }

    return {
      success: true,
      callId: call.id,
      phoneNumber: call.phoneNumber,
      amdStrategy: call.amdStrategy,
      status: call.status,
      amdResult: call.amdResult,
      confidence: call.confidence,
      duration: call.duration,
      amdDuration: call.amdDuration,
      twilioSid: call.twilioSid,
      errorMessage: call.errorMessage,
      createdAt: call.createdAt,
      updatedAt: call.updatedAt,
      metadata: call.metadata,
    };

  } catch (error) {
    console.error("❌ Call status error:", error);
    return { error: "Failed to get call status" };
  } finally {
    await prisma.$disconnect();
  }
}

type CallHistoryResult = {
  success?: boolean;
  error?: string;
  calls?: Array<{
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
  }>;
  total?: number;
};

export async function getCallHistory(
  page: number = 1,
  limit: number = 10
): Promise<CallHistoryResult> {
  try {
    const session = await getSession();

    if (!session || !session.user) {
      return { error: "Unauthorized" };
    }

    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await prisma.call.count({
      where: { userId: session.user.id },
    });

    // Get calls with pagination
    const calls = await prisma.call.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        phoneNumber: true,
        direction: true,
        amdStrategy: true,
        status: true,
        amdResult: true,
        confidence: true,
        duration: true,
        amdDuration: true,
        twilioSid: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        metadata: true,
      },
    });

    return {
      success: true,
      calls,
      total,
    };

  } catch (error) {
    console.error("❌ Call history error:", error);
    return { error: "Failed to fetch call history" };
  } finally {
    await prisma.$disconnect();
  }
}

export async function deleteCall(callId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const session = await getSession();

    if (!session || !session.user) {
      return { error: "Unauthorized" };
    }

    const call = await prisma.call.findUnique({
      where: { id: callId },
    });

    if (!call) {
      return { error: "Call not found" };
    }

    if (call.userId !== session.user.id) {
      return { error: "Forbidden" };
    }

    await prisma.call.delete({
      where: { id: callId },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/history");

    return { success: true };

  } catch (error) {
    console.error("❌ Delete call error:", error);
    return { error: "Failed to delete call" };
  } finally {
    await prisma.$disconnect();
  }
}

export async function getTestResults(): Promise<TestResultsData> {
  try {
    const session = await getSession();

    if (!session || !session.user) {
      return { error: "Unauthorized" };
    }

    // Get all completed calls
    const calls = await prisma.call.findMany({
      where: {
        userId: session.user.id,
        status: "completed",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        phoneNumber: true,
        amdStrategy: true,
        amdResult: true,
        confidence: true,
        duration: true,
        amdDuration: true,
        createdAt: true,
      },
    });

    // Calculate statistics
    const byStrategy: Record<string, number> = {};
    const byResult: Record<string, number> = {};
    const confidenceByStrategy: Record<string, number[]> = {};
    const durationByStrategy: Record<string, number[]> = {};
    const successByStrategy: Record<string, { total: number; success: number }> = {};

    calls.forEach((call) => {
      // Count by strategy
      byStrategy[call.amdStrategy] = (byStrategy[call.amdStrategy] || 0) + 1;

      // Count by result
      const result = call.amdResult || "unknown";
      byResult[result] = (byResult[result] || 0) + 1;

      // Collect confidence scores
      if (call.confidence) {
        if (!confidenceByStrategy[call.amdStrategy]) {
          confidenceByStrategy[call.amdStrategy] = [];
        }
        confidenceByStrategy[call.amdStrategy].push(call.confidence);
      }

      // Collect durations
      if (call.duration) {
        if (!durationByStrategy[call.amdStrategy]) {
          durationByStrategy[call.amdStrategy] = [];
        }
        durationByStrategy[call.amdStrategy].push(call.duration);
      }

      // Track success rate (human detection)
      if (!successByStrategy[call.amdStrategy]) {
        successByStrategy[call.amdStrategy] = { total: 0, success: 0 };
      }
      successByStrategy[call.amdStrategy].total += 1;
      if (call.amdResult === "human") {
        successByStrategy[call.amdStrategy].success += 1;
      }
    });

    // Calculate averages
    const averageConfidence: Record<string, number> = {};
    const averageDuration: Record<string, number> = {};
    const successRate: Record<string, number> = {};

    Object.keys(confidenceByStrategy).forEach((strategy) => {
      const scores = confidenceByStrategy[strategy];
      averageConfidence[strategy] = scores.reduce((a, b) => a + b, 0) / scores.length;
    });

    Object.keys(durationByStrategy).forEach((strategy) => {
      const durations = durationByStrategy[strategy];
      averageDuration[strategy] = durations.reduce((a, b) => a + b, 0) / durations.length;
    });

    Object.keys(successByStrategy).forEach((strategy) => {
      const { total, success } = successByStrategy[strategy];
      successRate[strategy] = total > 0 ? (success / total) * 100 : 0;
    });

    // Group calls by strategy for detailed view
    const detailedResults = Object.keys(byStrategy).map((strategy) => ({
      strategy,
      calls: calls.filter((call) => call.amdStrategy === strategy),
    }));

    return {
      success: true,
      summary: {
        totalCalls: calls.length,
        byStrategy,
        byResult,
        averageConfidence,
        averageDuration,
        successRate,
      },
      detailedResults,
    };
  } catch (error) {
    console.error("❌ Test results error:", error);
    return { error: "Failed to fetch test results" };
  } finally {
    await prisma.$disconnect();
  }
}