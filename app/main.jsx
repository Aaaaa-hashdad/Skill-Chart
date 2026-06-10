/* Skill Chart — main app. Requires React, data.js, RadarChart.jsx, tweaks-panel.jsx */
const { useState, useEffect, useRef, useCallback } = React;
const SD = window.SkillData;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  accent: "#0E7490",
  neg: "#7C3AED",
  font: "Space Grotesk",
  density: "regular",
  showRadar: true,
  radarMetric: "level",
  pointsPerTap: 1,
} /*EDITMODE-END*/;

/* ---------- stage milestone blocks (display) ---------- */
function StageBlocks({ level, max, color, charges, stageCost, rate }) {
  // combined fraction: both cycles and raw points contribute
  const totalPts = (charges || 0) * 30 + (rate || 0);
  const maxPts = Math.max(1, stageCost || 1) * 30;
  const pct = Math.min(100, Math.round((totalPts / maxPts) * 100));
  return (
    <div className="stage" title={`Stage ${level} of ${max} · ${charges}/${stageCost} cycles`}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < level;
        const next = i === level;
        let style = {};
        if (filled) {
          style = { background: color, borderColor: "transparent" };
        } else if (next) {
          style = {
            background: pct > 0 ? `linear-gradient(to top, ${color} ${pct}%, var(--surface-2) ${pct}%)` : undefined,
            borderColor: pct > 0 ? color + "88" : undefined,
          };
        }
        return <span key={i} className="sblk" style={style} />;
      })}
    </div>
  );
}

function SkillRow({ skill, max, maxRate, stageCost, polarity, color, step, onAdd, onSetPoints, onRename, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(skill.name);
  const [pEdit, setPEdit] = useState(false);
  const [pVal, setPVal] = useState(String(skill.rate));
  const stage = SD.stageFor(skill.level, polarity);
  const charges = skill.charges || 0;
  const pct = Math.round((skill.rate / 30) * 100);

  const commitPoints = () => {
    let v = parseInt(pVal, 10);
    if (isNaN(v)) v = skill.rate;
    v = Math.max(0, Math.min(30, v));
    onSetPoints(v);
    setPVal(String(v));
    setPEdit(false);
  };

  return (
    <div className="srow">
      <div className="srow-main">
        {editing ? (
          <input
            className="rename"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { setEditing(false); onRename(name.trim() || skill.name); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") { setName(skill.name); setEditing(false); }
            }}
          />
        ) : (
          <button className="sname" onClick={() => setEditing(true)} title="Rename">{skill.name}</button>
        )}
        <StageBlocks level={skill.level} max={max} color={color} charges={skill.charges || 0} stageCost={stageCost} rate={skill.rate || 0} />
        <span className="tier" style={{ color: skill.level ? color : "var(--muted)" }}>{stage}</span>
      </div>

      <div className="srow-ctrl">
        <div className="prog">
          <div className="prog-top">
            <span className="cyc-lbl">{charges}/{stageCost} cycles</span>
            {pEdit ? (
              <input
                className="pin"
                type="number"
                min="0"
                max="30"
                autoFocus
                value={pVal}
                onChange={(e) => setPVal(e.target.value)}
                onBlur={commitPoints}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              />
            ) : (
              <button className="pnum" onClick={() => { setPVal(String(skill.rate)); setPEdit(true); }} title="Set points">
                {skill.rate}<span className="pden">/30</span>
              </button>
            )}
          </div>
          <div className="pbar"><span className="pfill" style={{ width: pct + "%", background: color }} /></div>
          <div className="cycles">
            {Array.from({ length: stageCost }).map((_, i) => (
              <span key={i} className={"pip" + (i < charges ? " on" : "")} style={i < charges ? { background: color } : null} />
            ))}
          </div>
        </div>

        <div className="steppers">
          <button className="step" onClick={(e) => onAdd(-step, e)} aria-label="Remove points" disabled={SD.effort(skill, stageCost) <= 0}>–</button>
          <button className="step up" onClick={(e) => onAdd(step, e)} aria-label="Add points">+{step}</button>
        </div>

        <button className="remove" onClick={onRemove} title="Remove" aria-label="Remove">×</button>
      </div>
    </div>
  );
}

