![make.fun](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)
![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Iruwae/csv-reader-speed-01-entry/rank.svg)
![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Iruwae/csv-reader-speed-01-entry/reward.svg)

# csv-reader-speed-01 — faster drop-in for csv-reader 1.0.0

A faster drop-in for make.fun's own csv-reader 1.0.0 that answers exactly as it
does on every case. Entry for the [csv-reader-speed-01-run-20261121 bounty](https://make.fun/bounty/csv-reader-speed-01-run-20261121).

- `solve.js` — dependency-free ES module; `run(input)` returns csv-reader's
  reading of `{text, header}` as `{columns, rows, errors}`, byte-identical to the
  reference on every case.
- `main.ts` — the harness driver: reads every case from `/input/cases.json`,
  answers each with `run`, writes `/output/answers.json`.

Verified locally: practice 6/6 identical, official scorer passed, edge 57/57,
fuzz 130/130, ~1.76x faster than the house baseline.
