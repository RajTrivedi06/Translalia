import { ProfileForm } from "@/components/account/ProfileForm";

export const metadata = {
  title: "Account",
};

export default function AccountPage() {
  // Client-only bits are inside ProfileForm
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Account</h1>
      <p className="mb-6 text-sm text-neutral-600">
        Manage your profile used across projects.
      </p>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <ProfileForm />
      </div>
    </div>
  );
}
