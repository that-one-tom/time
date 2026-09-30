/* ------------------------------------------------------------------
   tz-logic.js — pure time-zone helpers built on the standard Intl API.
   No DOM access, so this file can be unit-tested with Node directly.
   Uses the browser/OS time zone database — always up to date, no
   bundled zone data needed.
------------------------------------------------------------------- */
"use strict";

/**
 * Minutes offset from UTC for a given IANA zone at a given instant.
 * Handles DST correctly (offset can be negative and/or non-whole-hour,
 * e.g. Asia/Kolkata = +330, Asia/Kathmandu = +345).
 */
function tzOffsetMinutes(zone, instant) {
  const d = instant instanceof Date ? instant : new Date(instant);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23"
  });
  const parts = {};
  for (const p of dtf.formatToParts(d)) parts[p.type] = p.value;
  const asUTC = Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    +parts.hour % 24, +parts.minute, +parts.second
  );
  return Math.round((asUTC - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

/** Format an offset in minutes, e.g. 330 -> "UTC+05:30", -240 -> "UTC-04:00" */
function tzFormatOffset(mins) {
  const sign = mins < 0 ? "-" : "+";
  const abs = Math.abs(mins);
  return "UTC" + sign + pad2(Math.floor(abs / 60)) + ":" + pad2(abs % 60);
}

/**
 * Wall-clock parts of an instant in a zone:
 * {year, month, day, hour, minute, second, weekday}
 */
function tzZonedParts(zone, instant) {
  const d = instant instanceof Date ? instant : new Date(instant);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    weekday: "short",
    hourCycle: "h23"
  });
  const parts = {};
  for (const p of dtf.formatToParts(d)) parts[p.type] = p.value;
  return {
    year: +parts.year,
    month: +parts.month,
    day: +parts.day,
    hour: +parts.hour % 24,
    minute: +parts.minute,
    second: +parts.second,
    weekday: parts.weekday
  };
}

/**
 * Convert a wall-clock time in a zone to a UTC instant (epoch ms).
 * Handles DST:
 *   - spring-forward gaps (e.g. 02:30 on the day clocks jump ahead)
 *     resolve to the equivalent time after the gap (03:30),
 *   - ambiguous fall-back times resolve to the earlier occurrence.
 * Iterates to a consistent offset; if the candidates oscillate the
 * wall time is in a gap and the later candidate is used.
 */
function tzInstantFromWall(zone, year, month, day, hour, minute) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let instant = utcGuess - tzOffsetMinutes(zone, utcGuess) * 60000;
  let seen = null;
  for (let i = 0; i < 4; i++) {
    const off = tzOffsetMinutes(zone, instant);
    const cand = utcGuess - off * 60000;
    if (cand === instant) return instant;              // consistent
    if (cand === seen) return Math.max(instant, cand);  // gap: push past the jump
    seen = instant;
    instant = cand;
  }
  return instant;
}

/** "America/New_York" -> "New York", "UTC" -> "UTC" */
function tzFriendlyName(zone) {
  if (zone === "UTC" || zone === "Etc/UTC") return "UTC";
  const last = zone.split("/").pop();
  return last.replace(/_/g, " ").replace(/-/g, " ");
}

