"use client";
import Link from "next/link";
export default function MainNav() {
  return (
    <nav className="flex gap-4 p-3">
      <Link href="/" className="underline">
        Home
      </Link>
      <Link href="/workspace" className="underline">
        Workspace
      </Link>
    </nav>
  );
}
