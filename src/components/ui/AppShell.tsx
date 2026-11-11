"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto max-w-screen-xl px-4 h-14 flex items-center justify-between">
          <Link href="/courses" className="flex items-center gap-2 font-bold text-slate-900 hover:text-brand-600 transition-colors">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500">
              <BookOpen className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
            StudyDeck
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/courses"
              className={`btn-ghost text-sm ${pathname === "/courses" ? "bg-slate-100 text-slate-900" : ""}`}
            >
              Courses
            </Link>
            <button
              onClick={signOut}
              className="btn-ghost text-sm text-slate-500"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
