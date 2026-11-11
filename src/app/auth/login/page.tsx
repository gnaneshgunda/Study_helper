import { LoginForm } from "@/components/auth/LoginForm";
import { BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-slate-900">StudyDeck</span>
        </div>

        <div className="card p-8">
          <h1 className="text-xl font-semibold text-slate-900 mb-1">
            Welcome back
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            Sign in to your account to continue studying.
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