function Category({ cat, max, maxRate, stageCost, accent, neg, step, onMutate, onAdd }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(cat.name);
  const color = cat.polarity === "negative" ? neg : accent;

  const addSkill = () => {
    const nm = newName.trim();
    if (!nm) { setAdding(false); return; }
    onMutate((c) => ({ ...c, skills: [...c.skills, { id: SD.uid("s"), name: nm, level: 1, rate: 0, charges: 0 }] }));
    setNewName("");
    setAdding(false);
  };

  return (
    <section className={"cat " + cat.polarity}>
      <header className="cat-head">
        <span className="cat-dot" style={{ background: color }} />
        {editingTitle ? (
          <input
            className="rename cat-rename"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { setEditingTitle(false); onMutate((c) => ({ ...c, name: title.trim() || cat.name })); }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        ) : (
          <button className="cat-title" onClick={() => setEditingTitle(true)} title="Rename category">{cat.name}</button>
        )}
        <span className="cat-count">{cat.skills.length}</span>
        <span className="cat-sum" style={{ color }}>{SD.balance({ stageCost, categories: [cat] })[cat.polarity === "negative" ? "negRate" : "posRate"]} pts</span>
        <button className="cat-del" title="Delete category" onClick={() => onMutate(null)}>Delete</button>
      </header>

      <div className="skills">
        {cat.skills.map((s, i) => (
          <SkillRow
            key={s.id}
            skill={s}
            max={max}
            maxRate={maxRate}
            stageCost={stageCost}
            polarity={cat.polarity}
            color={color}
            step={step}
            onAdd={(delta, e) => onAdd(cat.id, s.id, delta, e)}
            onSetPoints={(rate) => onMutate((c) => { const skills = c.skills.slice(); skills[i] = { ...skills[i], rate }; return { ...c, skills }; })}
            onRename={(nm) => onMutate((c) => { const skills = c.skills.slice(); skills[i] = { ...skills[i], name: nm }; return { ...c, skills }; })}
            onRemove={() => onMutate((c) => ({ ...c, skills: c.skills.filter((_, j) => j !== i) }))}
          />
        ))}
      </div>

      {adding ? (
        <div className="addskill">
          <input
            className="rename"
            autoFocus
            placeholder="Item name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={addSkill}
            onKeyDown={(e) => {
              if (e.key === "Enter") addSkill();
              if (e.key === "Escape") { setNewName(""); setAdding(false); }
            }}
          />
        </div>
      ) : (
        <button className="add-row" onClick={() => setAdding(true)}>+ Add item</button>
      )}
    </section>
  );
}

function FloatLayer({ floats }) {
  return (
    <div className="floats">
      {floats.map((f) => (
        <span key={f.id} className={"float" + (f.big ? " big" : "")} style={{ left: f.x, top: f.y, color: f.color }}>{f.text}</span>
      ))}
    </div>
  );
}

