/* Translation Tuning — editorial / Apple-inspired horizontal timeline
   Clicking a node expands its detail inline below the timeline. */

const CORE_NODES = [
  {
    id: 'context',
    name: 'Source Text',
    icon: 'doc',
    desc: 'Line, surrounding stanza, and style settings.',
    metricLine: '8 lines · 412 tokens',
    previewLine: '"Hombres necios que acusáis…"',
  },
  {
    id: 'prompt',
    name: 'Prompt Assembly',
    icon: 'pencil',
    desc: 'Compiled instructions, style cues, and source line.',
    metricLine: '1,184 chars · 286 tokens',
    previewLine: 'Sonic-first · 2 custom overrides',
    editable: true,
  },
  {
    id: 'model',
    name: 'AI Generation',
    icon: 'send',
    desc: 'Generates three variants. Model & reasoning effort.',
    metricLine: 'gpt-4o-mini · T 0.7',
    previewLine: '142 reasoning tokens',
    editable: true,
  },
  {
    id: 'quality',
    name: 'Quality Gates',
    icon: 'verify',
    desc: 'Schema, diversity, and meaning checks before release.',
    metricLine: 'Diversity 0.32 · pass',
    previewLine: 'Schema ✓ · 1 retry (variant B)',
    retry: true,
  },
  {
    id: 'variants',
    name: '3 Variants Ready',
    icon: 'star',
    desc: 'Three distinct, scored translations released to the workshop.',
    metricLine: '64 output tokens',
    previewLine: '"Foolish…" / "Senseless…" / "Stubborn…"',
  },
];

const DOWNSTREAM = [
  { id: 'nb',     name: 'Notebook Analysis',         metric: '24 nodes',         state: 'done' },
  { id: 'rhyme',  name: 'Rhyme Workshop',            metric: 'ABBA · 1 deviation', state: 'done' },
  { id: 'poem',   name: 'Poem-Level Suggestions',    metric: 'analyzing…',       state: 'running' },
  { id: 'verify', name: 'Verification & Grade',      metric: 'pending',          state: 'idle' },
  { id: 'meter',  name: 'Meter Analysis',            metric: 'pending',          state: 'idle' },
  { id: 'export', name: 'Export & Citations',        metric: 'pending',          state: 'idle' },
];

const PROMPT_DETAIL = {
  reasoningTrace: [
    "Analyzed source: 8 syllables, octosyllabic redondilla; no end rhyme in this opening fragment.",
    "Variant A prioritized literal meaning. Chose \"foolish\" over \"silly\" to preserve necios as a moral, not intellectual, failing.",
    "Variant B explored alliterative alternatives for sonic texture; routed through sibilance.",
    "Variant C reimagined as a more contemporary register; tightened sin razón into legal language.",
  ],
  reasoningTokens: 142,
  history: [
    { ts: "2m ago",  preset: "Sonic-first",     div: 0.32, quality: 4.2, fidelity: 4.8, active: true },
    { ts: "14m ago", preset: "Literal-leaning", div: 0.18, quality: 3.9, fidelity: 4.9 },
    { ts: "1h ago",  preset: "Default v2.1",    div: 0.27, quality: 4.0, fidelity: 4.7 },
  ],
};

function nodeReasoning(id) {
  return ({
    context: [
      "Included ±3 adjacent lines as context — Sor Juana's redondilla rhyme depends on the next line.",
      "Style \"Sonic-first\" added: prioritize alliteration and assonance when faithful meaning permits.",
    ],
    model: [
      "Selected gpt-4o-mini for cost/latency on per-line calls; full poem-level can escalate.",
      "Streamed response — first variant tokens arrived at 240ms.",
      "Retried once for variant B after diversity check flagged lexical overlap > 0.55.",
    ],
    quality: [
      "Computed lexical overlap across A/B/C: 0.32 (threshold 0.55).",
      "Structural overlap (POS sequence): 0.18.",
      "Variant B initially overlapped Variant A by 0.61 — triggered single retry; passed on second draft.",
    ],
    variants: [
      "Selected variant ordering by quality-fidelity composite score.",
      "Marked variant C with 'register: contemporary' tag for downstream notebook analysis.",
    ],
  })[id] || ["No reasoning recorded for this step yet."];
}

