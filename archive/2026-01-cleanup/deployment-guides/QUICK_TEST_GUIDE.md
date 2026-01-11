# Quick 15-Minute Verification Test

**Purpose**: Rapidly verify all three phases are working correctly

**Time Required**: 15 minutes

**Prerequisites**:
- Build passes ✅ (already confirmed)
- Dev server can start

---

## Step 1: Start Dev Server (2 min)

```bash
cd /Users/raaj/Documents/CS/AIDCPT/translalia-web
npm run dev
```

**Expected**: Server starts on http://localhost:3000

✅ / ❌ Server started

---

## Step 2: Technical Translation Test (5 min)

### 2A. Setup Technical Preferences

1. Open http://localhost:3000 in browser
2. Create new chat/thread
3. Fill "Let's Get Started" guide:
   - **Translation Zone**: `Technical physics for astronomy students`
   - **Translation Intent**: `Educational materials`
   - **Closeness**: `85` (slide right to "very literal")
   - **Style**: Check `academic`, `precise`
   - **Must-keep terms**: Add `gravitational`
   - **No-go terms**: Add `slang`

4. Paste this poem:
```
The universe expands without end
The moon orbits in perfect harmony
The stars shine bright in distant space
```

5. Click "Start Workshop"

✅ / ❌ Guide completed, workshop started

### 2B. Translate & Verify

1. Click on line 2: "The moon orbits in perfect harmony"
2. Wait for variants to load
3. Open Browser DevTools → Console (F12 or Cmd+Option+I)

**Check 1: Console Output**
Look for log like:
```
[translate-line] Translator Personality: { domain: "Technical physics...", ... }
```

✅ / ❌ Console shows personality being used

**Check 2: Translation Quality**
Look at the 3 variants shown in UI:

Variant 1 should be **literal/scientific**:
- Example: "La luna orbita en perfecta armonía"
- Uses terms like: orbita, satélite, armonía

Variant 2 should be **natural/scientific**:
- Example: "Nuestro satélite natural describe órbita en armonía perfecta"
- Scientific but flows better

Variant 3 should be **creative/scientific**:
- Example: "La luna traza trayectoria orbital en balance celestial"
- May include "gravitational" or related terms (from must-keep)

✅ / ❌ Variants use scientific vocabulary
✅ / ❌ Variants are distinctly different
✅ / ❌ No colloquial/slang language (no-go enforced)

**Check 3: UI Appearance**
UI should show:
```
┌────────────────────────────────────┐
│  Variant 1: [literalness score]   │
│  [Full translated line]            │
│  [Word alignment shown below]      │
└────────────────────────────────────┘
```

**MUST NOT show word-by-word grid like**:
```
❌ [Word 1] [Word 2] [Word 3]
   opt A     opt A    opt A
   opt B     opt B    opt B
```

✅ / ❌ UI shows line variants (not word-by-word)

---

## Step 3: Poetic Translation Test (5 min)

### 3A. Setup Poetic Preferences

