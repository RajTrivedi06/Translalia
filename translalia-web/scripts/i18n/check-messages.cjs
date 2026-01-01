#!/usr/bin/env node
/**
 * i18n Message Completeness Checker
 *
 * This script validates that all locale message files have the same keys as the
 * canonical English (en.json) file. It fails with a non-zero exit code if any
 * locale is missing keys.
 *
 * Usage:
 *   node scripts/i18n/check-messages.cjs
 *   npm run lint:i18n
 *
 * Add new translations:
 *   1. Add the key to messages/en.json with the English text
 *   2. Add the same key to all other locale files (es.json, hi.json, ar.json, zh.json, ta.json, te.json, ml.json)
 *   3. Run `npm run lint:i18n` to verify completeness
 */

const fs = require("fs");
const path = require("path");

const MESSAGES_DIR = path.join(__dirname, "../../messages");
const CANONICAL_LOCALE = "en";
const SUPPORTED_LOCALES = ["en", "es", "hi", "ar", "zh", "ta", "te", "ml"];

/**
 * Recursively flatten a nested object into dot-notation keys
 * @param {object} obj - The object to flatten
 * @param {string} prefix - Current key prefix
 * @returns {string[]} Array of dot-notation keys
 */
function flattenKeys(obj, prefix = "") {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/**
 * Load and parse a JSON message file
 * @param {string} locale - The locale code
 * @returns {object} Parsed JSON object
 */
function loadMessages(locale) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Message file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

/**
 * Main validation function
 */
function validateMessages() {
  console.log("🌍 Checking i18n message completeness...\n");

  // Load canonical (English) messages
  const canonicalMessages = loadMessages(CANONICAL_LOCALE);
  const canonicalKeys = flattenKeys(canonicalMessages);

  console.log(
    `📋 Canonical locale (${CANONICAL_LOCALE}): ${canonicalKeys.length} keys\n`
  );

  const errors = [];
  const warnings = [];

  // Check each locale against canonical
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === CANONICAL_LOCALE) continue;

    try {
      const messages = loadMessages(locale);
      const localeKeys = flattenKeys(messages);
      const localeKeySet = new Set(localeKeys);

      // Find missing keys
      const missingKeys = canonicalKeys.filter((key) => !localeKeySet.has(key));

      // Find extra keys (not in canonical - these are warnings, not errors)
      const canonicalKeySet = new Set(canonicalKeys);
      const extraKeys = localeKeys.filter((key) => !canonicalKeySet.has(key));

      if (missingKeys.length > 0) {
        errors.push({
          locale,
          type: "missing",
          keys: missingKeys,
        });
      }

      if (extraKeys.length > 0) {
        warnings.push({
          locale,
          type: "extra",
          keys: extraKeys,
        });
      }

      const status =
        missingKeys.length === 0 ? "✅" : `❌ (${missingKeys.length} missing)`;
      console.log(`  ${locale}: ${localeKeys.length} keys ${status}`);
    } catch (error) {
      errors.push({
        locale,
        type: "error",
        message: error.message,
      });
      console.log(`  ${locale}: ❌ Error - ${error.message}`);
    }
  }

  console.log("");

  // Report warnings (extra keys)
  if (warnings.length > 0) {
    console.log("⚠️  Warnings (extra keys not in canonical):\n");
    for (const warning of warnings) {
      console.log(`  ${warning.locale}:`);
      for (const key of warning.keys) {
        console.log(`    - ${key}`);
      }
    }
    console.log("");
  }

  // Report errors
  if (errors.length > 0) {
    console.log("❌ Errors found:\n");
    for (const error of errors) {
      if (error.type === "missing") {
        console.log(
          `  ${error.locale} is missing ${error.keys.length} key(s):`
        );
        for (const key of error.keys) {
          console.log(`    - ${key}`);
        }
      } else if (error.type === "error") {
        console.log(`  ${error.locale}: ${error.message}`);
      }
    }
    console.log(
      "\n💡 To fix: Add the missing keys to the locale files listed above."
    );
    console.log(
      "   Refer to messages/en.json for the canonical key structure.\n"
    );
    process.exit(1);
  }

  console.log("✅ All locale files are complete!\n");
  process.exit(0);
}

// Run the validation
validateMessages();