/** Curated popular cities: [name, IANA zone, country] */
function tzCityList() {
  return [
    ["Tokyo", "Asia/Tokyo", "Japan"],
    ["Delhi", "Asia/Kolkata", "India"],
    ["Shanghai", "Asia/Shanghai", "China"],
    ["São Paulo", "America/Sao_Paulo", "Brazil"],
    ["Mexico City", "America/Mexico_City", "Mexico"],
    ["Cairo", "Africa/Cairo", "Egypt"],
    ["Mumbai", "Asia/Kolkata", "India"],
    ["Beijing", "Asia/Shanghai", "China"],
    ["Dhaka", "Asia/Dhaka", "Bangladesh"],
    ["Osaka", "Asia/Tokyo", "Japan"],
    ["New York", "America/New_York", "USA"],
    ["Karachi", "Asia/Karachi", "Pakistan"],
    ["Buenos Aires", "America/Argentina/Buenos_Aires", "Argentina"],
    ["Istanbul", "Europe/Istanbul", "Türkiye"],
    ["Kolkata", "Asia/Kolkata", "India"],
    ["Lagos", "Africa/Lagos", "Nigeria"],
    ["London", "Europe/London", "UK"],
    ["Los Angeles", "America/Los_Angeles", "USA"],
    ["Paris", "Europe/Paris", "France"],
    ["Chicago", "America/Chicago", "USA"],
    ["Jakarta", "Asia/Jakarta", "Indonesia"],
    ["Lima", "America/Lima", "Peru"],
    ["Bogotá", "America/Bogota", "Colombia"],
    ["Seoul", "Asia/Seoul", "South Korea"],
    ["Santiago", "America/Santiago", "Chile"],
    ["Singapore", "Asia/Singapore", "Singapore"],
    ["Madrid", "Europe/Madrid", "Spain"],
    ["Toronto", "America/Toronto", "Canada"],
    ["Sydney", "Australia/Sydney", "Australia"],
    ["Melbourne", "Australia/Melbourne", "Australia"],
    ["Dubai", "Asia/Dubai", "UAE"],
    ["Berlin", "Europe/Berlin", "Germany"],
    ["Rome", "Europe/Rome", "Italy"],
    ["Amsterdam", "Europe/Amsterdam", "Netherlands"],
    ["Barcelona", "Europe/Madrid", "Spain"],
    ["Moscow", "Europe/Moscow", "Russia"],
    ["Athens", "Europe/Athens", "Greece"],
    ["Vienna", "Europe/Vienna", "Austria"],
    ["Zurich", "Europe/Zurich", "Switzerland"],
    ["Warsaw", "Europe/Warsaw", "Poland"],
    ["Stockholm", "Europe/Stockholm", "Sweden"],
    ["Oslo", "Europe/Oslo", "Norway"],
    ["Copenhagen", "Europe/Copenhagen", "Denmark"],
    ["Helsinki", "Europe/Helsinki", "Finland"],
    ["Prague", "Europe/Prague", "Czechia"],
    ["Lisbon", "Europe/Lisbon", "Portugal"],
    ["Dublin", "Europe/Dublin", "Ireland"],
    ["Reykjavík", "Atlantic/Reykjavik", "Iceland"],
    ["Edinburgh", "Europe/London", "UK"],
    ["Kyiv", "Europe/Kyiv", "Ukraine"],
    ["Bucharest", "Europe/Bucharest", "Romania"],
    ["Budapest", "Europe/Budapest", "Hungary"],
    ["Munich", "Europe/Berlin", "Germany"],
    ["Honolulu", "Pacific/Honolulu", "USA"],
    ["Anchorage", "America/Anchorage", "USA"],
    ["Denver", "America/Denver", "USA"],
    ["Phoenix", "America/Phoenix", "USA"],
    ["Houston", "America/Chicago", "USA"],
    ["Vancouver", "America/Vancouver", "Canada"],
    ["San Francisco", "America/Los_Angeles", "USA"],
    ["Seattle", "America/Los_Angeles", "USA"],
    ["Havana", "America/Havana", "Cuba"],
    ["Panama City", "America/Panama", "Panama"],
    ["Rio de Janeiro", "America/Sao_Paulo", "Brazil"],
    ["Caracas", "America/Caracas", "Venezuela"],
    ["Quito", "America/Guayaquil", "Ecuador"],
    ["Montevideo", "America/Montevideo", "Uruguay"],
    ["Asunción", "America/Asuncion", "Paraguay"],
    ["Brasília", "America/Sao_Paulo", "Brazil"],
    ["Casablanca", "Africa/Casablanca", "Morocco"],
    ["Algiers", "Africa/Algiers", "Algeria"],
    ["Nairobi", "Africa/Nairobi", "Kenya"],
    ["Addis Ababa", "Africa/Addis_Ababa", "Ethiopia"],
    ["Johannesburg", "Africa/Johannesburg", "South Africa"],
    ["Cape Town", "Africa/Johannesburg", "South Africa"],
    ["Tel Aviv", "Asia/Jerusalem", "Israel"],
    ["Riyadh", "Asia/Riyadh", "Saudi Arabia"],
    ["Doha", "Asia/Qatar", "Qatar"],
    ["Tehran", "Asia/Tehran", "Iran"],
    ["Kuwait City", "Asia/Kuwait", "Kuwait"],
    ["Baghdad", "Asia/Baghdad", "Iraq"],
    ["Colombo", "Asia/Colombo", "Sri Lanka"],
    ["Kathmandu", "Asia/Kathmandu", "Nepal"],
    ["Bangkok", "Asia/Bangkok", "Thailand"],
    ["Hanoi", "Asia/Ho_Chi_Minh", "Vietnam"],
    ["Ho Chi Minh City", "Asia/Ho_Chi_Minh", "Vietnam"],
    ["Kuala Lumpur", "Asia/Kuala_Lumpur", "Malaysia"],
    ["Manila", "Asia/Manila", "Philippines"],
    ["Hong Kong", "Asia/Hong_Kong", "China"],
    ["Taipei", "Asia/Taipei", "Taiwan"],
    ["Perth", "Australia/Perth", "Australia"],
    ["Brisbane", "Australia/Brisbane", "Australia"],
    ["Adelaide", "Australia/Adelaide", "Australia"],
    ["Darwin", "Australia/Darwin", "Australia"],
    ["Auckland", "Pacific/Auckland", "New Zealand"],
    ["Wellington", "Pacific/Auckland", "New Zealand"],
    ["Fiji", "Pacific/Fiji", "Fiji"],
    ["UTC", "UTC", "—"]
  ];
}

