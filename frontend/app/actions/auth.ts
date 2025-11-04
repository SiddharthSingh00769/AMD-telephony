'use server'

import { auth } from "@/lib/auth";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

// ✅ Zod Validation Schemas
const signUpSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  email: z.string()
    .email("Invalid email address")
    .toLowerCase(),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters"),
});

const signInSchema = z.object({
  email: z.string()
    .email("Invalid email address")
    .toLowerCase(),
  password: z.string()
    .min(1, "Password is required"),
});

// Type for action results
type ActionResult = {
  success?: boolean;
  error?: string;
};

export async function signUpAction(prevState: any, formData: FormData): Promise<ActionResult> {
  try {
    // Extract raw data
    const rawData = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    console.log("📝 Sign up attempt:", rawData.email);

    // Validate with Zod
    const validatedData = signUpSchema.parse(rawData);

    console.log("✅ Validation passed");

    // Call Better-Auth with validated data
    const result = await auth.api.signUpEmail({
      body: {
        email: validatedData.email,
        password: validatedData.password,
        name: validatedData.name,
      },
    });

    console.log("✅ Better-Auth signup successful");

    // set cookie manually
    if (result && result.token) {
      const cookieStore = await cookies();
      cookieStore.set("better-auth.session_token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });
      console.log("✅ Cookie set from signup");
    }

    return { success: true };
  } catch (error: any) {
    console.error("❌ Sign up error:", error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return {
        error: firstError?.message || "Validation failed",
      };
    }

    // Handle duplicate email
    if (error.message?.includes("unique") || error.message?.includes("already exists")) {
      return {
        error: "An account with this email already exists",
      };
    }

    return {
      error: error.message || "Sign up failed",
    };
  }
}

export async function signInAction(prevState: any, formData: FormData): Promise<ActionResult> {
  try {
    // Extract raw data
    const rawData = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    console.log("🔐 Sign in attempt:", rawData.email);

    // Validate with Zod
    const validatedData = signInSchema.parse(rawData);

    console.log("✅ Validation passed");

    // Call Better-Auth with validated data
    const result = await auth.api.signInEmail({
      body: {
        email: validatedData.email,
        password: validatedData.password,
      },
    });

    console.log("✅ Better-Auth signin successful");

    if (!result) {
      return { error: "Invalid credentials" };
    }

    // Set cookie manually
    if (result.token) {
      const cookieStore = await cookies();
      cookieStore.set("better-auth.session_token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      console.log("✅ Cookie set with token:", result.token.substring(0, 20) + "...");
    }

    return { success: true };
  } catch (error: any) {
    console.error("❌ Sign in error:", error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return {
        error: firstError?.message || "Validation failed",
      };
    }

    return {
      error: "Invalid email or password",
    };
  }
}

export async function signOutAction() {
  const cookieStore = await cookies();
  
  // delete all cookies that might be auth-related
  const cookieNames = [
    'better-auth.session_token',
    'better_auth.session_token',
    'auth-session',
    'session',
  ];

  cookieNames.forEach(name => {
    try {
      cookieStore.delete(name);
    } catch (e) {
    }
  });

  console.log('✅ Session cookies cleared');
  
  redirect('/signin');
}

export async function getSession() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("better-auth.session_token");

    if (!sessionToken) {
      return null;
    }

    // Check database directly using Prisma
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const session = await prisma.session.findUnique({
      where: { token: sessionToken.value },
      include: { user: true },
    });

    await prisma.$disconnect();

    if (!session) {
      return null;
    }

    if (session.expiresAt < new Date()) {
      return null;
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        emailVerified: session.user.emailVerified,
        image: session.user.image,
        createdAt: session.user.createdAt,
        updatedAt: session.user.updatedAt,
      },
      session: {
        id: session.id,
        token: session.token,
        expiresAt: session.expiresAt,
        userId: session.userId,
      },
    };
  } catch (error) {
    console.error("❌ Get session error:", error);
    return null;
  }
}

export async function requireAuth() {
  const session = await getSession();

  if (!session) {
    redirect("/signin");
  }

  return session;
}