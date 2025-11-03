import { requireAuth, signOutAction } from "@/app/actions/auth";
import { redirect } from "next/navigation";

async function SignOutButton() {
  async function handleSignOut() {
    "use server";
    await signOutAction();
    redirect("/signin");
  }

  return (
    <form action={handleSignOut}>
      <button
        type="submit"
        className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
      >
        Sign Out
      </button>
    </form>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication - redirects if not logged in
  const session = await requireAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo / Title */}
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                AMD Telephony System
              </h1>
            </div>

            {/* User Info & Sign Out */}
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{session.user.name || "User"}</span>
                <span className="mx-2">•</span>
                <span className="text-gray-500">{session.user.email}</span>
              </div>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 h-12">
            <a
              href="/dashboard"
              className="inline-flex items-center px-1 pt-1 border-b-2 border-blue-500 text-sm font-medium text-gray-900"
            >
              Make Calls
            </a>
            <a
              href="/dashboard/history"
              className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Call History
            </a>
            <a
              href="/dashboard/test-results"
              className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Test Results
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            AMD Telephony System - Attack Capital Assignment
          </p>
        </div>
      </footer>
    </div>
  );
}