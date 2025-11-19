# Testing Guide: Poem-Level AI Suggestions Feature

## Prerequisites

Before testing, you need to:

1. **Fix the build** - The feature is implemented but there are type compatibility issues in `jobState.ts`
   - See the build errors from the previous run
   - Need to update references from `job.stanzas` to `job.chunks || job.stanzas`
   - This is a mechanical fix (~10 instances)

2. **Ensure environment variables are set:**
   ```bash
   OPENAI_API_KEY=your_key_here
   TRANSLATOR_MODEL=gpt-4o  # or claude-opus-4-1
   ```

3. **Start the dev server:**
   ```bash
   npm run dev
   ```

---

## Quick Start: Manual Testing Steps

### Step 1: Navigate to a Poem

1. Open the app: `http://localhost:3000`
2. Create or open a workspace
3. Open the **Guide Rail** (left sidebar)
4. Paste in a poem (suggest testing with a sonnet first):

**Test Poem 1 (English Sonnet - 14 lines):**
```
Shall I compare thee to a summer's day?
Thou art more lovely and more temperate:
Rough winds do shake the darling buds of May,
And summer's lease hath all too short a date:

Sometime too hot the eye of heaven shines,
And often is his gold complexion dimm'd;
And every fair from fair sometime declines,
By chance, or nature's changing course untrimm'd;

But thy eternal summer shall not fade,
Nor lose possession of that fair thou ow'st;
Nor shall death brag thou wander'st in his shade,
When in eternal lines to time thou grow'st:

So long as men can breathe, or eyes can see,
So long lives this, and this gives life to thee.
```

### Step 2: Set Up Translation Preferences

1. Enter **Translation Zone**: "Modern English translation"
2. Enter **Translation Intent**: "Preserve the romantic tone and sonnet structure, but make it accessible to contemporary readers"
3. Click **Submit Poem**
4. Click **Start Workshop** → confirm

### Step 3: Complete Workshop Translation

1. Wait for chunks to be detected and translated in background
2. In the **Workshop Rail**, you'll see chunks with progress
3. Click each chunk → click each line → select your preferred translation variant
4. Continue until all lines have translations selected

### Step 4: Test the New "Ideas" Button

1. Navigate to **Notebook** tab
2. Look for the **"Ideas"** button in the header (appears once you have completed lines)
3. Click it

### Step 5: Observe the Suggestions Panel

When you click "Ideas", you should see:

**Loading State (2-3 seconds):**
- Animated spinner
- Text: "Analyzing your translation..."

**Loaded State (Success):**
- Panel with 3-5 suggestion categories
- Each category shows:
  - Category name (e.g., "Rhyme Strategy")
  - Brief description of what's in your translation
  - Expandable options with details

**Interactive Elements:**
- Click category header to expand/collapse
- Click "Show Details" on each option to see:
  - **Rationale**: Why this matters
  - **Action**: Concrete next steps

### Step 6: Verify Content Quality

The suggestions should be contextual. For the Shakespeare sonnet example, you might see:

**Rhyme Strategy:**
- "Source uses Shakespearean rhyme (ABAB CDCD EFEF GG). Your translation maintains this. Want to try a different pattern?"
- "Or explore near-rhymes (slant rhyme) for a modern feel?"

**Tone & Register:**
- "Source is romantic and formal. Your translation is modern but casual. Want to try a more poetic register?"
- "Or embrace the casual tone?"

**Meaning Expansion:**
- "Key metaphor is comparing love to eternal summer. Want to explore variations on that metaphor?"

---

## Test Scenarios

### Scenario 1: Short, Simple Poem (Haiku)
```
Snow falls gently down
Silence wraps the sleeping earth
Spring dreams wait for warmth
```

