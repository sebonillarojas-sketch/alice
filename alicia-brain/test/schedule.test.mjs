import { test } from "node:test";
import assert from "node:assert/strict";
import { SCHEDULE, dueJobs, markRan } from "../scripts/schedule.js";

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR, WEEK = 7 * DAY;

test("SCHEDULE incluye scraper, cheshire y knave con cadencias correctas", () => {
  const byId = Object.fromEntries(SCHEDULE.map(j => [j.id, j]));
  assert.equal(SCHEDULE.length, 6);
  assert.equal(byId["scraper"].everyMs, 6 * HOUR);
  assert.equal(byId["cheshire"].everyMs, 30 * MIN);
  assert.equal(byId["knave"].everyMs, 1 * HOUR);
  assert.equal(byId["knave-audit"].everyMs, 1 * DAY);
  assert.equal(byId["knave-review"].everyMs, 1 * WEEK);
  assert.equal(byId["clon-nocturno"].everyMs, 1 * DAY);
});

test("dueJobs: un job que nunca corrió está vencido", () => {
  const due = dueJobs(SCHEDULE, {}, 1_000_000);
  assert.ok(due.find(j => j.id === "cheshire"));
});

test("dueJobs: un job que corrió recién NO está vencido", () => {
  const now = 10 * HOUR;
  const state = { cheshire: now - 5 * MIN }; // corrió hace 5 min, cadencia 30 min
  const due = dueJobs(SCHEDULE.filter(j => j.id === "cheshire"), state, now);
  assert.equal(due.length, 0);
});

test("dueJobs: vencido cuando pasó la cadencia", () => {
  const now = 10 * HOUR;
  const state = { cheshire: now - 31 * MIN };
  const due = dueJobs(SCHEDULE.filter(j => j.id === "cheshire"), state, now);
  assert.equal(due.length, 1);
});

test("markRan actualiza el timestamp", () => {
  const s = markRan({}, "knave", 123);
  assert.equal(s.knave, 123);
});
