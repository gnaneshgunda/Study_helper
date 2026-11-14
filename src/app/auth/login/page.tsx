import { LoginForm } from "@/components/auth/LoginForm";
import { BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#f0eeea" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 shadow-lg shadow-brand-500/20">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-stone-800">StudyDeck</span>
        </div>

        <div className="card p-8">
          <h1 className="text-xl font-semibold text-stone-800 mb-1">
            Welcome back
          </h1>
          <p className="text-sm text-stone-400 mb-6">
            Sign in to continue studying.
          </p>
          <LoginForm />
        </div>

        <p className="text-center text-xs text-stone-400 mt-6">
          Your slides, your doubts, your notes — all in one place.
        </p>
      </div>
    </div>
  );
}
