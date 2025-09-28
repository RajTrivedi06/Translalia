### [Last Updated: 2025-09-16]

## User Management

### Profiles

- Stored in Supabase table `profiles` keyed by `id` (user id).

| Field          | Source            | Reads (anchors)                                                 | Writes (anchors)                                                  |
| -------------- | ----------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `display_name` | user input/UI     | `metamorphs-web/src/hooks/useProfile.ts:L29–L36`                | `metamorphs-web/src/hooks/useProfile.ts:L45–L55`                  |
| `username`     | user input/UI     | `metamorphs-web/src/hooks/useProfile.ts:L29–L36`                | `metamorphs-web/src/hooks/useProfile.ts:L45–L55`                  |
| `email`        | Supabase session  | `metamorphs-web/src/hooks/useProfile.ts:L29–L36`                | —                                                                 |
| `avatar_url`   | upload to storage | `metamorphs-web/src/components/account/ProfileForm.tsx:L63–L70` | `metamorphs-web/src/components/account/ProfileForm.tsx:L107–L114` |
| `locale`       | user input/UI     | `metamorphs-web/src/hooks/useProfile.ts:L29–L36`                | `metamorphs-web/src/hooks/useProfile.ts:L45–L55`                  |
| `created_at`   | database default  | `metamorphs-web/src/hooks/useProfile.ts:L31–L36`                | —                                                                 |

### Auth → Profile flow

- On sign-in or profile open, `useProfile(user)` selects `profiles` by `id` and shows editable fields; on save, it upserts the row.

```29:36:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useProfile.ts
const { data } = await supabase
  .from("profiles")
  .select("id, display_name, username, email, avatar_url, locale, created_at")
  .eq("id", user.id)
  .single();
```

```48:55:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useProfile.ts
const { data } = await supabase
  .from("profiles")
  .upsert(payload)
  .select()
  .single();
```

### Permissions and roles

- Enforced via Supabase RLS (not shown in repo). Use policies to restrict profile read/write to the row owner.

### User Lifecycle (sequence)

1. Create (sign-up/OAuth) → Supabase user row created
2. Profile hydrate (UI opens) → `useProfile(user)` selects `profiles` by `id`
3. Update profile → upsert with allowed fields; avatar upload to `avatars` bucket
4. Permissions enforced by RLS (row owner)

Anchors:

```22:28:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useProfile.ts
const { data } = await supabase
  .from("profiles")
  .select("id, display_name, username, email, avatar_url, locale, created_at")
  .eq("id", user.id)
  .single();
```

```48:55:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/hooks/useProfile.ts
const { data } = await supabase
  .from("profiles")
  .upsert(payload)
  .select()
  .single();
```

Scenario: Avatar upload then save

```40:51:/Users/raaj/Documents/CS/metamorphs/metamorphs-web/src/components/account/ProfileForm.tsx
const path = `${user.id}/${Date.now()}_${file.name}`;
const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
if (!upErr) {
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  if (data?.publicUrl) setAvatarUrl(data.publicUrl);
}
```

### JSON: Profile shapes (LLM consumption)

```json
{
  "public": {
    "id": "string",
    "display_name": "string|null",
    "username": "string|null",
    "avatar_url": "string|null"
  },
  "private": {
    "email": "string|null",
    "locale": "string|null",
    "created_at": "string|null"
  }
}
```

### JSON: Example protected route config (profile save)

```json
{
  "route": "/api/profile/save",
  "guard": "cookie_or_bearer",
  "errors": [400, 401, 403]
}
```

### Profile image handling

Path: `src/components/account/ProfileForm.tsx`

```tsx
// Upload to storage bucket 'avatars'
const path = `${user.id}/${Date.now()}_${file.name}`;
await supabase.storage.from("avatars").upload(path, file, { upsert: true });
const { data } = supabase.storage.from("avatars").getPublicUrl(path);
setAvatarUrl(data.publicUrl);
```

### Integration points

- Authentication: `useSupabaseUser`, `AuthNav`, `AuthSheet` (quick account), account pages.
- Storage: `avatars` bucket for profile images.
- Workspace: `owner_id` on `projects` ties resources to the user.

Cross-links: See Database Schema for `projects` ownership and threads; see Security Guidelines for auth patterns.
