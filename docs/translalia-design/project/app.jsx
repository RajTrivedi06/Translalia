/* App shell — workspace with collapsible panels, header, and overlay tuning view */

const { useState, useEffect, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "tuningEntry": "header-pill",
  "tuningOpen": "overlay",
  "animationSpeed": 1.0,
  "reasoningStyle": "lavender-card",
  "showFlowDot": true,
  "autoRunOnOpen": true
}/*EDITMODE-END*/;

function App() {
  const [tuningOpen, setTuningOpen] = useState(false);
  const [reasoningOn, setReasoningOn] = useState(true);
  const [selectedVariants, setSelectedVariants] = useState({ });
  const [collapsed, setCollapsed] = useState({ guiderail: false, notebook: false, editing: true });

  // Pipeline run state
  const [processingNodeIdx, setProcessingNodeIdx] = useState(2);
  const [paused, setPaused] = useState(false);
  const runRef = useRef(null);

  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const stepMs = 1100 / (tweaks.animationSpeed || 1);
  const TOTAL_STEPS = 5;

  const runPipeline = (startAt = 0) => {
    clearInterval(runRef.current);
    setProcessingNodeIdx(startAt);
    setPaused(false);
    let i = startAt;
    runRef.current = setInterval(() => {
      i += 1;
      if (i > TOTAL_STEPS - 1) {
        clearInterval(runRef.current);
        setProcessingNodeIdx(TOTAL_STEPS - 1);
        return;
      }
      setProcessingNodeIdx(i);
    }, stepMs);
  };

  useEffect(() => {
    if (paused) clearInterval(runRef.current);
  }, [paused]);

  useEffect(() => {
    // initial idle position
    const t1 = setTimeout(() => {
      setProcessingNodeIdx(2);
    }, 400);
    return () => clearTimeout(t1);
  }, []);

  const openTuning = () => {
    setTuningOpen(true);
    if (tweaks.autoRunOnOpen) {
      setTimeout(() => runPipeline(), 500);
    }
  };

  return (
    <div className="app" data-screen-label="00 Translalia Workspace">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">T</div>
          Translalia
        </div>
        <div className="breadcrumb">
          <a href="#">Back to chats</a>
          <span className="sep">|</span>
          <span>Creative, decolonial translation</span>
          <span className="sep">·</span>
          <span style={{color:'var(--text-muted)'}}>Sor Juana · <i>Hombres necios</i></span>
        </div>

        <div className="topbar-right">
          <div
            className={`reasoning-toggle ${reasoningOn ? 'on' : ''}`}
            onClick={() => setReasoningOn(!reasoningOn)}
            role="button" tabIndex={0}
            title="Show AI Reasoning across the workspace"
          >
            <Icon name="brain" size={14} className="brain" stroke={2} />
            <span style={{display:'inline-block'}}>AI Reasoning</span>
            <span className="switch" />
          </div>

          <button className={`tt-btn ${tuningOpen ? 'active' : ''}`} onClick={openTuning} title="Open Translation Tuning">
            <Icon name="flow" size={14} />
            Translation Tuning
            <span className="beta subtle">Beta</span>
          </button>

          <div className="user">JT</div>
        </div>
      </div>

      <div className="workspace">
        {/* GuideRail */}
        <div
          className={`panel guiderail ${collapsed.guiderail ? 'collapsed' : ''}`}
          onClick={() => collapsed.guiderail && setCollapsed({...collapsed, guiderail: false})}
        >
          <span className="panel-tab">Let's get started</span>
          <div className="panel-head">
            <h2>Setup</h2>
            <button className="collapse-btn" onClick={(e) => { e.stopPropagation(); setCollapsed({...collapsed, guiderail: true});}}>
              <Icon name="chev-left" size={13} />
            </button>
          </div>
          <div className="panel-body" data-screen-label="GuideRail">
            <div className="gr-section">
              <div className="gr-label">Workflow</div>
              <div className="gr-step done"><span className="num">✓</span><span className="name">Paste source poem</span></div>
              <div className="gr-step done"><span className="num">✓</span><span className="name">Choose language pair</span></div>
              <div className="gr-step active"><span className="num">3</span><span className="name">Generate variants</span></div>
              <div className="gr-step"><span className="num">4</span><span className="name">Assemble translation</span></div>
              <div className="gr-step"><span className="num">5</span><span className="name">Verify &amp; grade</span></div>
              <div className="gr-progress" style={{marginTop:10}}><div style={{width:'40%'}}/></div>
              <div style={{fontSize:11.5, color:'var(--text-muted)', marginTop:6}}>2 of 5 complete</div>
            </div>

            <div className="gr-section">
              <div className="gr-label">Settings</div>
              <div className="kv-pill" style={{marginBottom:6}}>
                <span className="k">Source</span>
                <span className="v" style={{fontFamily:'inherit', fontWeight:500}}>Spanish</span>
              </div>
              <div className="kv-pill" style={{marginBottom:6}}>
                <span className="k">Target</span>
                <span className="v" style={{fontFamily:'inherit', fontWeight:500}}>English</span>
              </div>
              <div className="kv-pill" style={{marginBottom:6}}>
                <span className="k">Style</span>
                <span className="v" style={{fontFamily:'inherit', fontWeight:500}}>Poetic</span>
              </div>
              <div className="kv-pill" style={{marginBottom:6}}>
                <span className="k">Tone</span>
                <span className="v" style={{fontFamily:'inherit', fontWeight:500}}>Formal-ish</span>
              </div>
              <div className="kv-pill">
                <span className="k">Liberty</span>
                <span className="v" style={{fontFamily:'inherit', fontWeight:500}}>0.6 / Balanced</span>
              </div>
            </div>

            <div className="gr-note">
              <b style={{fontStyle:'normal'}}>NB.</b> Decolonial translation invites you to interrogate every choice. Try variants from different lenses — sonic, semantic, contemporary — and use Reasoning Mode to see why the model proposed each.
            </div>
          </div>
        </div>

        {/* Workshop */}
        <div className="panel workshop">
          <div className="panel-head">
            <h2>Workshop</h2>
            <div style={{display:'flex', alignItems:'center', gap:8, fontSize:11.5, color:'var(--text-muted)'}}>
              <span>16 lines · 4 stanzas</span>
              <button className="collapse-btn"><Icon name="collapse-h" size={13} /></button>
            </div>
          </div>
          <div className="panel-body" data-screen-label="Workshop">
            <Workshop
              reasoningOn={reasoningOn}
              openTuning={openTuning}
              processingNodeIdx={processingNodeIdx}
              selectedVariants={selectedVariants}
              setSelectedVariants={setSelectedVariants}
            />
          </div>
        </div>

        {/* Notebook */}
        <div
          className={`panel notebook ${collapsed.notebook ? 'collapsed' : ''}`}
          onClick={() => collapsed.notebook && setCollapsed({...collapsed, notebook: false})}
        >
          <span className="panel-tab">Notebook</span>
          <div className="panel-head">
            <h2>Notebook</h2>
            <button className="collapse-btn" onClick={(e) => { e.stopPropagation(); setCollapsed({...collapsed, notebook: true});}}>
              <Icon name="chev-right" size={13} />
            </button>
          </div>
          <div className="panel-body" data-screen-label="Notebook">
            <div style={{fontSize:11.5, color:'var(--text-muted)', marginBottom:8, fontStyle:'italic'}}>
              Assembled translation · drafts
            </div>

            <div className="notebook-line">
              <span className="line-num">1</span>
              <span className="line-text">
                {selectedVariants['s1'] ? (
                  POEM_SEGMENTS[0].variants.find(v => v.id === selectedVariants['s1']).words.join(' ')
                ) : (
                  <span className="pending">— pick a variant —</span>
                )}
              </span>
              {reasoningOn && selectedVariants['s1'] && (
                <div className="notebook-pop">
                  <b style={{fontStyle:'normal'}}>Chose variant {['A','B','C'][POEM_SEGMENTS[0].variants.findIndex(v => v.id === selectedVariants['s1'])]}</b>: {POEM_SEGMENTS[0].variants.find(v => v.id === selectedVariants['s1']).reasoning.summary}
                </div>
              )}
            </div>
            <div className="notebook-line">
              <span className="line-num">2</span>
              <span className="line-text"><span className="pending">queued — line 2</span></span>
            </div>
            <div className="notebook-line">
              <span className="line-num">3</span>
              <span className="line-text"><span className="pending">queued — line 3</span></span>
            </div>
            <div className="notebook-line">
              <span className="line-num">4</span>
              <span className="line-text"><span className="pending">queued — line 4</span></span>
            </div>

            <div className="divider-row" style={{margin:'18px 0 8px'}}>Drafts</div>
            <div style={{display:'flex', flexDirection:'column', gap:6, padding:'0 4px'}}>
              <div style={{fontSize:12, color:'var(--text-soft)'}}>v1 — initial pass</div>
              <div style={{fontSize:12, color:'var(--text-soft)'}}>v2 — sonic revision <span style={{color:'var(--blue)'}}>·  current</span></div>
            </div>
          </div>
        </div>

        {/* Editing */}
        <div
          className={`panel editing ${collapsed.editing ? 'collapsed' : ''}`}
          onClick={() => collapsed.editing && setCollapsed({...collapsed, editing: false})}
        >
          <span className="panel-tab">Editing</span>
          <div className="panel-head">
            <h2>EDITING</h2>
            <button className="collapse-btn" onClick={(e) => { e.stopPropagation(); setCollapsed({...collapsed, editing: true});}}>
              <Icon name="chev-right" size={13} />
            </button>
          </div>
          <div className="panel-body" data-screen-label="Editing">
            <div className="editing-tool"><Icon name="rhyme" size={14} className="icon"/> Rhyme &amp; meter</div>
            <div className="editing-tool"><Icon name="star" size={14} className="icon"/> Suggestions</div>
            <div className="editing-tool"><Icon name="verify" size={14} className="icon"/> Verify</div>
          </div>
        </div>

        {tuningOpen && (
          <TuningView
            onClose={() => setTuningOpen(false)}
            reasoningOn={reasoningOn}
            setReasoningOn={setReasoningOn}
            processingNodeIdx={processingNodeIdx}
            onRunPipeline={runPipeline}
            paused={paused}
            setPaused={setPaused}
            totalSteps={5}
          />
        )}
      </div>

      {/* Tweaks panel */}
      {window.TweaksPanel && (
        <TweaksPanel>
          <TweakSection label="Animation" />
          <TweakSlider label="Pipeline speed" value={tweaks.animationSpeed} onChange={(v) => setTweak('animationSpeed', v)} min={0.3} max={3} step={0.1} unit="×" />
          <TweakToggle label="Flow particle on edge" value={tweaks.showFlowDot} onChange={(v) => setTweak('showFlowDot', v)} />
          <TweakToggle label="Auto-run on open" value={tweaks.autoRunOnOpen} onChange={(v) => setTweak('autoRunOnOpen', v)} />

          <TweakSection label="Reasoning" />
          <TweakRadio
            label="Card style"
            value={tweaks.reasoningStyle}
            onChange={(v) => setTweak('reasoningStyle', v)}
            options={['lavender-card', 'minimal']}
          />
          <TweakButton label={'Reasoning · ' + (reasoningOn ? 'On' : 'Off')} onClick={() => setReasoningOn(!reasoningOn)} />

          <TweakSection label="Tuning entry" />
          <TweakRadio
            label="Entry"
            value={tweaks.tuningEntry}
            onChange={(v) => setTweak('tuningEntry', v)}
            options={['header-pill', 'icon-only']}
          />
          <TweakButton label="Open Tuning" onClick={openTuning} />
          <TweakButton label="Run pipeline" onClick={runPipeline} secondary />
        </TweaksPanel>
      )}

      {/* Inject style overrides for tweaks */}
      <style>{`
        ${tweaks.reasoningStyle === 'minimal' ? `
          .reasoning-card { background: var(--bg-soft); border: 1px solid var(--border); color: var(--text); }
          .reasoning-card .reason-label { color: var(--text-soft); }
          .reasoning-card .hl { border-bottom: 1px dotted var(--text-muted); color: var(--text); }
        ` : ''}
        ${!tweaks.showFlowDot ? `.flow-dot { display: none; }` : ''}
        ${tweaks.tuningEntry === 'icon-only' ? `
          .topbar .tt-btn .label-hide { display: none; }
        ` : ''}
      `}</style>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
