/* Skill Chart — data model + persistence (plain JS, attaches to window.SkillData) */
(function () {
  const STORE_KEY = "skillchart.v2";

  // Stage names by polarity. Index 0 = unset, 1..3 = the dataset's stage names.
  const STAGES = {
    positive: ["Unset", "Zero", "Positive", "Positive \u221E"],
    negative: ["Unset", "Below Zero", "Negative", "Negative \u221E"],
  };

  function stageFor(level, polarity) {
    const arr = STAGES[polarity] || STAGES.positive;
    const i = Math.max(0, Math.min(arr.length - 1, level));
    return arr[i];
  }

  let _id = 1;
  const uid = (p) => `${p}_${(_id++).toString(36)}${Date.now().toString(36).slice(-3)}`;

  // From uploads/Dataset.xlsx — Positive & Negative categories,
  // each item carrying a Stage (level out of 3) and a Rate (out of 30).
  // Leveling model: tapping adds points -> fill 30 = 1 cycle -> N cycles = +1 stage.
  function defaultState() {
    const mk = (name, level, rate) => ({ id: uid("s"), name, level, rate, charges: 0 });
    return {
      title: "Life Balance Chart",
      maxLevel: 3,
      maxRate: 30,
      stageCost: 3,
      theme: "notion-dark",
      categories: [
        {
          id: uid("c"),
          name: "Positive",
          polarity: "positive",
          skills: [
            mk("Internship", 1, 3),
            mk("Gym & Food", 1, 2),
            mk("Freelance", 1, 1),
            mk("YouTube", 1, 4),
            mk("Tutoring", 1, 1),
            mk("CLEP (History)", 1, 1),
            mk("Structure", 1, 1),
            mk("Think Tank", 1, 10),
            mk("Research", 1, 2),
          ],
        },
        {
          id: uid("c"),
          name: "Negative",
          polarity: "negative",
          skills: [
            mk("Screen Time", 1, 10),
            mk("Laziness", 1, 3),
            mk("Inefficiency", 1, 2),
            mk("Lack of Physical Fitness", 1, 3),
            mk("Waste of Resources", 1, 1),
          ],
        },
      ],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.categories)) return defaultState();
      if (!parsed.maxRate) parsed.maxRate = 30;
      if (!parsed.stageCost) parsed.stageCost = 3;
      if (!parsed.theme) parsed.theme = "notion-dark";
      // backfill polarity / rate / charges for any older saves
      parsed.categories.forEach((c, i) => {
        if (!c.polarity) c.polarity = i === parsed.categories.length - 1 && /neg/i.test(c.name) ? "negative" : "positive";
        c.skills.forEach((s) => { if (typeof s.rate !== "number") s.rate = 1; if (typeof s.charges !== "number") s.charges = 0; });
      });
      return parsed;
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function reset() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    return defaultState();
  }

  // ----- leveling mechanic -----
  // Add `delta` points to a skill, cascading: 30 points = 1 cycle, `stageCost`
  // cycles = +1 stage. Returns the new skill + which milestone fired.
  function applyPoints(skill, delta, stageCost, maxStage) {
    let level = skill.level == null ? 1 : skill.level;
    let points = skill.rate || 0;
    let charges = skill.charges || 0;
    let event = "point";
    points += delta;
    // cascade up
    while (points >= 30) {
      points -= 30;
      charges += 1;
      event = "charge";
      if (charges >= stageCost) {
        if (level < maxStage) { level += 1; charges = 0; event = "stage"; }
        else { charges = stageCost; points = 30; event = "max"; break; }
      }
    }
    // cascade down
    while (points < 0) {
      if (charges > 0) { charges -= 1; points += 30; }
      else if (level > 0) { level -= 1; charges = stageCost - 1; points += 30; }
      else { points = 0; charges = 0; break; }
    }
    return { skill: Object.assign({}, skill, { level: level, rate: points, charges: charges }), event: event };
  }

  // Total accumulated effort for a skill, in points.
  function effort(skill, stageCost) {
    const lvl = Math.max(0, (skill.level || 0) - 1);
    return (lvl * stageCost + (skill.charges || 0)) * 30 + (skill.rate || 0);
  }

  // Fractional stage 1..maxStage for a smooth radar.
  function fracStage(skill, stageCost) {
    const base = skill.level || 0;
    return base + ((skill.charges || 0) * 30 + (skill.rate || 0)) / (stageCost * 30) - 1 + 1;
  }

  // ----- derived stats -----
  function categoryAvg(cat) {
    if (!cat.skills.length) return 0;
    return cat.skills.reduce((a, s) => a + s.level, 0) / cat.skills.length;
  }

  function sumRate(cat) {
    return cat.skills.reduce((a, s) => a + (s.rate || 0), 0);
  }

  // Positive vs negative balance, driven by total accumulated effort.
  function balance(state) {
    const sc = state.stageCost || 8;
    let posRate = 0, negRate = 0;
    state.categories.forEach((c) => {
      c.skills.forEach((s) => {
        const e = effort(s, sc);
        if (c.polarity === "negative") negRate += e;
        else posRate += e;
      });
    });
    const net = posRate - negRate;
    const total = posRate + negRate;
    const share = total ? (posRate / total) * 100 : 50;
    return { posRate, negRate, net, total, share };
  }

  // Coarse milestone for the celebrate animation (rises every 5 net points).
  function milestone(state) {
    return Math.floor(balance(state).net / 5);
  }

  window.SkillData = {
    STORE_KEY,
    STAGES,
    stageFor,
    uid,
    defaultState,
    load,
    save,
    reset,
    applyPoints,
    effort,
    fracStage,
    categoryAvg,
    sumRate,
    balance,
    milestone,
  };
})();
