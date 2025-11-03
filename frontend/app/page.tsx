import { redirect } from "next/navigation";
import { getSession } from "./actions/auth";
import Link from "next/link";

export default async function HomePage() {
  // Check if user is already logged in
  const session = await getSession();

  if (session) {
    // Redirect to dashboard if logged in
    redirect("/dashboard");
  }

  // Show landing page if not logged in
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          AMD Telephony System
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Advanced Answering Machine Detection
        </p>
        <div className="space-x-4">
          <Link
            href="/signin"
            className="inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow-lg"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="inline-block px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-50 transition shadow-lg border-2 border-blue-600"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}