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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--color-bg)" }}>
      <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-screen-xl px-5 h-14 flex items-center justify-between">
          <Link href="/courses" className="flex items-center gap-2 font-bold text-stone-800 hover:text-brand-600 transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 shadow-sm">
              <BookOpen className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
            StudyDeck
          </Link>

          <nav className="flex items-center gap-1.5">
            <Link
              href="/courses"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${pathname === "/courses" ? "bg-stone-100 text-stone-900" : "text-stone-500 hover:text-stone-800 hover:bg-stone-50"}`}
            >
              Courses
            </Link>
            <button
              onClick={signOut}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-all"
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
