# Pending migrations — NOT applied

Files here are written, reviewed, and deliberately **not** ready to run. They
live outside `supabase/migrations/` on purpose: anything in that directory is
picked up by `supabase db push` / `supabase migration up`, and these must not
be.

To apply one, move it into `supabase/migrations/` with its date prefix
corrected to the day it is actually applied, then run the normal migration
flow.

| File | Blocked on |
| --- | --- |
| `drop_patch_thread_state_field_4arg.sql` | Every caller migrated to the 3-arg overload **and** verified in production. See the header of that file for the exact preconditions and the query that proves them. |
