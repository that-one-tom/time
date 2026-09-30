/* ------------------------------------------------------------------
   common.js — shared helpers (plain script, no dependencies).
   Works over file:// as well as http://.
------------------------------------------------------------------- */
"use strict";

function $(id) { return document.getElementById(id); }

function pad2(n) { return String(n).padStart(2, "0"); }

/* ---- safe localStorage ---- */
function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (e) { return fallback; }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
}

/* ---- clipboard ---- */
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // fallback for file:// or older browsers
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy") ? resolve() : reject(new Error("copy failed"));
    } catch (e) {
      reject(e);
    } finally {
      document.body.removeChild(ta);
    }
  });
}

/* ---- toast ---- */
let _toastTimer = null;
function toast(msg, ms) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("show"), ms || 1800);
}

/* ---- WebAudio chimes (context is created lazily on first use) ---- */
let _audioCtx = null;

function _beep(freq, start, dur, vol) {
  const ctx = _audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.05);
}

/**
 * Play a chime. kind: "end" (session/timer finished), "up" (gentle two-tone).
 * No-op if the user has muted sounds (data-sound="off" on <body>).
 */
function playChime(kind) {
  if (document.body.dataset.sound === "off") return;
  try {
    if (!_audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      _audioCtx = new AC();
    }
    if (_audioCtx.state === "suspended") _audioCtx.resume();
    if (kind === "end") {
      _beep(880, 0.00, 0.22, 0.22);
      _beep(880, 0.30, 0.22, 0.22);
      _beep(880, 0.60, 0.36, 0.22);
    } else {
      _beep(660, 0.00, 0.16, 0.18);
      _beep(990, 0.16, 0.28, 0.18);
    }
  } catch (e) { /* audio not available — ignore */ }
}

/* ---- flashing document title ---- */
let _titleFlash = null;
const _baseTitle = document.title;

function flashTitle(message) {
  stopFlashTitle();
  let on = false;
  _titleFlash = setInterval(() => {
    document.title = on ? _baseTitle : message;
    on = !on;
  }, 900);
  document.title = message;
}

function stopFlashTitle() {
  if (_titleFlash) {
    clearInterval(_titleFlash);
    _titleFlash = null;
    document.title = _baseTitle;
  }
}

// stop flashing once the tab is focused again
window.addEventListener("focus", stopFlashTitle);

/* ---- browser notifications (best-effort) ---- */
function notify(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try { new Notification(title, { body: body || "" }); } catch (e) { /* ignore */ }
  }
}

function requestNotifyPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    try { Notification.requestPermission(); } catch (e) { /* ignore */ }
  }
}

/* ---- clock formatting ---- */

/** ms -> "h:mm:ss" (hours included only when >= 1h) */
function fmtMS(ms) {
  ms = Math.max(0, Math.floor(ms));
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? h + ":" + pad2(m) + ":" + pad2(sec) : pad2(m) + ":" + pad2(sec);
}

/** ms -> "h:mm:ss.cc" for stopwatch (centiseconds) */
function fmtStopwatch(ms) {
  ms = Math.max(0, ms);
  const cs = Math.floor(ms / 10) % 100;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const tail = pad2(sec) + "." + pad2(cs);
  return h > 0 ? h + ":" + pad2(m) + ":" + tail : pad2(m) + ":" + tail;
}
