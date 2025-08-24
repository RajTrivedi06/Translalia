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

### User settings

- Part of `profiles` table: `locale`, `display_name`, `username`.
- Extend with additional columns as needed.

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
