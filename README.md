# time tools

A free, open re-implementation of the classic time.fyi features: the
world clock / time zone converter, the pomodoro timer, the countdown
timer, and the stopwatch.

Everything runs in your browser. The app is plain HTML, CSS, and
JavaScript, with no frameworks, dependencies, or build step. It makes
no network calls, works offline, and uploads nothing. Time zone
conversion uses the standard `Intl` API instead of bundled data, so
it always matches your OS's tz database, DST rules and historical
changes included.

## Run it

Any static file server works, for example:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

You can also open `index.html` directly from your file manager; no
server is needed.

## The tools

### World clock & time zone converter (`timezones.html`)

- Add any city or IANA time zone, by search or by pasting a zone id.
- Every clock shows the same instant. Slide any clock's scrubber
  (±12h) and all of them move together; that's how you line up a
  meeting across zones.
- Each row shows the UTC offset, a day/night indicator, a
  Today/Tomorrow/+N days chip, and a 24-hour day/night bar with a
  "now" marker.
- You can share the board as a link: the cities and the lined-up
  moment are encoded in the URL (`?z=…&t=…`).
- Your board is remembered between visits (localStorage).

### Pomodoro timer (`pomodoro.html`)

- Classic 25/5/15 cadence with a long break every 4th round. All
  durations, the long-break interval, auto-start behaviour and sound
  are configurable.
- Progress ring, session dots, and an all-time completed-pomodoro
  counter.
- Chime, browser notification, and flashing tab title on completion.
- Keyboard: `Space` start/pause, `R` reset, `S` skip.

### Timer (`timer.html`)

- Hours/minutes/seconds inputs plus quick presets (1m … 1h).
- Counts down to an absolute end timestamp, so it stays accurate even
  in throttled/background tabs. `+1 min` while running.
- Chime, notification, flashing title, and a "Run again" banner when
  it finishes.

### Stopwatch (`stopwatch.html`)

- Centisecond precision, based on `performance.now()` with
  accumulated elapsed time, so it never drifts.
- Lap tracking with fastest/slowest highlighting.
- Keyboard: `Space` start/stop, `L` lap, `R` reset.

## Layout

```
├── index.html          hub page
├── timezones.html      world clock / time zone converter
├── pomodoro.html       pomodoro timer
├── timer.html          countdown timer
├── stopwatch.html      stopwatch
├── assets/
│   ├── style.css       shared dark/light theme
│   ├── common.js       helpers: sound, titles, storage, formatting
│   ├── tz-logic.js     pure time zone math (Intl-based, no DOM)
│   ├── timezones.js    world clock app
│   ├── pomodoro.js     pomodoro app
│   ├── timer.js        countdown app
│   └── stopwatch.js    stopwatch app
└── test/
    └── logic.test.js   unit tests for tz-logic.js / formatting
```

## Tests

The time zone math (offsets, DST, wall→instant round trips, the
spring-forward gap case) is unit-tested:

```sh
node test/logic.test.js
```

## Notes

- Light and dark themes follow your system setting automatically.
- Board/config state lives in your browser's localStorage only.
- To deploy, copy the directory to any static host (GitHub Pages,
  nginx, S3, …). There is nothing to install or configure.
