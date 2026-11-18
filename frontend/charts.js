// charts.js — tiny dependency-free SVG charts (line + bar) with hover tooltips.
// Used by the Humidity and Air pages. Requires common.js.

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

// Bar with rounded top corners, anchored flat on the baseline.
function roundedTopBar(x, y, w, h, r = 4) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Draw (and keep redrawing on resize) a chart into `container`.
 *
 * options:
 *   type        "line" | "bar"
 *   data        [{ label, value }]  — label is shown on the x axis / tooltip
 *   yMax        top of the y scale
 *   yMin        bottom of the y scale (default 0)
 *   yTicks      values for gridlines
 *   color       series colour (line), or colorFor(value) for per-bar colours
 *   formatValue value -> tooltip headline
 *   formatNote  datum -> tooltip second line
 *   labelEvery  show every Nth x label
 *   ariaLabel   accessible description of the chart
 */
function mountChart(container, options) {
  container._chartOptions = options;
  drawChart(container);

  if (!container._chartObserver) {
    let lastWidth = container.clientWidth;
    container._chartObserver = new ResizeObserver(() => {
      if (container.clientWidth !== lastWidth) {
        lastWidth = container.clientWidth;
        drawChart(container);
      }
    });
    container._chartObserver.observe(container);
  }
}

function drawChart(container) {
  const {
    type = "line",
    data,
    yMax,
    yMin = 0, // bottom of the y scale (tides can go below zero)
    yTicks,
    color = "var(--series-1)",
    colorFor,
    formatValue = (v) => String(v),
    formatNote = (d) => d.label,
    labelEvery = 3,
    ariaLabel = "",
    height = 220,
  } = container._chartOptions;

  container.classList.add("chart");
  container.replaceChildren();
  if (!data.length) return;

  const width = Math.max(container.clientWidth, 280);
  const m = { top: 10, right: 6, bottom: 26, left: 36 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;

  const step = type === "bar" ? w / data.length : w / Math.max(data.length - 1, 1);
  const xCenter = (i) => (type === "bar" ? m.left + step * i + step / 2 : m.left + step * i);
  const y = (v) => m.top + h - ((Math.max(yMin, Math.min(v, yMax)) - yMin) / (yMax - yMin)) * h;

  const svg = svgEl("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": ariaLabel });

  // Gridlines + y labels (recessive)
  for (const t of yTicks) {
    svg.append(
      svgEl("line", { class: t === yMin ? "baseline" : "grid-line", x1: m.left, x2: width - m.right, y1: y(t), y2: y(t) })
    );
    const label = svgEl("text", { class: "tick", x: m.left - 8, y: y(t) + 4, "text-anchor": "end" });
    label.textContent = t;
    svg.append(label);
  }

  // X labels
  data.forEach((d, i) => {
    if (i % labelEvery !== 0) return;
    const label = svgEl("text", { class: "tick", x: xCenter(i), y: height - 6, "text-anchor": "middle" });
    label.textContent = d.label;
    svg.append(label);
  });

  // Marks
  const marks = [];
  if (type === "line") {
    const points = data.map((d, i) => [xCenter(i), y(d.value)]);
    const line = points.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join("");
    const baseY = y(yMin);
    svg.append(
      svgEl("path", {
        d: `${line}L${points[points.length - 1][0]},${baseY}L${points[0][0]},${baseY}Z`,
        fill: color,
        "fill-opacity": 0.1,
      }),
      svgEl("path", { d: line, fill: "none", stroke: color, "stroke-width": 2, "stroke-linejoin": "round" })
    );
  } else {
    const gap = Math.min(2, step * 0.2); // 2px surface gap between bars
    data.forEach((d, i) => {
      const x0 = m.left + step * i + gap / 2;
      const barW = Math.max(step - gap, 1);
      const top = y(d.value);
      const bar = svgEl("path", {
        d: roundedTopBar(x0, top, barW, Math.max(m.top + h - top, 0)),
        fill: colorFor ? colorFor(d.value) : color,
      });
      marks.push(bar);
      svg.append(bar);
    });
  }

  // Hover layer: crosshair + dot for lines, highlight for bars
  const crosshair = svgEl("line", { class: "crosshair", y1: m.top, y2: m.top + h, visibility: "hidden" });
  const dot = svgEl("circle", { r: 4, fill: color, stroke: "#fff", "stroke-width": 2, visibility: "hidden" });
  if (type === "line") svg.append(crosshair, dot);

  const hit = svgEl("rect", { x: m.left, y: m.top, width: w, height: h, fill: "transparent" });
  svg.append(hit);

  const tip = document.createElement("div");
  tip.className = "chart-tip";
  tip.hidden = true;

  const show = (i) => {
    const d = data[i];
    const cx = xCenter(i);

    if (type === "line") {
      crosshair.setAttribute("x1", cx);
      crosshair.setAttribute("x2", cx);
      crosshair.setAttribute("visibility", "visible");
      dot.setAttribute("cx", cx);
      dot.setAttribute("cy", y(d.value));
      dot.setAttribute("visibility", "visible");
    } else {
      marks.forEach((bar, j) => bar.setAttribute("opacity", j === i ? 1 : 0.45));
    }

    tip.innerHTML = `<strong>${escapeHtml(formatValue(d.value, d))}</strong><span>${escapeHtml(formatNote(d))}</span>`;
    tip.hidden = false;
    const half = tip.offsetWidth / 2;
    tip.style.left = `${Math.min(Math.max(cx, half), width - half)}px`;
    tip.style.top = `${Math.max(y(d.value) - tip.offsetHeight - 12, 0)}px`;
  };

  const hide = () => {
    tip.hidden = true;
    crosshair.setAttribute("visibility", "hidden");
    dot.setAttribute("visibility", "hidden");
    marks.forEach((bar) => bar.setAttribute("opacity", 1));
  };

  hit.addEventListener("pointermove", (e) => {
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left - m.left;
    const i = type === "bar" ? Math.floor(px / step) : Math.round(px / step);
    show(Math.max(0, Math.min(data.length - 1, i)));
  });
  hit.addEventListener("pointerleave", hide);

  container.append(svg, tip);
}
