/* ------------------------------------------------------------------
   timezones.js — world clock & time zone converter.

   Every clock on the board shows the same instant (initially "now").
   Slide any clock's scrubber to move them all together — that's how
   you line up a meeting across zones. Share the board as a link.
------------------------------------------------------------------- */
"use strict";

(function () {

  const LS_KEY = "tfyi.zones";
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  /* ---------------- state ---------------- */
  let zones = [];          // IANA zone ids on the board
  let refInstant = null;   // null => live (follow real "now"), else epoch ms
  let dragBase = null;     // instant captured when a scrub drag starts
  const rowRefs = new Map(); // zone -> cached DOM refs
  const dateLineFmt = new Map(); // zone -> Intl.DateTimeFormat for the date line

  function currentInstant() { return refInstant === null ? Date.now() : refInstant; }
  function isLive() { return refInstant === null; }

  /* ---------------- persistence ---------------- */
  function persist() {
    lsSet(LS_KEY, JSON.stringify(zones));
  }

  function loadState() {
    const params = new URLSearchParams(location.search);
    let fromUrl = false;

    if (params.get("z")) {
      const list = params.get("z").split(",").map(s => s.trim()).filter(tzValidZone);
      if (list.length) {
        zones = dedupe(list);
        fromUrl = true;
      }
    }
    const t = params.get("t");
    if (t !== null && !isNaN(+t)) {
      refInstant = +t;
    }

    if (!fromUrl) {
      const saved = lsGet(LS_KEY, null);
      if (saved) {
        try {
          const list = JSON.parse(saved).filter(tzValidZone);
          if (list.length) zones = dedupe(list);
        } catch (e) { /* corrupted — fall through */ }
      }
    }

    if (!zones.length) {
      zones = dedupe([localZone, "UTC", "America/New_York", "Europe/London", "Asia/Tokyo", "Australia/Sydney"].filter(tzValidZone));
    }
    persist();
  }

  function dedupe(list) {
    const seen = new Set();
    const out = [];
    for (const z of list) {
      const key = z.toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push(z); }
    }
    return out;
  }

  /* ---------------- board rendering ---------------- */

  function fmtDateLine(zone, instant) {
    let f = dateLineFmt.get(zone);
    if (!f) {
      f = new Intl.DateTimeFormat("en-US", {
        timeZone: zone, weekday: "short", month: "short", day: "numeric"
      });
      dateLineFmt.set(zone, f);
    }
    return f.format(instant);
  }

  function fmtDayChip(zone, instant) {
    const p = tzZonedParts(zone, instant);
    const now = tzZonedParts(localZone, Date.now());
    const diff = Math.round(
      (Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(now.year, now.month - 1, now.day)) / 86400000
    );
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    return (diff > 0 ? "+" : "\u2212") + Math.abs(diff) + " days";
  }

  function fmtDelta(mins) {
    const sign = mins < 0 ? "\u2212" : "+";
    const abs = Math.abs(mins);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return sign + (h ? h + "h" : "") + (m ? (h ? " " : "") + m + "m" : "") || sign + "0m";
  }

  function buildRow(zone) {
    const row = document.createElement("div");
    row.className = "tz-row";
    row.dataset.zone = zone;

    row.innerHTML =
      '<div class="tz-head">' +
        '<span class="tz-name"></span><span class="tz-zoneid"></span>' +
        '<span class="spacer"></span>' +
        '<span class="sun"></span>' +
        '<span class="chip chip-offset"></span>' +
        '<span class="chip chip-day"></span>' +
        '<button class="icon-btn tz-remove" title="Remove this city">\u00d7</button>' +
      "</div>" +
      '<div class="tz-mid">' +
        '<span class="tz-time"></span>' +
        '<span class="tz-date"></span>' +
      "</div>" +
      '<div class="tz-bar"><div class="tz-marker"></div></div>' +
      '<div class="tz-scrub">' +
        '<span class="scrub-end">\u221212h</span>' +
        '<input type="range" class="scrub" min="-720" max="720" step="5" value="0" ' +
        'title="Slide to shift every clock together">' +
        '<span class="scrub-end">+12h</span>' +
        '<span class="delta" hidden></span>' +
      "</div>";

    const refs = {
      row: row,
      name: row.querySelector(".tz-name"),
      zoneid: row.querySelector(".tz-zoneid"),
      sun: row.querySelector(".sun"),
      offset: row.querySelector(".chip-offset"),
      day: row.querySelector(".chip-day"),
      remove: row.querySelector(".tz-remove"),
      time: row.querySelector(".tz-time"),
      date: row.querySelector(".tz-date"),
      bar: row.querySelector(".tz-bar"),
      marker: row.querySelector(".tz-marker"),
      slider: row.querySelector(".scrub"),
      delta: row.querySelector(".delta")
    };

    refs.name.textContent = tzFriendlyName(zone);
    refs.zoneid.textContent = zone;
    refs.bar.style.background =
      "linear-gradient(90deg, var(--night) 0%, var(--night) 25%, var(--day) 25%, var(--day) 75%, var(--night) 75%, var(--night) 100%)";

    refs.remove.addEventListener("click", () => removeZone(zone));

    // scrubber: slide one clock to move them all
    refs.slider.addEventListener("pointerdown", () => {
      dragBase = currentInstant();
      refs.delta.hidden = false;
    });

    refs.slider.addEventListener("input", () => {
      if (dragBase === null) {
        dragBase = currentInstant();
        refs.delta.hidden = false;
      }
      refInstant = dragBase + (+refs.slider.value) * 60000;
      refs.delta.textContent = fmtDelta(+refs.slider.value);
      renderAll();
    });

    const endDrag = () => {
      dragBase = null;
      refs.slider.value = 0;
      refs.delta.hidden = true;
    };
    refs.slider.addEventListener("change", endDrag);
    refs.slider.addEventListener("keyup", endDrag);

    rowRefs.set(zone, refs);
    return row;
  }

  function updateRow(zone, refs) {
    const inst = currentInstant();
    const p = tzZonedParts(zone, inst);

    refs.time.textContent = pad2(p.hour) + ":" + pad2(p.minute);
    refs.date.textContent = fmtDateLine(zone, inst);
    refs.offset.textContent = tzFormatOffset(tzOffsetMinutes(zone, inst));
    refs.day.textContent = fmtDayChip(zone, inst);
    refs.sun.textContent = (p.hour >= 6 && p.hour < 18) ? "\u2600\ufe0f" : "\ud83c\udf19";

    const frac = (p.hour + p.minute / 60 + p.second / 3600) / 24;
    refs.marker.style.left = (frac * 100).toFixed(3) + "%";
  }

  function renderBoard() {
    const board = $("board");
    board.innerHTML = "";
    rowRefs.clear();
    for (const z of zones) board.appendChild(buildRow(z));
    if (!zones.length) {
      const empty = document.createElement("div");
      empty.className = "tz-empty";
      empty.textContent = "No cities on the board. Add one above to get started.";
      board.appendChild(empty);
    }
    renderAll();
  }

  function renderAll() {
    rowRefs.forEach((refs, zone) => updateRow(zone, refs));
    const liveChip = $("liveChip");
    if (isLive()) {
      liveChip.innerHTML = '<span class="live-dot pulsing"></span> LIVE';
      liveChip.className = "chip chip-good";
      liveChip.title = "Clocks follow the real current time";
    } else {
      liveChip.innerHTML = "\u21ba Back to now";
      liveChip.className = "chip chip-accent";
      liveChip.title = "Clocks are paused on a chosen moment. Click to jump back to live time";
    }
  }

  function addZone(zone) {
    if (!tzValidZone(zone)) return;
    if (zones.some(z => z.toLowerCase() === zone.toLowerCase())) {
      const refs = rowRefs.get(zone);
      if (refs) {
        refs.row.classList.remove("flash");
        void refs.row.offsetWidth; // restart animation
        refs.row.classList.add("flash");
      }
      return;
    }
    zones.push(zone);
    persist();
    const board = $("board");
    const empty = board.querySelector(".tz-empty");
    if (empty) empty.remove();
    const row = buildRow(zone);
    board.appendChild(row);
    updateRow(zone, rowRefs.get(zone));
    row.classList.add("flash");
  }

  function removeZone(zone) {
    zones = zones.filter(z => z !== zone);
    persist();
    renderBoard();
  }

  /* ---------------- city search ---------------- */

  function searchResults(query) {
    const q = query.trim().toLowerCase();
    const results = [];
    const seen = new Set();
    const MAX = 12;

    const push = (city, zone, note) => {
      const key = zone.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      results.push({ city: city, zone: zone, note: note || "" });
    };

    const onBoard = (zone) => zones.some(z => z.toLowerCase() === zone.toLowerCase());

    // curated cities first (list is roughly ordered by popularity)
    for (const [city, zone] of tzCityList()) {
      if (!q || city.toLowerCase().includes(q) || zone.toLowerCase().includes(q)) {
        push(city, zone, onBoard(zone) ? "on board" : "");
      }
      if (results.length >= MAX) break;
    }
    // then any other IANA zone matching the query
    if (q && results.length < MAX) {
      for (const zone of tzAllZones()) {
        const fn = tzFriendlyName(zone).toLowerCase();
        if (fn.includes(q) || zone.toLowerCase().includes(q)) {
          push(fn, zone, onBoard(zone) ? "on board" : "");
        }
        if (results.length >= MAX) break;
      }
    }
    return results;
  }

  function renderResults(query) {
    const box = $("addResults");
    const list = searchResults(query);
    if (!list.length) {
      box.hidden = true;
      return;
    }
    box.innerHTML = "";
    for (const r of list) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tz-result";
      const now = tzZonedParts(r.zone, Date.now());
      btn.innerHTML =
        '<span><span class="r-city"></span> <span class="r-zone"></span></span>' +
        '<span><span class="r-now"></span> <span class="r-note"></span></span>';
      btn.querySelector(".r-city").textContent = r.city;
      btn.querySelector(".r-zone").textContent = "(" + r.zone + ")";
      btn.querySelector(".r-now").textContent = pad2(now.hour) + ":" + pad2(now.minute);
      if (r.note) btn.querySelector(".r-note").textContent = r.note;
      // mousedown fires before the input's blur, so the click still lands
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        addZone(r.zone);
        $("addInput").value = "";
        box.hidden = true;
        $("addInput").focus();
      });
      box.appendChild(btn);
    }
    box.hidden = false;
  }

  /* ---------------- share ---------------- */

  function shareLink() {
    const params = new URLSearchParams();
    params.set("z", zones.join(","));
    if (!isLive()) params.set("t", String(Math.round(refInstant / 60000) * 60000));
    const url = location.origin !== "null" && location.protocol.startsWith("http")
      ? location.origin + location.pathname + "?" + params.toString()
      : location.href.split("?")[0] + "?" + params.toString();
    copyText(url).then(
      () => toast("Link copied. Share it to line up this moment"),
      () => toast("Couldn't access the clipboard")
    );
  }

  /* ---------------- wiring ---------------- */

  function init() {
    loadState();
    renderBoard();

    const addInput = $("addInput");
    addInput.addEventListener("input", () => renderResults(addInput.value));
    addInput.addEventListener("focus", () => renderResults(addInput.value));
    addInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        $("addResults").hidden = true;
        addInput.blur();
      }
    });
    addInput.addEventListener("blur", () => {
      // small delay so a mousedown on a result still registers
      setTimeout(() => { $("addResults").hidden = true; }, 150);
    });

    $("liveChip").addEventListener("click", () => {
      refInstant = null;
      renderAll();
    });

    $("shareBtn").addEventListener("click", shareLink);

    // keep clocks ticking (minutes resolution)
    setInterval(renderAll, 1000);
  }

  init();
})();
