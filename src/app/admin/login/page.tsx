"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function AdminLoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") ?? "/admin";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl,
    });
    if (res?.error) {
      setError(res.error);
    } else if (res?.ok) {
      window.location.href = res.url || callbackUrl;
    }
    setLoading(false);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">Admin Login</h1>

        {/* Google Sign-In */}
        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
        >
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center justify-center">
          <span className="h-px bg-gray-300 flex-1" />
          <span className="px-3 text-xs text-gray-500 uppercase">or</span>
          <span className="h-px bg-gray-300 flex-1" />
        </div>

        {/* Credentials Sign-In */}
        <form onSubmit={handleCredentialsLogin} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="mt-1 w-full border rounded px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full border rounded px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in with Credentials"}
          </button>
        </form>
      </div>
    </main>
  );
} 