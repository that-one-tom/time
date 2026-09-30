/* ------------------------------------------------------------------
   pomodoro.js — classic pomodoro: focus / short break / long break.
   25/5/15 by default, fully configurable, auto-start options,
   session counter, chime + notification + title flash on completion.
   Timestamp-based, so the countdown stays accurate even if the
   tab is throttled.
------------------------------------------------------------------- */
"use strict";

(function () {

  const LS_KEY = "tfyi.pomodoro";
  const LS_DONE = "tfyi.pomodoro.done";

  const MODES = {
    focus: { label: "Focus",       ring: "var(--accent)", cls: "chip-accent" },
    short: { label: "Short break", ring: "var(--good)",   cls: "chip-good" },
    long:  { label: "Long break",  ring: "var(--info)",   cls: "chip-info" }
  };

  /* ---------------- state ---------------- */
  let settings = {
    focus: 25, short: 5, long: 15,
    longEvery: 4,
    autoStartBreaks: true,
    autoStartFocus: false,
    sound: true
  };

  let mode = "focus";         // current mode
  let duration = 0;           // ms for the current mode
  let endTs = null;          // running: timestamp when it finishes
  let remaining = null;      // paused: ms left
  let running = false;
  let completed = parseInt(lsGet(LS_DONE, "0"), 10) || 0;  // finished pomodoros (all time)
  let cycle = 0;              // pomodoros since last long break
  let tickTimer = null;

  function loadSettings() {
    const raw = lsGet(LS_KEY, null);
    if (raw) {
      try { Object.assign(settings, JSON.parse(raw)); } catch (e) { /* ignore */ }
    }
    // sanity clamp
    settings.focus = Math.min(600, Math.max(1, +settings.focus || 25));
    settings.short = Math.min(600, Math.max(1, +settings.short || 5));
    settings.long = Math.min(600, Math.max(1, +settings.long || 15));
    settings.longEvery = Math.min(12, Math.max(1, +settings.longEvery || 4));
  }

  function saveSettings() { lsSet(LS_KEY, JSON.stringify(settings)); }

  function modeDuration(m) {
    return { focus: settings.focus, short: settings.short, long: settings.long }[m] * 60000;
  }

  /* ---------------- ring / display ---------------- */

  const C = 2 * Math.PI * 120; // circumference, r=120

  function render() {
    const left = running ? Math.max(0, endTs - Date.now()) : remaining;
    const frac = duration > 0 ? left / duration : 0;

    $("pomoTime").textContent = fmtMS(left);
    $("ringFg").style.strokeDashoffset = String(C * (1 - frac));
    $("ringFg").style.stroke = MODES[mode].ring;
    $("modeLabel").textContent = MODES[mode].label;
    $("modeLabel").className = "chip " + MODES[mode].cls;

    // cycle dots: filled dots = pomodoros done in this cycle
    const dots = $("pomoDots");
    dots.innerHTML = "";
    for (let i = 0; i < settings.longEvery; i++) {
      const d = document.createElement("span");
      d.className = "d" + (i < cycle ? " filled" : "");
      dots.appendChild(d);
    }

    $("startBtn").textContent = running ? "Pause" : (left < duration ? "Resume" : "Start");
    $("doneCount").textContent = completed + " pomodoro" + (completed === 1 ? "" : "s") + " completed in total";
    document.title = running
      ? fmtMS(left) + " \u00b7 " + MODES[mode].label
      : "Pomodoro timer \u00b7 time tools";
  }

  /* ---------------- engine ---------------- */

  function setMode(m, autoStart) {
    mode = m;
    duration = modeDuration(m);
    remaining = duration;
    endTs = null;
    running = false;
    clearInterval(tickTimer);
    if (autoStart) start();
    else render();
  }

  function start() {
    if (running || remaining <= 0) return;
    duration = Math.max(duration, remaining);
    endTs = Date.now() + remaining;
    running = true;
    requestNotifyPermission();
    clearInterval(tickTimer);
    tickTimer = setInterval(tick, 250);
    render();
  }

  function pause() {
    if (!running) return;
    remaining = Math.max(0, endTs - Date.now());
    running = false;
    endTs = null;
    clearInterval(tickTimer);
    render();
  }

  function tick() {
    if (!running) return;
    if (Date.now() >= endTs) {
      running = false;
      clearInterval(tickTimer);
      onComplete();
    } else {
      render();
    }
  }

  function onComplete() {
    playChime(mode === "focus" ? "end" : "up");

    if (mode === "focus") {
      completed += 1;
      cycle += 1;
      lsSet(LS_DONE, String(completed));
      const toLong = cycle >= settings.longEvery;
      if (toLong) cycle = 0;
      const next = toLong ? "long" : "short";
      notify("Pomodoro done!", "Time for a " + (toLong ? "long" : "short") + " break.");
      flashTitle("\ud83c\udf42 Focus session finished!");
      setMode(next, settings.autoStartBreaks);
    } else {
      notify("Break over", "Back to focus!");
      flashTitle("\u23f0 Break over, back to work!");
      setMode("focus", settings.autoStartFocus);
    }
    setTimeout(stopFlashTitle, 8000);
  }

  function skip() {
    // manual skip: counts a finished focus session, no auto-advance of the whole cycle
    if (mode === "focus") { cycle += 1; }
    const next = mode === "focus" ? (cycle >= settings.longEvery ? "long" : "short") : "focus";
    if (cycle >= settings.longEvery) cycle = 0;
    stopFlashTitle();
    setMode(next, false);
  }

  function reset() {
    stopFlashTitle();
    setMode(mode, false);
  }

  /* ---------------- settings UI ---------------- */

  function bindSettings() {
    const bind = (id, key, onChange) => {
      const el = $(id);
      el.value = settings[key];
      el.addEventListener("change", () => {
        const v = Math.max(1, Math.min(600, parseInt(el.value, 10) || 1));
        el.value = v;
        settings[key] = v;
        saveSettings();
        if (onChange) onChange();
      });
    };
    bind("setFocus", "focus", () => { if (mode === "focus" && !running) { duration = modeDuration("focus"); remaining = duration; render(); } });
    bind("setShort", "short", () => { if (mode === "short" && !running) { duration = modeDuration("short"); remaining = duration; render(); } });
    bind("setLong", "long", () => { if (mode === "long" && !running) { duration = modeDuration("long"); remaining = duration; render(); } });
    bind("setEvery", "longEvery", render);

    const bindCheck = (id, key) => {
      const el = $(id);
      el.checked = !!settings[key];
      el.addEventListener("change", () => { settings[key] = el.checked; saveSettings(); });
    };
    bindCheck("setAutoBreaks", "autoStartBreaks");
    bindCheck("setAutoFocus", "autoStartFocus");

    const soundEl = $("setSound");
    soundEl.checked = !!settings.sound;
    soundEl.addEventListener("change", () => {
      settings.sound = soundEl.checked;
      document.body.dataset.sound = soundEl.checked ? "on" : "off";
      saveSettings();
      if (soundEl.checked) playChime("up");
    });
  }

  /* ---------------- wiring ---------------- */

  function init() {
    loadSettings();
    document.body.dataset.sound = settings.sound ? "on" : "off";
    bindSettings();

    $("ringFg").style.strokeDasharray = String(C);
    $("ringFg").style.strokeDashoffset = "0";

    $("startBtn").addEventListener("click", () => { running ? pause() : start(); });
    $("resetBtn").addEventListener("click", reset);
    $("skipBtn").addEventListener("click", skip);

    // manual mode switching
    document.querySelectorAll("[data-mode]").forEach(el => {
      el.addEventListener("click", () => { stopFlashTitle(); setMode(el.dataset.mode, false); });
    });

    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT") return;
      if (e.code === "Space") { e.preventDefault(); running ? pause() : start(); }
      else if (e.key === "r" || e.key === "R") reset();
      else if (e.key === "s" || e.key === "S") skip();
    });

    setMode("focus", false);
  }

  init();
})();
