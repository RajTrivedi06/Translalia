/* Workshop — center panel with translation variants + AI reasoning */

// Public-domain source: Sor Juana Inés de la Cruz (1648-1695) opening
const POEM_SEGMENTS = [
  {
    id: 's1',
    line: 1,
    source: ["Hombres", "necios", "que", "acusáis", "a", "la", "mujer", "sin", "razón"],
    status: 'processing',
    variants: [
      {
        id: 'v1a',
        words: ["Foolish", "men", "who", "accuse", "women", "without", "reason"],
        reasoning: {
          summary: "Closest to literal sense — kept the directness of accusáis without softening.",
          steps: [
            "Source line: 10 syllables, octosyllabic redondilla; no end rhyme in this opening fragment.",
            "Variant A prioritizes literal meaning. \"Foolish\" preserves necios as a moral failing, not just intellectual.",
            "Kept 2nd-person plural address (\"who accuse\") to retain Sor Juana's direct apostrophe to her audience.",
            "Chose \"without reason\" over \"unreasonably\" to keep the noun razón visible — it returns later as a key theme.",
          ],
        },
      },
      {
        id: 'v1b',
        words: ["You", "senseless", "men", "who", "wrong", "the", "women", "you", "blame"],
        reasoning: {
          summary: "Sonic-texture variant — sibilance and a softer accusation.",
          steps: [
            "Explored alliterative \"senseless… wrong… women\" for sonic continuity.",
            "Replaced \"accuse\" with \"wrong… you blame\" — splits the action across two verbs, more conversational English.",
            "Adds \"you\" twice to recover the spoken cadence of Spanish address.",
            "Trade-off: loses the cleanness of a single accusation verb; reviewer should weigh tone.",
          ],
        },
      },
      {
        id: 'v1c',
        words: ["Stubborn", "men", "—", "you", "fault", "women", "with", "no", "cause"],
        reasoning: {
          summary: "Contemporary register — leaner, more confrontational.",
          steps: [
            "Reframed necios as \"stubborn\" to read as wilful refusal rather than mere folly.",
            "Used em-dash to mirror the rhetorical pause Sor Juana sets up before her argument.",
            "\"No cause\" tightens sin razón into a courtroom register, which echoes the legal-philosophical thread of the full poem.",
            "Most departure from source diction — best when the assignment favors register over literalism.",
          ],
        },
      },
    ],
  },
  {
    id: 's2',
    line: 2,
    source: ["sin", "ver", "que", "sois", "la", "ocasión"],
    status: 'queued',
    variants: [],
  },
  {
    id: 's3',
    line: 3,
    source: ["de", "lo", "mismo", "que", "culpáis"],
    status: 'queued',
    variants: [],
  },
];

