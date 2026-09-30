/* ------------------------------------------------------------------
   logic tests — run with:  node test/logic.test.js

   Loads the browser scripts (common.js, tz-logic.js) into Node with
   minimal DOM stubs and exercises the pure time zone / formatting
   logic, including DST edge cases.
------------------------------------------------------------------- */
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const vm = require("vm");

// --- minimal browser stubs so common.js loads cleanly ---
global.document = {
  title: "test",
  body: { dataset: {} },
  getElementById: () => null,
  querySelector: () => null,
  createElement: () => ({ style: {}, appendChild() {}, remove() {}, select() {} }),
  addEventListener: () => {}
};
global.window = { addEventListener: () => {}, isSecureContext: true };
global.requestAnimationFrame = () => {};
// Node >= 21 already provides a global navigator; nothing else is needed.

vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "assets", "common.js"), "utf8"), { filename: "common.js" });
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "assets", "tz-logic.js"), "utf8"), { filename: "tz-logic.js" });

let passed = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  passed++;
}

/* ---- offset formatting ---- */
ok(tzFormatOffset(0) === "UTC+00:00", "format offset 0");
ok(tzFormatOffset(330) === "UTC+05:30", "format offset +5:30 (India)");
ok(tzFormatOffset(345) === "UTC+05:45", "format offset +5:45 (Nepal)");
ok(tzFormatOffset(-240) === "UTC-04:00", "format offset -4 (EDT)");

/* ---- offsets at specific instants ---- */
ok(tzOffsetMinutes("UTC", Date.UTC(2025, 0, 1)) === 0, "UTC offset");
ok(tzOffsetMinutes("Asia/Kolkata", Date.UTC(2025, 0, 1)) === 330, "India +5:30, no DST");
ok(tzOffsetMinutes("America/New_York", Date.UTC(2025, 6, 1)) === -240, "NY in July = EDT -4");
ok(tzOffsetMinutes("America/New_York", Date.UTC(2025, 0, 15)) === -300, "NY in January = EST -5");
ok(tzOffsetMinutes("Australia/Sydney", Date.UTC(2025, 0, 15)) === 660, "Sydney in Jan = AEDT +11");
ok(tzOffsetMinutes("Australia/Sydney", Date.UTC(2025, 6, 15)) === 600, "Sydney in July = AEST +10");

/* ---- wall-clock parts ---- */
const nyParts = tzZonedParts("America/New_York", Date.UTC(2025, 5, 15, 16, 0, 0));
ok(nyParts.hour === 12 && nyParts.minute === 0, "16:00 UTC = 12:00 in New York (EDT)");

/* ---- wall -> instant round trips (several zones & instants) ---- */
const roundTripZones = ["UTC", "America/New_York", "Europe/London", "Asia/Kolkata",
                       "Asia/Tokyo", "Australia/Sydney", "Pacific/Kiritimati", "Pacific/Honolulu"];
const roundTripInstants = [
  Date.UTC(2025, 0, 15, 9, 0, 0),
  Date.UTC(2025, 5, 15, 18, 30, 0),
  Date.UTC(2025, 2, 9, 6, 0, 0)   // during a US spring-forward day
];
for (const zone of roundTripZones) {
  for (const inst of roundTripInstants) {
    const p = tzZonedParts(zone, inst);
    const back = tzInstantFromWall(zone, p.year, p.month, p.day, p.hour, p.minute);
    assert.strictEqual(back, inst,
      "round trip failed for " + zone + " at " + new Date(inst).toISOString());
  }
}
passed += roundTripZones.length * roundTripInstants.length;

/* ---- DST spring-forward gap: 2025-03-09 02:30 does not exist in New York ---- */
const gapInst = tzInstantFromWall("America/New_York", 2025, 3, 9, 2, 30);
const gapParts = tzZonedParts("America/New_York", gapInst);
ok(gapParts.hour === 3 && gapParts.minute === 30, "gap resolves to 03:30 EDT");
ok(tzOffsetMinutes("America/New_York", gapInst) === -240, "gap lands in EDT");

/* ---- friendly names & validity ---- */
ok(tzFriendlyName("America/New_York") === "New York", "friendly name");
ok(tzFriendlyName("Asia/Kolkata") === "Kolkata", "friendly name India");
ok(tzValidZone("Europe/Berlin"), "valid zone accepted");
ok(!tzValidZone("Not/AZone"), "invalid zone rejected");
ok(!tzValidZone(""), "empty zone rejected");

/* ---- curated list hygiene: unique names, all zones valid ---- */
const entries = tzCityList();
const names = entries.map(c => c[0]);
ok(new Set(names).size === names.length, "no duplicate city names in list");
for (const z of entries.map(c => c[1])) ok(tzValidZone(z), "curated zone valid: " + z);

/* ---- clock formatting ---- */
ok(fmtMS(0) === "00:00", "fmtMS zero");
ok(fmtMS(65000) === "01:05", "fmtMS 1:05");
ok(fmtMS(3600000 + 65000) === "1:01:05", "fmtMS with hours");
ok(fmtStopwatch(0) === "00:00.00", "fmtStopwatch zero");
ok(fmtStopwatch(61500) === "01:01.50", "fmtStopwatch centiseconds");

console.log("All " + passed + " assertions passed.");