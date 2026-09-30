/* ------------------------------------------------------------------
   timer.js — a plain countdown timer with h/m/s inputs, quick
   presets, +1 minute while running, chime + title flash when done.
   Uses an absolute end timestamp, so it stays accurate even when
   the tab is throttled or backgrounded.
------------------------------------------------------------------- */
"use strict";

(function () {

  /* ---------------- state ---------------- */
  let total = 0;          // configured duration (ms)
  let lastTotal = 0;      // last duration that was started (for "Run again")
  let endTs = null;      // running: timestamp when it finishes
  let remaining = 0;     // paused: ms left
  let running = false;
  let tickTimer = null;

  const PRESETS = [
    ["1m", 1], ["3m", 3], ["5m", 5], ["10m", 10],
    ["15m", 15], ["25m", 25], ["45m", 45], ["1h", 60]
  ];

  /* ---------------- helpers ---------------- */

  function inputsTotal() {
    const h = Math.max(0, parseInt($("inH").value, 10) || 0);
    const m = Math.max(0, parseInt($("inM").value, 10) || 0);
    const s = Math.max(0, parseInt($("inS").value, 10) || 0);
    return ((h * 60 + m) * 60 + s) * 1000;
  }

  function writeInputs(ms) {
    const t = Math.floor(ms / 1000);
    $("inH").value = Math.floor(t / 3600);
    $("inM").value = Math.floor((t % 3600) / 60);
    $("inS").value = t % 60;
  }

  function render() {
    const clock = $("timerClock");
    if (running) {
      const left = Math.max(0, endTs - Date.now());
      clock.textContent = fmtMS(left);
      clock.classList.remove("done");
      document.title = fmtMS(left) + " \u00b7 Timer";
    } else {
      clock.textContent = fmtMS(remaining || total);
      clock.classList.toggle("done", false);
      if (!tickTimer) document.title = "Timer \u00b7 time tools";
    }

    const phase = $("timerPhase");
    phase.textContent = running ? "counting down" : (remaining > 0 && remaining < total ? "paused" : "ready");

    $("startBtn").textContent = running ? "Pause" : (remaining > 0 && remaining < total ? "Resume" : "Start");
    $("startBtn").disabled = !running && total <= 0 && remaining <= 0;
    $("resetBtn").disabled = !running && remaining <= 0 && total <= 0;
    $("plusBtn").disabled = !running && remaining <= 0;
  }

  function setInputsEnabled(on) {
    ["inH", "inM", "inS"].forEach(id => { $(id).disabled = !on; });
    document.querySelectorAll("#presets .btn").forEach(b => { b.disabled = !on; });
  }

  /* ---------------- engine ---------------- */

  function start() {
    if (running) return;
    if (remaining <= 0) {
      total = inputsTotal();
      remaining = total;
    }
    if (remaining <= 0) { toast("Set a duration first"); return; }
    lastTotal = Math.max(lastTotal, remaining);
    endTs = Date.now() + remaining;
    running = true;
    setInputsEnabled(false);
    requestNotifyPermission();
    stopFlashTitle();
    clearInterval(tickTimer);
    tickTimer = setInterval(tick, 200);
    render();
  }

  function pause() {
    if (!running) return;
    remaining = Math.max(0, endTs - Date.now());
    running = false;
    clearInterval(tickTimer);
    render();
  }

  function tick() {
    if (!running) return;
    if (Date.now() >= endTs) {
      running = false;
      clearInterval(tickTimer);
      onDone();
    } else {
      render();
    }
  }

  function onDone() {
    remaining = 0;
    total = 0;
    writeInputs(0);
    setInputsEnabled(true);
    playChime("end");
    notify("Timer finished!", "Your countdown is done.");
    flashTitle("\u23f0 Timer done!");
    const clock = $("timerClock");
    clock.textContent = "00:00";
    clock.classList.add("done");
    const phase = $("timerPhase");
    phase.textContent = "finished";
    $("startBtn").textContent = "Start";
    $("startBtn").disabled = true;
    $("resetBtn").disabled = false;
    $("plusBtn").disabled = true;
    $("doneBanner").hidden = false;
    document.title = "Timer \u00b7 time tools";
  }

  function runAgain() {
    reset();
    total = lastTotal;
    remaining = lastTotal;
    start();
  }

  function reset() {
    running = false;
    clearInterval(tickTimer);
    remaining = 0;
    total = 0;
    writeInputs(0);
    setInputsEnabled(true);
    stopFlashTitle();
    render();
  }

  function addMinute() {
    if (running) {
      endTs += 60000;
      total += 60000;
    } else if (remaining > 0) {
      remaining += 60000;
      total = Math.max(total, remaining);
      render();
    }
  }

  /* ---------------- wiring ---------------- */

  function init() {
    writeInputs(0);

    for (const [label, mins] of PRESETS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn";
      b.textContent = label;
      b.addEventListener("click", () => {
        reset();
        writeInputs(mins * 60000);
        total = mins * 60000;
        render();
      });
      $("presets").appendChild(b);
    }

    ["inH", "inM", "inS"].forEach(id => {
      $(id).addEventListener("input", () => {
        total = inputsTotal();
        remaining = 0;
        render();
      });
    });

    $("startBtn").addEventListener("click", () => { running ? pause() : start(); });
    $("resetBtn").addEventListener("click", reset);
    $("plusBtn").addEventListener("click", addMinute);
    $("dismissBtn").addEventListener("click", reset);
    $("againBtn").addEventListener("click", runAgain);

    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT") return;
      if (e.code === "Space") { e.preventDefault(); running ? pause() : start(); }
      else if (e.key === "r" || e.key === "R") reset();
    });

    render();
  }

  init();
})();