/**
 * All known IANA zone ids available in this environment.
 * Uses Intl.supportedValuesOf when available, otherwise a static
 * fallback list of major zones.
 */
function tzAllZones() {
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      const zones = Intl.supportedValuesOf("timeZone");
      if (zones && zones.length) return zones;
    } catch (e) { /* fall through */ }
  }
  return [
    "UTC",
    "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles",
    "America/Denver", "America/Phoenix", "America/Chicago",
    "America/Mexico_City", "America/New_York", "America/Toronto",
    "America/Bogota", "America/Lima", "America/Havana", "America/Caracas",
    "America/Santiago", "America/Sao_Paulo", "America/Argentina/Buenos_Aires",
    "America/Montevideo", "Atlantic/Reykjavik", "Atlantic/Azores",
    "Europe/London", "Europe/Dublin", "Europe/Lisbon", "Europe/Madrid",
    "Europe/Paris", "Europe/Brussels", "Europe/Amsterdam", "Europe/Berlin",
    "Europe/Zurich", "Europe/Vienna", "Europe/Rome", "Europe/Stockholm",
    "Europe/Oslo", "Europe/Copenhagen", "Europe/Helsinki", "Europe/Warsaw",
    "Europe/Prague", "Europe/Budapest", "Europe/Bucharest", "Europe/Athens",
    "Europe/Kyiv", "Europe/Istanbul", "Europe/Moscow", "Africa/Casablanca",
    "Africa/Algiers", "Africa/Lagos", "Africa/Cairo", "Africa/Nairobi",
    "Africa/Addis_Ababa", "Africa/Johannesburg", "Asia/Jerusalem",
    "Asia/Baghdad", "Asia/Kuwait", "Asia/Riyadh", "Asia/Qatar", "Asia/Tehran",
    "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Colombo",
    "Asia/Kathmandu", "Asia/Dhaka", "Asia/Bangkok", "Asia/Ho_Chi_Minh",
    "Asia/Jakarta", "Asia/Kuala_Lumpur", "Asia/Singapore", "Asia/Manila",
    "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Taipei", "Asia/Seoul",
    "Asia/Tokyo", "Australia/Perth", "Australia/Darwin",
    "Australia/Adelaide", "Australia/Brisbane", "Australia/Sydney",
    "Australia/Melbourne", "Pacific/Auckland", "Pacific/Fiji"
  ];
}

/** Best-effort validity check for a zone id. */
function tzValidZone(zone) {
  if (typeof zone !== "string" || !zone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch (e) {
    return false;
  }
}
