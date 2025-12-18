# i18n Guide: Adding New UI Strings

This project uses **next-intl** for internationalization. All UI strings must be translated to support complete language switching.

## Quick Reference

### Adding a New UI String

1. **Add the key to `messages/en.json`** in the appropriate namespace:

   ```json
   {
     "Namespace": {
       "yourNewKey": "Your English text here"
     }
   }
   ```

2. **Add translations to all other locale files**:

   - `messages/es.json` (Spanish)
   - `messages/hi.json` (Hindi)
   - `messages/ar.json` (Arabic)
   - `messages/zh.json` (Chinese)

3. **Use the translation in your component**:

   ```tsx
   // Client components
   import { useTranslations } from "next-intl";

   function MyComponent() {
     const t = useTranslations("Namespace");
     return <span>{t("yourNewKey")}</span>;
   }
   ```

4. **Run the lint check** to verify completeness:
   ```bash
   npm run lint:i18n
   ```

### Namespaces

| Namespace           | Use For                                           |
| ------------------- | ------------------------------------------------- |
| `Common`            | Generic UI elements (save, cancel, loading, etc.) |
| `Navigation`        | Navigation links and labels                       |
| `Auth`              | Sign in, sign up, password fields                 |
| `Account`           | Profile/account settings                          |
| `Settings`          | Application settings                              |
| `Workspaces`        | Workspace list and management                     |
| `Chats`             | Chat/thread list pages                            |
| `Thread`            | Thread page UI                                    |
| `Guide`             | Guide rail/setup flow                             |
| `Workshop`          | Workshop translation UI                           |
| `Notebook`          | Notebook/cell editing UI                          |
| `Comparison`        | Side-by-side comparison view                      |
| `ContextNotes`      | Educational context notes                         |
| `JourneyReflection` | Reflection dialog UI                              |

### Locale-Aware Navigation

Always use the locale-aware navigation wrappers from `@/i18n/routing`:

```tsx
// ✅ Correct
import { Link, useRouter, usePathname } from "@/i18n/routing";

// ❌ Incorrect (bypasses locale)
import Link from "next/link";
import { useRouter } from "next/navigation";
```

### Common Patterns

**Interpolation:**

```json
{ "greeting": "Hello, {name}!" }
```

```tsx
t("greeting", { name: "Alice" }); // "Hello, Alice!"
```

**Pluralization:**

```json
{ "items": "{count, plural, =0 {No items} one {# item} other {# items}}" }
```

### Don't Forget

- **aria-labels** and **title** attributes need translation too
- **placeholder** text in inputs
- **Error messages** and **validation text**
- **Empty state** descriptions
- **Tooltips** and helper text

### Validation

The `lint:i18n` script ensures all locale files have matching keys:

```bash
npm run lint:i18n
```

This will fail CI if any keys are missing from locale files.