/* ---------- app ---------- */
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [state, setState] = useState(() => SD.load());
  const [floats, setFloats] = useState([]);
  const [celebrate, setCelebrate] = useState(null);
  const fx = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { SD.save(state); }, [state]);

  // apply theme + accent colors
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--accent", t.accent);
    r.style.setProperty("--neg", t.neg);
    r.style.removeProperty("--bg"); // let CSS data-theme rule control bg
    r.style.setProperty("--font", `'${t.font}', system-ui, sans-serif`);
    r.dataset.density = t.density;
    r.dataset.theme = state.theme || "notion-dark";
    r.dataset.dark = (state.theme || "notion-dark") === "notion-dark" ? "1" : "0";
  }, [t.accent, t.neg, t.font, t.density, state.theme]);

  const setTheme = (th) => setState((s) => ({ ...s, theme: th }));

  const bal = SD.balance(state);

  const spawnFloat = useCallback((e, color, text, big) => {
    const x = (e && e.clientX) || window.innerWidth / 2;
    const y = (e && e.clientY) || window.innerHeight / 2;
    const id = Math.random().toString(36).slice(2);
    setFloats((f) => [...f, { id, x: x - (big ? 18 : 8), y: y - 18, color, text, big }]);
    setTimeout(() => setFloats((f) => f.filter((it) => it.id !== id)), big ? 1100 : 850);
  }, []);

  // core leveling handler — functional update so rapid taps accumulate;
  // the resulting milestone is stashed in `fx` and animated from an effect.
  const onAdd = (catId, skillId, delta, e) => {
    const cx = e && e.clientX ? e.clientX : window.innerWidth / 2;
    const cy = e && e.clientY ? e.clientY : window.innerHeight / 2;
    setState((prev) => {
      const cat = prev.categories.find((c) => c.id === catId);
      if (!cat) return prev;
      const sk = cat.skills.find((s) => s.id === skillId);
      if (!sk) return prev;
      const color = cat.polarity === "negative" ? t.neg : t.accent;
      const res = SD.applyPoints(sk, delta, prev.stageCost, prev.maxLevel);
      if (delta > 0) {
        fx.current = {
          event: res.event,
          color,
          cx,
          cy,
          delta,
          stageName: SD.stageFor(res.skill.level, cat.polarity),
          sub: `${cat.name} · ${res.skill.name}`,
        };
      }
      return {
        ...prev,
        categories: prev.categories.map((c) =>
          c.id !== catId ? c : { ...c, skills: c.skills.map((s) => (s.id === skillId ? res.skill : s)) }
        ),
      };
    });
  };

  // consume the stashed milestone and play the right animation
  useEffect(() => {
    const f = fx.current;
    if (!f) return;
    fx.current = null;
    const e = { clientX: f.cx, clientY: f.cy };
    if (f.event === "stage") {
      setCelebrate({ title: "Stage Up", big: f.stageName, sub: f.sub, color: f.color });
      setTimeout(() => setCelebrate(null), 1800);
      spawnFloat(e, f.color, "+1 STAGE", true);
    } else if (f.event === "charge") {
      spawnFloat(e, f.color, "+30", true);
    } else if (f.event === "max") {
      spawnFloat(e, f.color, "MAX", true);
    } else {
      spawnFloat(e, f.color, "+" + f.delta);
    }
  }, [state]);

  const mutateCat = (catId) => (updater) => {
    setState((s) => {
      if (updater === null) return { ...s, categories: s.categories.filter((c) => c.id !== catId) };
      return { ...s, categories: s.categories.map((c) => (c.id === catId ? updater(c) : c)) };
    });
  };

  const addCategory = (polarity) => {
    setState((s) => ({
      ...s,
      categories: [...s.categories, { id: SD.uid("c"), name: polarity === "negative" ? "New Negative" : "New Positive", polarity, skills: [] }],
    }));
  };

  const doReset = () => { if (confirm("Reset to the dataset's starting values?")) setState(SD.reset()); };

  const doExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (state.title || "skill-chart").replace(/\s+/g, "-").toLowerCase() + ".json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed && Array.isArray(parsed.categories)) setState(parsed);
        else alert("That file doesn't look like a chart.");
      } catch (err) { alert("Could not read that file."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // build radar groups — one wedge polygon per category
  const sc = state.stageCost || 8;
  const maxRate = state.maxRate || 30;
  const groups = state.categories.map((c) => {
    const color = c.polarity === "negative" ? t.neg : t.accent;
    const axes = c.skills.map((s) => {
      if (t.radarMetric === "rate") {
        return { label: s.name, value: s.rate, max: 30, color };
      }
      const frac = SD.fracStage(s, sc);
      return { label: s.name, value: frac, max: state.maxLevel, color };
    });
    return { name: c.name, color, axes };
  });

  const [editTitle, setEditTitle] = useState(false);
  const totalSkills = state.categories.reduce((a, c) => a + c.skills.length, 0);
  const share = Math.round(bal.share);
  const netSign = bal.net > 0 ? "+" : "";

  return (
    <div className="app">
      <FloatLayer floats={floats} />
      {celebrate && (
        <div className="celebrate">
          <div className="celebrate-card" style={{ "--ce": celebrate.color }}>
            <span className="ce-kicker">{celebrate.title}</span>
            <span className="ce-num">{celebrate.big}</span>
            <span className="ce-sub">{celebrate.sub}</span>
          </div>
        </div>
      )}

      <header className="topbar">
        <div className="brand">
          {editTitle ? (
            <input
              className="rename title-rename"
              autoFocus
              value={state.title}
              onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
              onBlur={() => setEditTitle(false)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          ) : (
            <h1 className="title" onClick={() => setEditTitle(true)} title="Rename chart">{state.title}</h1>
          )}

        </div>
        <div className="actions">
          <button className="ghost" onClick={() => fileRef.current.click()}>Import</button>
          <button className="ghost" onClick={doExport}>Export</button>
          <button className="ghost danger" onClick={doReset}>Reset</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
        </div>
      </header>

      <main className={"layout" + (t.showRadar ? "" : " noradar")}>
        {t.showRadar && (
          <aside className="viz">
            <div className="balancecard">
              <div className="lvl-ring" style={{ "--pct": share }}>
                <div className="lvl-inner">
                  <span className="lvl-kick">Net</span>
                  <span className="lvl-big">{netSign}{bal.net}</span>
                </div>
              </div>
              <div className="lvl-meta">
                <div className="bal-row"><span className="bal-dot pos" /> Positive <b>{bal.posRate}</b></div>
                <div className="bal-row"><span className="bal-dot neg" /> Negative <b>{bal.negRate}</b></div>
                <div className="mini-track"><span style={{ width: share + "%" }} /></div>
                <div className="bal-share">{share}% positive · effort points</div>
              </div>
            </div>

            <RadarChart groups={groups} />

            {/* quick controls below radar */}
            <div className="viz-controls">
              <div className="vc-row">
                <span className="vc-label">Theme</span>
                <div className="vc-pills">
                  <button className={"vc-pill" + (state.theme === "notion-dark" ? " on" : "")} onClick={() => setTheme("notion-dark")}>Dark</button>
                  <button className={"vc-pill" + (state.theme === "notion-light" ? " on" : "")} onClick={() => setTheme("notion-light")}>Light</button>
                </div>
              </div>
              <div className="vc-row">
                <span className="vc-label">Cycles / stage</span>
                <div className="vc-pills">
                  {[1,2,3,4,5].map((n) => (
                    <button key={n} className={"vc-pill" + (sc === n ? " on" : "")} onClick={() => setState((s) => ({ ...s, stageCost: n }))}>{n}</button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        )}

        <div className="board">
          {state.categories.map((c) => (
            <Category key={c.id} cat={c} max={state.maxLevel} maxRate={maxRate} stageCost={sc} accent={t.accent} neg={t.neg} step={t.pointsPerTap} onMutate={mutateCat(c.id)} onAdd={onAdd} />
          ))}
          <div className="add-cats">
            <button className="add-cat" onClick={() => addCategory("positive")}>+ Positive category</button>
            <button className="add-cat" onClick={() => addCategory("negative")}>+ Negative category</button>
          </div>
        </div>
      </main>

      <TweaksPanel>
        <TweakSection label="Leveling" />
        <TweakRadio label="Points per tap" value={t.pointsPerTap} options={[1, 5, 10]} onChange={(v) => setTweak("pointsPerTap", v)} />
        <TweakSection label="Look" />
        <TweakColor label="Positive color" value={t.accent} options={["#1F8A5B", "#5B5BD6", "#0E7490", "#9333EA", "#1A1916"]} onChange={(v) => setTweak("accent", v)} />
        <TweakColor label="Negative color" value={t.neg} options={["#C2410C", "#B91C1C", "#A16207", "#7C3AED", "#525252"]} onChange={(v) => setTweak("neg", v)} />
        <TweakSelect label="Font" value={t.font} options={["Space Grotesk", "DM Sans", "IBM Plex Sans", "Fraunces"]} onChange={(v) => setTweak("font", v)} />
        <TweakRadio label="Density" value={t.density} options={["compact", "regular", "comfy"]} onChange={(v) => setTweak("density", v)} />
        <TweakSection label="Radar" />
        <TweakToggle label="Show radar" value={t.showRadar} onChange={(v) => setTweak("showRadar", v)} />
        <TweakRadio label="Metric" value={t.radarMetric} options={["rate", "level"]} onChange={(v) => setTweak("radarMetric", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
