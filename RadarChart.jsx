/* RadarChart — dual (multi) wedge polygon radar.
   Each category gets a proportional sector; its skills are the spokes within that sector.
   Accepts: groups=[{name, color, axes:[{label, value, max, sub}]}], size
   Exports: window.RadarChart */
(function () {
  const { useRef, useEffect, useState } = React;

  function polar(cx, cy, r, angleDeg) {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  function RadarChart({ groups, size = 500 }) {
    const cx = size / 2, cy = size / 2;
    const R = size * 0.27;
    const rings = 4;

    // flatten all axes: [{label, value, max, sub, color, groupIdx}]
    const allAxes = [];
    groups.forEach((g, gi) =>
      (g.axes || []).forEach((a) =>
        allAxes.push({ ...a, color: g.color, groupIdx: gi })
      )
    );
    const N = Math.max(allAxes.length, 3);

    // each spoke equally spaced
    const angleAt = (i) => (i / N) * 360;

    // group start indices and mid-angles (for sector labels)
    let running = 0;
    const gMeta = groups.map((g) => {
      const startIdx = running;
      running += (g.axes || []).length;
      const endIdx = running;
      const midAngle = ((startIdx + endIdx) / 2 / N) * 360;
      return { startIdx, endIdx, midAngle };
    });

    // boundary angles between categories (skip first — no boundary before group 0)
    const boundaries = gMeta.slice(1).map((m) => (m.startIdx / N) * 360);

    // animate fractional values
    const targets = allAxes.map((a) =>
      a.max ? Math.max(0, Math.min(1, a.value / a.max)) : 0
    );
    const [vals, setVals] = useState(() => targets.map(() => 0));
    const raf = useRef(0);
    const cur = useRef(targets.map(() => 0));

    const depsKey = allAxes.map((a) => a.value).join(",") + "|" + N;
    useEffect(() => {
      cancelAnimationFrame(raf.current);
      const from = cur.current.slice();
      while (from.length < targets.length) from.push(0);
      from.length = targets.length;
      const start = performance.now();
      const dur = 500;
      const tick = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        const next = targets.map((tv, i) => from[i] + (tv - from[i]) * e);
        cur.current = next;
        setVals(next);
        if (t < 1) raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf.current);
      // eslint-disable-next-line
    }, [depsKey]);

    const gridColor = "var(--line)";

    // sector background polygon (at full R) for each group — very faint tint
    const sectorBg = groups.map((g, gi) => {
      const { startIdx, endIdx } = gMeta[gi];
      const count = endIdx - startIdx;
      if (count <= 0) return null;
      const pts = [];
      for (let i = startIdx; i < endIdx; i++) {
        const [x, y] = polar(cx, cy, R, angleAt(i));
        pts.push(`${x},${y}`);
      }
      return { color: g.color, pts: `${cx},${cy} ${pts.join(" ")}` };
    }).filter(Boolean);

    // per-group wedge polygon (animated, from center through value-dots)
    const wedges = groups.map((g, gi) => {
      const { startIdx, endIdx } = gMeta[gi];
      const pts = [];
      for (let i = startIdx; i < endIdx; i++) {
        const frac = vals[i] ?? 0;
        const [x, y] = polar(cx, cy, Math.max(0, frac) * R, angleAt(i));
        pts.push(`${x},${y}`);
      }
      return { color: g.color, pts: `${cx},${cy} ${pts.join(" ")}` };
    });

    return (
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="radar"
        role="img"
        aria-label="Multi-category skill radar"
        style={{ overflow: "visible" }}
      >
        {/* grid rings */}
        {Array.from({ length: rings }).map((_, ri) => {
          const rr = (R * (ri + 1)) / rings;
          const pts = Array.from({ length: N })
            .map((_, i) => polar(cx, cy, rr, angleAt(i)).join(","))
            .join(" ");
          return (
            <polygon key={"ring" + ri} points={pts} fill="none" stroke={gridColor} strokeWidth={ri === rings - 1 ? 1.5 : 0.8} />
          );
        })}

        {/* spokes */}
        {allAxes.map((_, i) => {
          const [x, y] = polar(cx, cy, R, angleAt(i));
          return <line key={"sp" + i} x1={cx} y1={cy} x2={x} y2={y} stroke={gridColor} strokeWidth="0.8" />;
        })}

        {/* sector background tints */}
        {sectorBg.map((s, i) => (
          <polygon key={"bg" + i} points={s.pts} fill={s.color} fillOpacity="0.04" stroke="none" />
        ))}

        {/* boundary dividers between groups */}
        {boundaries.map((ang, i) => {
          const [x, y] = polar(cx, cy, R * 1.04, ang);
          return (
            <line key={"div" + i} x1={cx} y1={cy} x2={x} y2={y}
              stroke="var(--surface)" strokeWidth="3" />
          );
        })}

        {/* per-group wedge polygon (filled, animated) */}
        {wedges.map((w, i) => (
          <polygon
            key={"wedge" + i}
            points={w.pts}
            fill={w.color}
            fillOpacity="0.18"
            stroke={w.color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ))}

        {/* vertex dots */}
        {allAxes.map((a, i) => {
          const frac = vals[i] ?? 0;
          const [x, y] = polar(cx, cy, Math.max(0, frac) * R, angleAt(i));
          return (
            <circle key={"dot" + i} cx={x} cy={y} r="3.5"
              fill={a.color} stroke="var(--surface)" strokeWidth="1.5" />
          );
        })}

        {/* spoke labels — name only, no sub */}
        {allAxes.map((a, i) => {
          const ang = angleAt(i);
          const [lx, ly] = polar(cx, cy, R + 22, ang);
          let anchor = "middle";
          if (ang > 8 && ang < 172) anchor = "start";
          else if (ang > 188 && ang < 352) anchor = "end";
          const baseline = ang > 95 && ang < 265 ? 4 : 0;
          return (
            <text key={"lbl" + i} x={lx} y={ly + baseline} textAnchor={anchor}
              className="radar-label" style={{ fill: a.color }}>
              {a.label}
            </text>
          );
        })}
      </svg>
    );
  }

  window.RadarChart = RadarChart;
})();
