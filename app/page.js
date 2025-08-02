"use client";

import { SessionProvider, useSession, signIn } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

function LoginContent() {
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) {
      router.push("/dashboard"); // Redirect after login
    }
  }, [session, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-grey to-grey-600">
      <div className="bg-white shadow-xl rounded-2xl p-10 max-w-sm w-full text-center">
        <img
          src="/logo.png"
          alt="Logo"
          className="mx-auto mb-6 w-20 h-20 object-contain"
        />
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Welcome</h1>
        <p className="text-sm text-gray-600 mb-6">Sign in to continue</p>
        <button
          onClick={() => signIn("azure-ad")}
          className="w-full bg-blue-900 hover:bg-blue-800 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
        >
          Login with Entra
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <SessionProvider>
      <LoginContent />
    </SessionProvider>
  );
}
