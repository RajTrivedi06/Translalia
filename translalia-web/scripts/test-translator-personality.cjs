/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ts = require("typescript");

function loadTranslatorPersonalityModule() {
  const filePath = path.join(
    __dirname,
    "..",
    "src",
    "lib",
    "ai",
    "translatorPersonality.ts"
  );
  const source = fs.readFileSync(filePath, "utf8");

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2019,
      module: ts.ModuleKind.CommonJS,
      strict: true,
    },
    fileName: "translatorPersonality.ts",
  }).outputText;

  const sandbox = {
    module: { exports: {} },
    require,
    __dirname: path.dirname(filePath),
    __filename: filePath,
    console,
  };
  // Ensure `exports` and `module.exports` point to same object
  sandbox.exports = sandbox.module.exports;

  vm.runInNewContext(transpiled, sandbox, { filename: filePath });
  return sandbox.module.exports;
}

function run() {
  const mod = loadTranslatorPersonalityModule();

  const {
    buildTranslatorPersonality,
    buildVariantDefinitions,
    buildDomainExamples,
  } = mod;

  // Test 1: Technical
  {
    const guideAnswers = {
      translationZone: "Technical physics for students",
      translationIntent: "Accurate, student-friendly",
      stance: { closeness: "close" },
      style: { vibes: ["academic", "precise"] },
      policy: { must_keep: ["gravitational"], no_go: ["slang"] },
    };

    const p = buildTranslatorPersonality(guideAnswers);
    assert.strictEqual(p.priority, "accuracy");
    assert.strictEqual(p.creativity_level, "conservative");
    assert.ok(p.sacred_terms.includes("gravitational"));
    assert.ok(p.forbidden_terms.includes("slang"));

    const defs = buildVariantDefinitions(p);
    assert.ok(defs.includes("MOST LITERAL (Scientific)"));
    assert.ok(defs.includes("✓ Use these key terms"));
    assert.ok(defs.includes("✗ NEVER use"));

    const examples = buildDomainExamples(p, "English", "Spanish");
    assert.ok(examples.includes("Technical/Scientific Domain"));
  }

  // Test 2: Poetic
  {
    const guideAnswers = {
      translationZone: "Lyrical poetry",
      translationIntent: "Make it sing",
      stance: { closeness: "natural" },
      style: { vibes: ["poetic", "elevated"] },
      policy: { must_keep: [], no_go: [] },
    };

    const p = buildTranslatorPersonality(guideAnswers);
    assert.strictEqual(p.priority, "expressiveness");
    assert.strictEqual(p.creativity_level, "bold");

    const examples = buildDomainExamples(p, "English", "Spanish");
    assert.ok(examples.includes("Poetic/Lyrical Domain"));
  }

  // Test 3: Default
  {
    const guideAnswers = {};
    const p = buildTranslatorPersonality(guideAnswers);
    assert.strictEqual(p.priority, "naturalness");
    assert.ok(p.literalness >= 0 && p.literalness <= 100);
  }

  console.log("OK: translator personality tests passed");
}

if (require.main === module) {
  run();
}

module.exports = { run };
