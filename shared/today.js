/* Shared with the PWA and desktop companion. No mutations or recurrence generation. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PersonaToday = api;
})(globalThis, () => {
  function planItems(db, date) {
    return (db.dailyPlans || db.tomorrowPlan || [])
      .filter(x => x.date === date && db.tasks.some(t => t.id === x.taskId))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  function durationText(minutes) {
    const m = Math.max(0, +minutes || 0), h = Math.floor(m / 60), rest = m % 60;
    return h && rest ? `${h}h${String(rest).padStart(2, '0')}` : h ? `${h}h` : `${rest}min`;
  }
  // Calendar date, not an instant: both clients change day at local midnight.
  const today = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { planItems, durationText, today };
});