function nodePayload(id) {
  return ({
    context:  'language: "es" → "en"\nline: 1 of 16\ncontext_window: ±3 lines\nstyle: "Sonic-first"\ntone: "Formal-ish"\nliberty: 0.6',
    model:    '→ POST /v1/chat/completions\n  model: gpt-4o-mini\n  temperature: 0.7\n  max_tokens: 4000\n  reasoning_effort: medium\nfirst_token: 240ms · total: 1.84s',
    quality:  'schema: pass\njaccard_overlap: 0.32 (threshold 0.55)\nmeaning_similarity: 0.86\nretry_fired: variant_b',
    variants: 'A: literal  · score 4.6\nB: sonic    · score 4.2\nC: contemp  · score 4.0\ncached_at: 14:22:08',
  })[id] || "—";
}

function nodeHash(id) {
  return ({ context: '0c2a91', prompt: 'a3f8c2', model: '7e4d28', quality: 'cc5a17', variants: '5b1290' })[id] || 'aaaaaa';
}

/* ---------------- Expanded detail for the Prompt node ---------------- */

function PromptDetail({ runTest, testResult, reasoningOn, tab, setTab }) {
  return (
    <div className="ed-content">
      {tab === 'history' ? (
        <section className="ed-section">
          <h3 className="ed-h">Recent runs for Line 1</h3>
          <p className="ed-sub">Compare how different settings produced different variants for this line.</p>
          <div className="history-list">
            {PROMPT_DETAIL.history.map((h, i) => (
              <div key={i} className={`history-row ${h.active ? 'active' : ''}`}>
                <div className="hr-l">
                  <div className="hr-name">
                    {h.preset}
                    {h.active && <span className="hr-active-tag">Current</span>}
                  </div>
                  <div className="hr-ts">{h.ts}</div>
                </div>
                <div className="hr-stats">
                  <span><span className="hr-k">Diversity</span> {h.div}</span>
                  <span><span className="hr-k">Quality</span> {h.quality}</span>
                  <span><span className="hr-k">Fidelity</span> {h.fidelity}</span>
                </div>
                <div className="hr-actions">
                  <button className="text-link">Compare ›</button>
                  <button className="text-link">Restore ›</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <>
          {/* TRANSLATION INSTRUCTIONS */}
          <section className="ed-section">
            <div className="ed-section-head">
              <span className="dot-indicator green" />
              <h4 className="ed-label">Translation Instructions</h4>
              <span className="ed-status teal">Safe to edit</span>
              <button className="text-link" style={{marginLeft:'auto'}}>
                Copy prompt →
              </button>
            </div>
            <div className="prose">
              <p>Translate the following line of poetry from Spanish into English.</p>
              <p>Produce three distinct variants that differ meaningfully in approach.</p>
              <p>
                Line to translate: <span className="src-highlight">Hombres necios que acusáis…</span>
              </p>
              <p className="prose-row">
                Style: <button className="inline-edit">Sonic-first</button>
                <span className="prose-sep">·</span>
                Tone: <button className="inline-edit">Formal-ish</button>
                <span className="prose-sep">·</span>
                Liberty: <button className="inline-edit">0.6</button>
              </p>
              <p className="prose-helper">
                Preserve cultural references and respect Sor Juana Inés de la Cruz's voice. Do not flatten irony.
              </p>
            </div>
            <div className="ed-meta">1,184 chars · 286 tokens · 2 custom overrides</div>
          </section>

          <hr className="ed-divider" />

          {/* MODEL SETTINGS */}
          <section className="ed-section">
            <div className="ed-section-head">
              <span className="dot-indicator amber" />
              <h4 className="ed-label">Model Settings</h4>
              <span className="ed-status amber">Changes output quality</span>
            </div>
            <p className="ms-inline">
              <select className="ms-inline-v" defaultValue="gpt-4o-mini">
                <option>gpt-4o-mini</option>
                <option>gpt-4o</option>
                <option>claude-haiku-4.5</option>
              </select>
              <span className="ms-inline-sep">·</span>
              <span className="ms-inline-k">Temperature</span>
              <input className="ms-inline-v ms-inline-num" type="number" step="0.1" min="0" max="2" defaultValue="0.7" />
              <span className="ms-inline-sep">·</span>
              <span className="ms-inline-k">Max Tokens</span>
              <input className="ms-inline-v ms-inline-num" type="number" step="100" defaultValue="4000" />
              <span className="ms-inline-sep">·</span>
              <span className="ms-inline-k">Reasoning</span>
              <select className="ms-inline-v" defaultValue="medium">
                <option>low</option><option>medium</option><option>high</option>
              </select>
            </p>
          </section>

          <hr className="ed-divider" />

          {/* OUTPUT REQUIREMENTS */}
          <section className="ed-section">
            <div className="ed-section-head">
              <span className="dot-indicator red" />
              <h4 className="ed-label">Output Requirements</h4>
              <span className="ed-status red">Locked</span>
            </div>
            <p className="prose-helper" style={{marginTop:0}}>
              <b style={{color:'var(--text)', fontWeight:600}}>3 variants · JSON schema · required fields.</b>{' '}
              These requirements ensure the application works correctly — variant count, schema, and field names cannot be changed.
            </p>
          </section>

          <hr className="ed-divider" />

          {/* TEST RUN */}
          <section className="ed-section">
            <h4 className="ed-label" style={{marginBottom:6}}>Test Run</h4>
            <p className="ed-sub">
              Run your changes against Line 1 (<i>Hombres necios que acusáis</i>) and compare side-by-side with the current pipeline.
            </p>

            <div className="ed-actions">
              <button className="btn-primary" onClick={runTest}>
                <Icon name="play" size={11} stroke={2.4} /> Test Run
              </button>
              <button className="btn-outline">Reset to defaults</button>
              <button className="text-link">Save as preset →</button>
            </div>

            {testResult && (
              <>
                <div className="compare">
                  <div className="compare-col">
                    <h5 className="compare-h">Current output</h5>
                    {testResult.current.map((l, i) => (
                      <p key={i} className="compare-line">
                        <span className="cl-letter">{['A','B','C'][i]}.</span> {l}
                      </p>
                    ))}
                  </div>
                  <div className="compare-divider" />
                  <div className="compare-col tuned">
                    <h5 className="compare-h tuned-h">Your tuning</h5>
                    {testResult.tuned.map((l, i) => (
                      <p key={i} className="compare-line">
                        <span className="cl-letter tuned-letter">{['A','B','C'][i]}.</span> {l}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="valid-row">
                  {testResult.validations.map((v, i) => (
                    <span key={i} className={`valid-pill ${v.tone}`} style={{animationDelay: `${i * 80 + 150}ms`}}>
                      <span className="v-dot" />
                      {v.label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>

          {reasoningOn && (
            <>
              <hr className="ed-divider" />
              <section className="ed-section">
                <div className="ed-section-head">
                  <h4 className="ed-label">AI Reasoning Trace</h4>
                  <span className="ed-mono-meta">{PROMPT_DETAIL.reasoningTokens} reasoning tokens</span>
                </div>
                <ol className="reason-trace">
                  {PROMPT_DETAIL.reasoningTrace.map((t, i) => (
                    <li key={i} className="reason-step" style={{animationDelay: `${i * 80}ms`}}>
                      <span className="rsnum">{i + 1}</span>
                      <span className="rstext">{t}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}

          <div className="ed-footer">v2.1 · hash {nodeHash('prompt')} · last edited 2 days ago</div>
        </>
      )}
    </div>
  );
}

/* ---------------- Expanded detail for non-prompt nodes ---------------- */

function GenericDetail({ node, reasoningOn }) {
  return (
    <div className="ed-content">
      <section className="ed-section">
        <h4 className="ed-label" style={{marginBottom:6}}>About this stage</h4>
        <p className="prose-helper" style={{marginTop:0}}>{node.desc}</p>
      </section>

      <hr className="ed-divider" />

      <section className="ed-section">
        <h4 className="ed-label" style={{marginBottom:6}}>Latest payload</h4>
        <pre className="payload">{nodePayload(node.id)}</pre>
      </section>

      {reasoningOn && (
        <>
          <hr className="ed-divider" />
          <section className="ed-section">
            <h4 className="ed-label" style={{marginBottom:8}}>AI Reasoning Trace</h4>
            <ol className="reason-trace">
              {nodeReasoning(node.id).map((t, i) => (
                <li key={i} className="reason-step" style={{animationDelay: `${i * 80}ms`}}>
                  <span className="rsnum">{i + 1}</span>
                  <span className="rstext">{t}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      <div className="ed-footer">v2.1 · {node.id} · hash {nodeHash(node.id)}</div>
    </div>
  );
}

/* ---------------- Tuning view ---------------- */

const PRESETS = [
  { id: 'default', name: 'Default v2.1' },
  { id: 'literal', name: 'Literal-leaning' },
  { id: 'poetic',  name: 'Sonic-first' },
  { id: 'contemp', name: 'Contemporary register' },
];

const TuningView = ({ onClose, reasoningOn, setReasoningOn, processingNodeIdx, onRunPipeline, paused, setPaused }) => {
  const [selected, setSelected] = React.useState('prompt');
  const [preset, setPreset] = React.useState('poetic');
  const [testResult, setTestResult] = React.useState(null);
  const [showToast, setShowToast] = React.useState(null);
  const [downstreamOpen, setDownstreamOpen] = React.useState(false);
  const [tab, setTab] = React.useState('inspect');

  const order = CORE_NODES.map(n => n.id);
  const stepIdx = processingNodeIdx === null ? -1 : Math.min(processingNodeIdx, order.length - 1);

  const stateFor = (id) => {
    if (stepIdx < 0) return 'idle';
    const idx = order.indexOf(id);
    if (idx === -1) return 'idle';
    if (idx < stepIdx) return 'done';
    if (idx === stepIdx) return 'processing';
    return 'idle';
  };

  const runTest = () => {
    setTestResult(null);
    setTimeout(() => {
      setTestResult({
        current: [
          "Foolish men who accuse women without reason",
          "Senseless men who blame women so unfairly",
          "Stubborn men, you fault women with no cause",
        ],
        tuned: [
          "Foolish men, you accuse women with no reason at all",
          "Reckless men, who level blame against the women you wrong",
          "You wilful men — naming faults in women, never seeing your own",
        ],
        validations: [
          { tone: 'green', label: 'Structure ✓' },
          { tone: 'green', label: 'Diversity ✓' },
          { tone: 'amber', label: 'Quality 4.2 / 5' },
          { tone: 'green', label: 'Fidelity 4.8 / 5' },
        ],
      });
    }, 450);
  };

  const node = CORE_NODES.find(n => n.id === selected);
  const selectedIdx = order.indexOf(selected);
  const progressPct = stepIdx < 0 ? 0 : ((stepIdx) / (order.length - 1)) * 100;

  return (
    <div className="tuning-overlay" data-screen-label="Tuning · Pipeline view">
      <div className="tuning-head">
        <button className="header-back" onClick={onClose}>
          <Icon name="chev-left" size={13} /> Back to Workshop
        </button>
        <div className="th-divider" />
        <h1 className="th-title">
          Translation Tuning
          <span className="th-beta">Beta</span>
        </h1>
        <span className="th-crumb">Pipeline v2.1</span>

        <div className="th-right">
          <div className="preset-control">
            <span className="th-eyebrow">Preset</span>
            <select
              className="preset-select"
              value={preset}
              onChange={(e) => { setPreset(e.target.value); setShowToast('Preset loaded · ' + PRESETS.find(p => p.id === e.target.value).name); setTimeout(() => setShowToast(null), 1700); }}
            >
              {PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <button className="text-link" onClick={() => { setShowToast('Preset saved'); setTimeout(() => setShowToast(null), 1700); }}>
            Save preset
          </button>

          <div className={`pill-toggle small ${reasoningOn ? 'has-on' : ''}`} onClick={() => setReasoningOn(!reasoningOn)} role="button" tabIndex={0}>
            <button className={reasoningOn ? 'on' : ''}>Reasoning</button>
            <button className={!reasoningOn ? 'on' : ''}>Off</button>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="summary-bar">
        <div className="sb-context">
          <span className="sb-eyebrow">Translating</span>
          <span className="sb-poem">Sor Juana · <i>Hombres necios</i></span>
          <span className="sb-dot">·</span>
          <span className="sb-meta">Line <span className="sb-strong">1</span> of 16</span>
          <span className="sb-dot">·</span>
          <span className="lang-pair">
            <span className="lang">ES</span>
            <Icon name="chev-right" size={9} />
            <span className="lang">EN</span>
          </span>
          <span className="sb-dot">·</span>
          <span className="sb-meta">Preset <span className="sb-strong">{PRESETS.find(p => p.id === preset).name}</span></span>
        </div>
        <div className="sb-stats">
          <div className="sb-stat"><span className="sb-stat-k">Tokens</span> <span className="sb-stat-v">12,400</span></div>
          <div className="sb-stat"><span className="sb-stat-k">Cost</span> <span className="sb-stat-v">~$0.02</span></div>
          <div className="sb-stat"><span className="sb-stat-k">Time</span> <span className="sb-stat-v">4.2s</span></div>
          <div className="sb-stat"><span className="sb-stat-k">Model</span> <span className="sb-stat-v sb-stat-mono">gpt-4o-mini</span></div>
        </div>
      </div>

      <div className="tuning-scroll">
        {/* TIMELINE */}
        <div className="timeline-wrap">
          <div className="timeline">
            <div className="tl-line">
              <div className="tl-line-fill" style={{width: `${progressPct}%`}} />
            </div>
            <div className="tl-nodes">
              {CORE_NODES.map((n, i) => {
                const st = stateFor(n.id);
                const isSel = selected === n.id;
                return (
                  <button
                    key={n.id}
                    className={`tl-node st-${st} ${isSel ? 'sel' : ''} ${n.editable ? 'editable' : ''}`}
                    onClick={() => { setSelected(isSel ? null : n.id); setTab('inspect'); }}
                  >
                    <span className="tl-dot">
                      {st === 'done' && <Icon name="check" size={10} stroke={2.8} />}
                      {st === 'processing' && <span className="tl-pulse" />}
                    </span>
                    <span className="tl-label">
                      {n.name}
                      {n.editable && (
                        <span className="tl-edit-pencil" title="Editable">
                          <Icon name="pencil" size={12} stroke={1.6} />
                        </span>
                      )}
                      {n.retry && <span className="tl-retry-tag" title="1 retry fired">↻ 1×</span>}
                    </span>
                    <span className="tl-metric">{n.metricLine}</span>
                    <span className="tl-preview">{n.previewLine}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* INLINE EXPANSION */}
        {selected && node && (
          <div className="expansion" key={selected}>
            <div className="expansion-rail" style={{left: `calc(${(selectedIdx / (order.length - 1)) * 100}% - 7px)`}} />

            <div className="ed-head">
              <div>
                <h2 className="ed-title">{node.name}</h2>
                <p className="ed-desc">{node.desc}</p>
              </div>

              <div className="ed-head-right">
                {node.id === 'prompt' && (
                  <div className="pill-toggle workshop-pill">
                    <button className={tab === 'inspect' ? 'on' : ''} onClick={() => setTab('inspect')}>Current</button>
                    <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>History <span className="pill-count">· 3</span></button>
                  </div>
                )}
                <button className="x-btn" onClick={() => setSelected(null)} aria-label="Close">
                  <Icon name="x" size={14} />
                </button>
              </div>
            </div>

            {node.id === 'prompt' ? (
              <PromptDetail runTest={runTest} testResult={testResult} reasoningOn={reasoningOn} tab={tab} setTab={setTab} />
            ) : (
              <GenericDetail node={node} reasoningOn={reasoningOn} />
            )}
          </div>
        )}

        {/* DOWNSTREAM */}
        <div className="downstream">
          <button className={`ds-head ${downstreamOpen ? 'open' : ''}`} onClick={() => setDownstreamOpen(!downstreamOpen)}>
            <Icon name="chev-right" size={11} className="ds-chev" />
            <span className="ds-title">Downstream Analysis</span>
            <span className="ds-summary">
              <span className="ds-summary-bit"><span className="ds-bullet done" /> 2 done</span>
              <span className="ds-summary-bit"><span className="ds-bullet running" /> 1 running</span>
              <span className="ds-summary-bit"><span className="ds-bullet idle" /> 3 pending</span>
            </span>
          </button>

          {downstreamOpen && (
            <ul className="ds-list">
              {DOWNSTREAM.map((d) => (
                <li key={d.id} className={`ds-row st-${d.state}`}>
                  <span className="ds-mark">
                    {d.state === 'done'    && <Icon name="check" size={12} stroke={2.6} />}
                    {d.state === 'running' && <span className="ds-running-dot" />}
                    {d.state === 'idle'    && <span className="ds-idle-dot" />}
                  </span>
                  <span className="ds-name">{d.name}</span>
                  <span className="ds-metric">{d.metric}</span>
                  <span className="ds-state">
                    {d.state === 'done' ? 'Complete' : d.state === 'running' ? 'Analyzing…' : 'Pending'}
                  </span>
                  <Icon name="chev-right" size={11} className="ds-row-chev" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Bottom scrubber */}
      <div className="scrubber">
        <button
          className={`play-btn ${processingNodeIdx !== null && !paused ? 'is-playing' : ''}`}
          onClick={() => {
            if (processingNodeIdx !== null && !paused) setPaused(true);
            else { setPaused(false); onRunPipeline(0); }
          }}
          title={processingNodeIdx !== null && !paused ? 'Pause' : 'Run pipeline'}
        >
          <Icon name={processingNodeIdx !== null && !paused ? 'pause' : 'play'} size={11} />
        </button>

        <div className="scrub-track">
          <div className="scrub-fill" style={{width: stepIdx < 0 ? 0 : `${((stepIdx) / (order.length - 1)) * 100}%`}} />
          {order.map((id, i) => {
            const tickState = i < stepIdx ? 'past' : i === stepIdx ? 'current' : 'future';
            return (
              <button
                key={id}
                className={`scrub-tick ${tickState}`}
                style={{left: `${(i / (order.length - 1)) * 100}%`}}
                onClick={() => onRunPipeline(i)}
                aria-label={CORE_NODES[i].name}
              >
                <span className="scrub-tip">{CORE_NODES[i].name}</span>
              </button>
            );
          })}
        </div>

        <div className="scrub-time">
          <span className="scrub-now">{stepIdx < 0 ? '0.0' : (stepIdx * 0.84).toFixed(1)}s</span>
          <span className="scrub-total"> / 4.2s</span>
        </div>

        <button className="text-link scrub-replay" onClick={() => onRunPipeline(0)}>
          <Icon name="reset" size={11} /> Replay
        </button>
      </div>

      {showToast && (
        <div className="toast">
          <Icon name="check" size={12} stroke={2.4} /> {showToast}
        </div>
      )}
    </div>
  );
};

window.TuningView = TuningView;
window.CORE_NODES = CORE_NODES;
