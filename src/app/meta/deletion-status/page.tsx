"use client";

import Link from "next/link";
import { Brain, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function MetaDeletionStatusPage() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      <header className="border-b border-white/5">
        <div className="container mx-auto px-4 py-6">
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold">Staffix</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16 max-w-2xl text-center">
        <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-4">Data Deletion Request Processed</h1>
        <p className="text-gray-400 text-lg mb-6">
          Your data associated with Staffix has been successfully deleted from our systems.
        </p>
        {code && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
            <p className="text-gray-400 text-sm">Confirmation code</p>
            <p className="text-white font-mono text-lg mt-1">{code}</p>
          </div>
        )}
        <p className="text-gray-500 text-sm">
          This includes all Facebook Messenger and Instagram Direct message data,
          page connections, and associated access tokens. If you have questions,
          contact us at{" "}
          <a href="mailto:support@staffix.io" className="text-blue-400 hover:text-blue-300">
            support@staffix.io
          </a>
        </p>
      </main>
    </div>
  );
}
