"use client";
import { Link } from "@/i18n/routing";
import { BarChart3 } from "lucide-react";

export default function MainNav() {
  return (
    <nav className="flex gap-4 p-3">
      <Link href="/" className="underline">
        Home
      </Link>
      <Link href="/workspace" className="underline">
        Workspace
      </Link>
      {/* Internal verification dashboard - only in development */}
      {/* {process.env.NODE_ENV === "development" && (
        <Link
          href="/verification-dashboard"
          className="underline flex items-center gap-1"
        >
          <BarChart3 className="w-4 h-4" />
          Verification Analytics
        </Link>
      )} */}
    </nav>
  );
}
