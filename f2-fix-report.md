# F2 Fix Report — alicia-brain learning-loop

## FIX 1 — evidence layer bypassed (Important)

**File:** `alicia-brain/src/lessons.js`

- `evaluateGate`: insufficient-evidence branch now returns a distinct decision
  `"hold"` (reason unchanged: `evidencia insuficiente (<N)`), instead of being
  conflated with `"needs_human"`. Full decision set: `reject`, `hold`,
  `auto_apply`, `needs_human`.
- `runGateOnLesson`: status mapping is now explicit —
  `reject`→`rejected`, `auto_apply`→`applied`, `needs_human`→`validated`,
  `hold`→`"proposed"` (status is left unchanged; `contradicts_check` and
  `updated_at` still get persisted). The returned `{status}` reflects the
  actual persisted value.
- `runGatePass` required no changes: it only increments `applied`/`rejected`/
  `validated` counters when the status matches, and always increments
  `evaluated` for every processed row, so a `hold` result is correctly counted
  as evaluated without falling into any of the three outcome buckets.

**Tests:**
- `test/lessons-gate.test.mjs`: updated the "poca evidencia" assertion from
  `"needs_human"` to `"hold"`.
- `test/lessons-rungate.test.mjs`: added a new test — a non-contradicting
  lesson with `evidence_count = 1` (below `minEvidence = 3`) → `runGateOnLesson`
  returns `decision: "hold"` and leaves `status: "proposed"` (verified both via
  the return value and a direct row read).
- `test/lessons-gatepass.test.mjs`: unchanged, still passes — its 3 lessons all
  have `evidence_count >= minEvidence`, so `evaluated/applied/rejected/validated`
  stay `3/1/1/1`.

## FIX 2 — RNE hard-rule false positive (Important)

**File:** `alicia-brain/src/hard-rules.js`

- `rne-minimos` rule's `test` regex tightened from a bare `.*` + `m2` pattern
  (which matched any "reducir ... m2" phrase) to require a room/unit word or
  "área mínima" context within 60 chars of the reduce-verb:
  ```js
  test: t => /(bajar|reducir|achicar|recortar|menos de|por debajo|m[aá]s chico).{0,60}(dormitorio|ba[ñn]o|cocina|sala|comedor|ambiente|dpto|departamento|unidad|[aá]rea m[ií]nima|area minima)/i.test(t),
  ```

**Tests:**
- `test/hard-rules.test.mjs`: kept the existing "bajar el dormitorio a 5 m2 para
  que entre" → `contradicts: true` assertion, and added a new assertion that
  "reducir el precio por m2" → `contradicts: false` (the false positive this
  fix eliminates). "responder más corto y en español" (already existing) still
  → `contradicts: false`.

## Verification

```
node --check src/lessons.js src/hard-rules.js
→ OK

node --test test/lessons-gate.test.mjs test/lessons-rungate.test.mjs \
  test/lessons-gatepass.test.mjs test/hard-rules.test.mjs
→ tests 15, pass 15, fail 0

node --test test/*.test.mjs
→ tests 52, pass 52, fail 0
```

## Commit

Committed on branch `feat/learning-loop` (not pushed). See git log for SHA.