1. Open NEW chat/thread (don't reuse previous)
2. Fill guide:
   - **Translation Zone**: `Lyrical poetry for performance`
   - **Translation Intent**: `Reading aloud at cultural events`
   - **Closeness**: `35` (slide left to "creative")
   - **Style**: Check `poetic`, `elevated`, `flowing`
   - **Must-keep terms**: Add `stars`
   - **No-go terms**: Add `technical`

3. Paste **same poem** as Step 2:
```
The universe expands without end
The moon orbits in perfect harmony
The stars shine bright in distant space
```

4. Click "Start Workshop"

### 3B. Translate & Compare

1. Click on line 3: "The stars shine bright in distant space"
2. Wait for variants

**Check 1: Console**
```
[translate-line] Translator Personality: { domain: "Lyrical poetry...", priority: "expressiveness", ... }
```

✅ / ❌ Console shows different personality than Step 2

**Check 2: Translation Quality**

Variant 1 should be **faithfully poetic**:
- Example: "Las estrellas brillan radiantes en el espacio lejano"
- Elevated language, preserves imagery

Variant 2 should be **naturally poetic**:
- Example: "Luceros resplandecen en la lejanía del cosmos"
- Uses poetic terms: luceros, resplandecen, cosmos

Variant 3 should be **freely poetic**:
- Example: "Titilan astros en el manto del firmamento distante"
- Highly expressive, may restructure significantly

✅ / ❌ Variants use poetic vocabulary (luceros, firmamento, titilan)
✅ / ❌ Variants avoid technical/scientific terms
✅ / ❌ Variants feel artistic/elevated

**Check 3: Compare to Step 2**

Go back to Step 2 browser tab (technical translation).

**CRITICAL VERIFICATION**: Same source line, different output?

| Aspect | Technical (Step 2) | Poetic (Step 3) |
|--------|-------------------|------------------|
| Vocabulary | Scientific | Artistic |
| Tone | Academic | Elevated |
| Structure | Literal | Creative |

✅ / ❌ **Translations are CLEARLY DIFFERENT based on preferences**

**If they're too similar → Phase 1 NOT working**

---

## Step 4: Edge Case Tests (3 min)

Using the poetic thread from Step 3:

### 4A. First Line Test
1. Click line 1: "The universe expands without end"
2. Check console: Should see `isFirst: true`
3. ✅ / ❌ Translation works (no errors about missing prevLine)

### 4B. Last Line Test
1. Click line 3: "The stars shine bright in distant space"
2. Check console: Should see `isLast: true`
3. ✅ / ❌ Translation works (no errors about missing nextLine)

### 4C. Single Line Test
1. Create NEW thread
2. Paste only: `The moon shines bright`
3. Complete guide (any preferences)
4. Click the line
5. Check console: Should see `isOnly: true`
6. ✅ / ❌ Translation works with no context

### 4D. Rapid Switching
1. Go back to 3-line poem
2. Quickly click: Line 1 → Line 3 → Line 2 → Line 1
3. Don't wait for translations to finish
4. ✅ / ❌ App doesn't crash
5. ✅ / ❌ No console errors

---

## Step 5: Console Error Check (< 1 min)

In Browser DevTools → Console:

**Check for**:
- ❌ Should see NO red errors
- ❌ Should see NO 404 errors (especially `generate-options`)
- ❌ Should see NO "undefined function" errors
- ✅ Should see INFO logs about translation process

✅ / ❌ Console is clean (no errors)

---

## RESULTS SUMMARY

### Phase 1: User Preferences
- [ ] Technical preferences produce scientific output
- [ ] Poetic preferences produce artistic output
- [ ] **Same line → different output** based on preferences
- [ ] Must-keep terms influence variants
- [ ] No-go terms avoided

**Phase 1**: ✅ PASS / ❌ FAIL

### Phase 2: Line-Level Always
- [ ] First line works (no prevLine)
- [ ] Last line works (no nextLine)
- [ ] Single line works (no context)
- [ ] Rapid switching handled
- [ ] UI always shows line variants
- [ ] UI never shows word-by-word grid

**Phase 2**: ✅ PASS / ❌ FAIL

### Phase 3: Code Removed
- [ ] No 404 errors for `generate-options`
- [ ] No console errors about missing functions
- [ ] Build succeeded (verified earlier)
- [ ] App runs without crashes

**Phase 3**: ✅ PASS / ❌ FAIL

---

## Overall Test Result

**Overall**: ✅ PASS / ❌ FAIL

**If PASS**:
→ Ready for staging deployment
→ Update [VERIFICATION_RESULTS.md](VERIFICATION_RESULTS.md) with "Functional Testing: ✅ PASS"

**If FAIL**:
→ Note specific failures below
→ Fix issues
→ Re-run this test

---

## Failure Notes

**Issues found**:
```
________________________________________
________________________________________
________________________________________
```

**Priority**:
- 🔴 Critical (blocks deployment):
- 🟡 Important (should fix):
- 🟢 Nice-to-have:

---

## Next Steps After PASS

1. ✅ Update verification results document
2. 📝 Commit changes with message:
   ```bash
   git add .
   git commit -m "✅ All three phases verified and tested

   Phase 1: User preferences personalize translations
   Phase 2: Line-level translation always used
   Phase 3: Word-level code removed

   - Personality system integrates user guide answers
   - Edge cases handled (first/last/single line)
   - ~650+ lines of word-level code removed
   - All tests pass

   🤖 Generated with Claude Code
   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
   ```

3. 🚀 Create pull request (if using PR workflow)
4. 🎯 Deploy to staging for user acceptance testing

---

**Tester**: __________________
**Date**: __________________
**Time Taken**: __________ minutes