**Expected Behavior:**
- Only 1-2 chunks (it's short)
- Suggestions focus on simplicity and haiku form
- Should have suggestions about syllable count, imagery

---

### Scenario 2: Free Verse Poem (No Rhyme)
```
The coffee is cold again.
I've been staring at these words
for hours,
hoping they'll rearrange themselves
into something that makes sense.
They won't.
```

**Expected Behavior:**
- Panel should note "No rhyme detected"
- Suggestions skip rhyme strategy (or suggest adding rhyme)
- Focus on rhythm, line breaks, imagery

---

### Scenario 3: Heavy Rhyming Poem
```
The cat in the hat
Sat on the mat so fat,
Wearing a bat,
That was where it was at!
```

**Expected Behavior:**
- Rhyme strategy is primary suggestion
- Questions about rhyme scheme effectiveness
- Suggestions about tone (this one's playful)

---

## Expected Behavior Checklist

### ✅ Button Visibility
- [ ] "Ideas" button only appears when there are completed lines in the notebook
- [ ] Button disappears if you go back to workshop before completing any lines
- [ ] Button is properly styled and positioned in header

### ✅ Loading State
- [ ] Clicking "Ideas" shows loading modal immediately
- [ ] Spinner animates smoothly
- [ ] Loading text is clear
- [ ] Can close modal with X button during loading

### ✅ Success State
- [ ] Suggestions appear after 2-5 seconds
- [ ] Panel is readable (good contrast, font size)
- [ ] Scrolling works if too many suggestions
- [ ] All suggestion cards are visible

### ✅ Suggestion Content
- [ ] At least 2-3 categories appear
- [ ] Each category has 2-3 options
- [ ] Options include: title, description, difficulty badge
- [ ] Details contain: rationale and action steps
- [ ] Suggestions are contextual to the actual poem

### ✅ Interactivity
- [ ] Clicking category header expands/collapses
- [ ] "Show Details" button toggles details
- [ ] Close button (X) closes the panel
- [ ] Panel can be reopened by clicking "Ideas" again

### ✅ Error Handling
- [ ] If LLM fails, fallback suggestions still appear
- [ ] Error message explains what happened
- [ ] "Try Again" button works
- [ ] No console errors

---

## Test Cases for API

If you want to test the API directly:

### Test with cURL:

```bash
curl -X POST http://localhost:3000/api/notebook/poem-suggestions \
  -H "Content-Type: application/json" \
  -d '{
    "threadId": "YOUR_THREAD_ID_HERE",
    "sourcePoem": "Shall I compare thee to a summer'\''s day?...",
    "translationPoem": "Should I say you'\''re like a summer day?...",
    "guideAnswers": {
      "translationZone": "Modern English",
      "translationIntent": "Keep the romantic tone, make it accessible"
    }
  }'
```

### Expected Response:

```json
{
  "sourceAnalysis": {
    "sourceText": "...",
    "rhymeScheme": "ABAB",
    "hasRhyme": true,
    "lineVariability": 0.15,
    ...
  },
  "translationAnalysis": {
    "translationText": "...",
    "rhymeScheme": "ABAB",
    "hasRhyme": true,
    ...
  },
  "suggestions": [
    {
      "id": "rhyme-exploration",
      "category": "rhyme_strategy",
      "categoryLabel": "Rhyme Strategy",
      "options": [
        {
          "id": "match-source-rhyme",
          "title": "Match the source rhyme pattern",
          "description": "...",
          "rationale": "...",
          "action": "...",
          "difficulty": "medium"
        }
      ],
      "sourceAnalysis": "...",
      "yourTranslation": "...",
      "isApplicable": true
    }
  ],
  "overallObservations": "Your translation...",
  "studentPromptsToConsider": [
    "What choices did you make?",
    "What aspects matter most?"
  ]
}
```

---

## Browser Console Testing

Open DevTools (F12) and check:

### Network Tab:
1. Go to Notebook
2. Click "Ideas"
3. Watch for `POST /api/notebook/poem-suggestions` request
4. Check:
   - Status: 200 (not 404, 500, etc.)
   - Request payload looks correct
   - Response time: 2-5 seconds
   - Response size: ~5-15KB

### Console Tab:
1. Should have NO error messages
2. Should have NO CORS warnings
3. May have info logs (hook calls)

### Network → XHR/Fetch:
1. Should see ONE request to `/api/notebook/poem-suggestions`
2. Status: 200
3. Response preview shows valid JSON

---

## Debugging Tips

### If the Button Doesn't Appear:
1. Check that you have completed at least one line in the workshop
2. Check `completedLines` in workshop store has entries
3. Verify `threadId` is set
4. Check console for errors

### If Suggestions Don't Load:
1. Check Network tab for API request
2. Look at response status code:
   - 404: Thread not found (auth issue?)
   - 401: Not authenticated
   - 500: Server error (check server logs)
   - 200: Success but parsing failed
3. Check browser console for JavaScript errors
4. Verify OpenAI API key is set

### If Suggestions Are Nonsensical:
1. Verify the source poem and translation were passed correctly
2. Check the prompt in `poemSuggestions.ts`
3. Try fallback mode (add a log to see if it triggers)
4. Adjust LLM model or temperature if needed

### If Styling Looks Wrong:
1. Check Tailwind CSS is loaded
2. Verify no conflicting CSS
3. Try hard refresh (Cmd+Shift+R)
4. Check component CSS classes

---

## Performance Testing

### Measure Load Time:
1. Open DevTools → Performance tab
2. Click "Ideas" button
3. Record profile
4. Analyze:
   - Time to first suggestion card: should be <100ms after response
   - Smooth scrolling: should be 60fps
   - No jank on expand/collapse

### Measure API Response:
1. In Network tab, check `time` column
2. Should be 2-5 seconds
3. If >10 seconds: LLM might be slow
4. If <1 second: likely using fallback (check response)

---

## Test Cases Summary

| Scenario | Poem Type | Expected Result |
|----------|-----------|-----------------|
| Shakespeare sonnet | Formal rhyming | Rhyme strategy + tone suggestions |
| Haiku | Short, simple | Form + imagery suggestions |
| Free verse | No rhyme | Rhythm + imagery suggestions (no rhyme category) |
| Limerick | Playful rhyme | Rhyme + tone suggestions |
| Empty translation | No lines | "Ideas" button hidden |
| Partial translation | Some completed | "Ideas" button shows suggestions for what's done |

---

## Steps to Run Full Test

1. **Fix build:**
   ```bash
   npm run build
   # Fix any jobState.ts errors
   npm run build
   ```

2. **Start dev server:**
   ```bash
   npm run dev
   ```

3. **Test Scenario 1 (Sonnet):**
   - Paste Shakespeare sonnet
   - Set preferences
   - Complete workshop
   - Click "Ideas"
   - Verify suggestions appear
   - Verify they mention rhyme, tone, etc.

4. **Test Scenario 2 (Free Verse):**
   - Paste free verse poem
   - Complete workshop
   - Click "Ideas"
   - Verify rhyme suggestions are skipped/different
   - Verify rhythm suggestions appear

5. **Test Scenario 3 (Error Handling):**
   - In browser DevTools, throttle network to "Offline"
   - Click "Ideas"
   - Verify error message
   - Verify "Try Again" button works

6. **Test with Different Languages (if possible):**
   - Try French poetry
   - Try poetry in user's preferred language
   - Verify suggestions are still relevant

---

## What to Report When Testing

When you test and find issues, document:

1. **What you did:** Step-by-step reproduction
2. **What you expected:** What should happen
3. **What actually happened:** What did happen
4. **Screenshots/Video:** Visual evidence
5. **Console errors:** Any JavaScript errors
6. **API response:** Copy the actual response from Network tab

---

## After Testing

Once you've verified the feature works:

1. **Fix any bugs** found
2. **Tune the prompts** if suggestions aren't good enough
3. **Adjust difficulty ratings** if they don't match reality
4. **Expand suggestion categories** if you need more types
5. **Show to your client** for feedback

---

## Success Criteria

The feature is working when:

✅ Button appears in Notebook after completing lines
✅ Clicking button opens modal with loading state
✅ Suggestions load within 5 seconds
✅ At least 2-3 suggestion categories appear
✅ Each suggestion has actionable advice
✅ Suggestions are contextual to the actual poem
✅ UI is polished and responsive
✅ Error handling works gracefully
✅ No console errors

---

## Next: Production Testing

Once local testing passes:

1. Test with actual students
2. Collect feedback on suggestion quality
3. Iterate on prompts
4. Test with diverse poem types and languages
5. Monitor LLM costs and response times
