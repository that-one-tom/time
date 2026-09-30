/* ------------------------------------------------------------------
   stopwatch.js — start/stop/lap/reset with centisecond precision.
   Uses performance.now() and accumulated elapsed, so it never drifts.
   Laps are listed newest-first with best/worst highlighting.
------------------------------------------------------------------- */
"use strict";

(function () {

  /* ---------------- state ---------------- */
  let running = false;
  let startStamp = 0;     // performance.now() when the current run started
  let accumulated = 0;   // ms accumulated across previous run(s)
  let laps = [];         // [{ total: ms }] — cumulative time at each lap press
  let raf = null;

  function elapsed() {
    return accumulated + (running ? performance.now() - startStamp : 0);
  }

  /* ---------------- display ---------------- */

  function render() {
    $("swClock").textContent = fmtStopwatch(elapsed());
    $("startBtn").textContent = running ? "Stop" : "Start";
    $("lapBtn").disabled = !running;
    $("resetBtn").disabled = running ? false : elapsed() === 0 && !laps.length;
    document.title = running
      ? fmtStopwatch(elapsed()) + " \u00b7 Stopwatch \u2014 time tools"
      : "Stopwatch \u2014 time tools";
  }

  function loop() {
    if (!running) { raf = null; return; }
    $("swClock").textContent = fmtStopwatch(elapsed());
    document.title = fmtStopwatch(elapsed()) + " \u00b7 Stopwatch";
    raf = requestAnimationFrame(loop);
  }

  /* ---------------- actions ---------------- */

  function startStop() {
    if (running) {
      accumulated += performance.now() - startStamp;
      running = false;
      cancelAnimationFrame(raf);
      raf = null;
    } else {
      startStamp = performance.now();
      running = true;
      raf = requestAnimationFrame(loop);
    }
    render();
  }

  function lap() {
    if (!running) return;
    const total = elapsed();
    laps.push({ total: total });
    renderLaps();
  }

  function reset() {
    running = false;
    accumulated = 0;
    laps = [];
    cancelAnimationFrame(raf);
    raf = null;
    renderLaps();
    render();
  }

  /* ---------------- lap table ---------------- */

  function renderLaps() {
    const box = $("laps");
    if (!laps.length) {
      box.innerHTML = "";
      box.hidden = true;
      return;
    }
    box.hidden = false;

    const durations = [];
    for (let i = 0; i < laps.length; i++) {
      const prev = i === 0 ? 0 : laps[i - 1].total;
      durations.push(laps[i].total - prev);
    }
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    let html = "<h3>Laps (" + laps.length + ")</h3>" +
      '<table class="lap-table"><thead><tr><th>Lap</th><th>Lap time</th><th>Total</th><th></th></tr></thead><tbody>';
    for (let i = laps.length - 1; i >= 0; i--) {
      const d = durations[i];
      const note =
        durations.length < 2 ? "" :
        d === min ? "fastest" :
        d === max ? "slowest" : "";
      const cls = durations.length < 2 ? "" : d === min ? "best" : d === max ? "worst" : "";
      html += "<tr><td>" + (i + 1) + "</td>" +
        '<td class="' + cls + '">' + fmtStopwatch(d) + "</td>" +
        "<td>" + fmtStopwatch(laps[i].total) + "</td>" +
        '<td class="note">' + note + "</td></tr>";
    }
    html += "</tbody></table>";
    box.innerHTML = html;
  }

  /* ---------------- wiring ---------------- */

  function init() {
    $("startBtn").addEventListener("click", startStop);
    $("lapBtn").addEventListener("click", lap);
    $("resetBtn").addEventListener("click", reset);

    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT") return;
      if (e.code === "Space") { e.preventDefault(); startStop(); }
      else if (e.key === "l" || e.key === "L") lap();
      else if (e.key === "r" || e.key === "R") reset();
    });

    render();
  }

  init();
})();