const Workshop = ({ reasoningOn, openTuning, processingNodeIdx, selectedVariants, setSelectedVariants }) => {
  const [mode, setMode] = React.useState('Segments');
  const [openReasoning, setOpenReasoning] = React.useState({ v1a: true });
  const [active, setActive] = React.useState('s1');

  const seg = POEM_SEGMENTS.find(s => s.id === active);
  const isProcessing = processingNodeIdx !== null && processingNodeIdx < 6;

  return (
    <div className="workshop-content">
      <div className="ws-head-row">
        <span className="small-label">Step 1 › Choose a segment</span>
        <div style={{flex:1}} />
        <div className="pill-toggle">
          <button className={mode === 'Segments' ? 'on' : ''} onClick={() => setMode('Segments')}>Segments</button>
          <button className={mode === 'Lines' ? 'on' : ''} onClick={() => setMode('Lines')}>Lines</button>
        </div>
      </div>

      {/* Segment list rail */}
      <div style={{display:'flex', gap:8, marginBottom:18, flexWrap:'wrap'}}>
        {POEM_SEGMENTS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className="tt-btn"
            style={{
              borderColor: active === s.id ? 'var(--blue)' : 'var(--border)',
              background: active === s.id ? 'var(--blue-soft)' : 'var(--bg)',
              color: active === s.id ? 'var(--blue-ink)' : 'var(--text)',
              height: 30, fontSize: 12,
            }}
          >
            <span style={{fontFamily:'var(--mono)', fontSize:11, opacity:0.7}}>L{s.line}</span>
            <span style={{maxWidth: 130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
              {s.source.slice(0,5).join(' ')}…
            </span>
            <span className={`status-pill ${s.status==='processing' ? 'coral' : s.status==='queued' ? 'amber' : 'teal'}`} style={{padding:'1px 7px', fontSize:10}}>
              <span className="dot" />
              {s.status === 'processing' ? 'Processing' : s.status === 'queued' ? 'Queued' : 'Done'}
            </span>
          </button>
        ))}
      </div>

      {seg && (
        <div className="segment-card">
          <div className="segment-meta">
            <div className="seg-step-num">2</div>
            <div className="seg-step-text">Step 2 › Review &amp; pick a variant</div>
            <div style={{flex:1}} />
            <div className={`status-pill ${isProcessing ? 'coral' : 'teal'}`}>
              <span className="dot" />
              {isProcessing ? 'Processing line ' + seg.line : 'Variants ready'}
            </div>
          </div>

          <div className="source-label">Source · Spanish</div>
          <div className="source-box">
            {seg.source.map((w, i) => (
              <span key={i} className="word-chip">{w}</span>
            ))}
          </div>
          <div style={{fontSize:11.5, color:'var(--text-muted)', fontStyle:'italic', marginTop:6}}>
            Sor Juana Inés de la Cruz · <i>Hombres necios</i> · 1689
          </div>

          <div className="variant-grid">
            {seg.variants.map((v, i) => {
              const letter = ['A','B','C'][i];
              const isSel = selectedVariants[seg.id] === v.id;
              const reasoningKey = v.id;
              const isOpen = openReasoning[reasoningKey];
              return (
                <div
                  key={v.id}
                  className={`variant-card ${isSel ? 'selected' : ''}`}
                  onClick={() => setSelectedVariants({...selectedVariants, [seg.id]: v.id})}
                >
                  <div className="variant-head">
                    <span>Variant {letter}</span>
                    <span style={{textTransform:'none', letterSpacing:0, fontSize:11, color:'var(--text-muted)'}}>
                      {isSel ? 'Selected' : 'Tap to pick'}
                    </span>
                  </div>
                  <div className="variant-body">
                    {v.words.map((w, j) => (
                      <span key={j} className="word-chip muted">{w}</span>
                    ))}
                  </div>

                  {reasoningOn && (
                    <div style={{marginTop: 4}}>
                      <div
                        className={`reasoning-collapsed ${isOpen ? 'open' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenReasoning({ ...openReasoning, [reasoningKey]: !isOpen });
                        }}
                      >
                        <Icon name="thought" size={12} />
                        <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {v.reasoning.summary}
                        </span>
                        <Icon name="chev-down" size={11} className="chev" />
                      </div>
                      {isOpen && (
                        <div className="reasoning-margin">
                          <div className="reasoning-margin-label">
                            <Icon name="thought" size={11} />
                            AI Reasoning · Variant {letter}
                          </div>
                          {v.reasoning.steps.map((step, k) => (
                            <p
                              key={k}
                              className="typing-line"
                              style={{ animationDelay: `${k * 80}ms` }}
                              dangerouslySetInnerHTML={{
                                __html: step
                                  .replace(/"([^"]+)"/g, '<span class="hl">"$1"</span>')
                                  .replace(/Variant [ABC]/g, m => `<span class="hl">${m}</span>`),
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="divider-row">Or refine with AI</div>

          <button className="primary-btn">
            <Icon name="wand" size={14} stroke={2} />
            Get AI Suggestions
          </button>

          <div style={{display:'flex', gap:8, marginTop:10}}>
            <button className="outline-btn" onClick={openTuning} style={{flex:1}}>
              <Icon name="sliders" size={14} />
              Open Translation Tuning
            </button>
            <button className="outline-btn" style={{flex:1}}>
              <Icon name="pencil" size={14} />
              Edit by hand
            </button>
          </div>
        </div>
      )}

      {seg && seg.variants.length === 0 && (
        <div className="segment-card" style={{textAlign:'center', color:'var(--text-soft)', padding:'30px 18px'}}>
          <Icon name="cache" size={22} />
          <div style={{marginTop:10, fontSize:13}}>Queued — variants will generate once Line 1 settles.</div>
        </div>
      )}
    </div>
  );
};

window.Workshop = Workshop;
window.POEM_SEGMENTS = POEM_SEGMENTS;
