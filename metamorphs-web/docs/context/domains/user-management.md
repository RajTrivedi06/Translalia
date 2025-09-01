## User Management

### Profile structure

Path: `src/hooks/useProfile.ts`

```ts
export type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  locale: string | null;
  created_at: string | null;
};
```

### CRUD operations

- Read profile:

```ts
// src/hooks/useProfile.ts
supabase
  .from("profiles")
  .select("id, display_name, username, email, avatar_url, locale, created_at")
  .eq("id", user.id)
  .single();
```

- Upsert profile:

```ts
// src/hooks/useProfile.ts
supabase
  .from("profiles")
  .upsert({ id: user.id, ...input })
  .select()
  .single();
```

### Permissions and roles

- Enforced via Supabase RLS (not shown in repo). Use policies to restrict profile read/write to the row owner.

### User lifecycle

- Registration: `supabase.auth.signUp({ email, password })` (email provider must be enabled; confirm-email can be disabled for immediate access).
- Activation: if email confirmations are enabled, users complete via emailed link. Otherwise, immediate session.
- Deactivation: set application-level flags on `profiles` (e.g., `active boolean`) or revoke access in Supabase.
- Deletion: delete `profiles` row and cascade application data per policy; ensure storage assets are removed.

### User settings

- Part of `profiles` table: `locale`, `display_name`, `username`.
- Extend with additional columns as needed.

### Preferences

- Store lightweight preferences in `profiles` (`locale`); for complex settings, create a `user_settings` table keyed by `id uuid` (fk to profiles).

### Profile image handling

Path: `src/components/account/ProfileForm.tsx`

```tsx
// Upload to storage bucket 'avatars'
const path = `${user.id}/${Date.now()}_${file.name}`;
await supabase.storage.from("avatars").upload(path, file, { upsert: true });
const { data } = supabase.storage.from("avatars").getPublicUrl(path);
setAvatarUrl(data.publicUrl);
```

### Surfacing in UI

Paths: `src/components/auth/AuthButton.tsx`, `src/components/auth/AuthNav.tsx`

```tsx
// Display initials or avatar
const initials =
  profile?.display_name?.trim()?.slice(0, 1).toUpperCase() ??
  user?.email?.[0]?.toUpperCase() ??
  "?";
```

### Privacy and data export

- Allow users to view, download, or delete their data upon request.
- Keep PII minimal in `profiles`; avoid storing secrets in `meta` fields.

### Integration points

- Authentication: `useSupabaseUser`, `AuthNav`, account pages.
- Storage: `avatars` bucket for profile images.
- Workspace: `owner_id` on `projects` ties resources to the user.

### Extension guidelines (LLM)

- Add new profile fields via migrations; update `useProfile` select/upsert.
- For organizations/teams, introduce `teams` and `team_members` tables and gate access via RLS.
- Add notification prefs in a dedicated table; send emails via a server function or third-party service.
