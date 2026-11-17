const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planItems, durationText, today } = require('../shared/today.js');
const fixture = require('./fixtures/today.json');
test('shared projection preserves period/order, completed actions and completed tasks; excludes orphans and other dates', () => {
  const original = JSON.stringify(fixture);
  const items = planItems(fixture, '2026-11-17');
  assert.deepEqual(items.map(x => x.id), ['p1','p4','p2','p3']);
  assert.equal(items.filter(x => !x.done).length, 3);
  assert.equal(items.at(-1).taskId, 'b');
  assert.equal(planItems(fixture, '2026-11-18').length, 1);
  assert.equal(JSON.stringify(fixture), original);
});
test('edits, plan completion and task completion are independent; no recurrence is synthesized', () => {
  const db = structuredClone(fixture);
  db.dailyPlans[0].text = 'Editada'; db.dailyPlans[0].done = true;
  db.tasks[0].status = 'done';
  const items = planItems(db, '2026-11-17');
  assert.equal(items.find(x => x.id === 'p2').text, 'Editada');
  assert.equal(items.filter(x => !x.done).length, 2);
  assert.equal(db.tasks.length, 3);
});
test('legacy tomorrowPlan and durations retain web semantics', () => {
  assert.equal(planItems({tasks: fixture.tasks, tomorrowPlan: fixture.dailyPlans}, '2026-11-17').length, 4);
  assert.deepEqual([0,30,60,90].map(durationText), ['0min','30min','1h','1h30']);
  assert.equal(today(new Date('2026-11-17T12:00:00Z')), '2026-11-17');
});

test('day changes at local midnight, including an evening in Brazil', () => {
  assert.equal(today(new Date(2026,10,17,23,59,59)), '2026-11-17');
  assert.equal(today(new Date(2026,10,18,0,0,0)), '2026-11-18');
});
