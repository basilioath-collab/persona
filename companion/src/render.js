import '../../shared/today.js';
export const { planItems, durationText, today } = globalThis.PersonaToday;
export const periods = [['morning', 'Manhã'], ['afternoon', 'Tarde'], ['flexible', 'Se sobrar tempo']];
const labels = {planned:'Planejada','in-progress':'Em andamento',review:'Em revisão','waiting-return':'Aguardando retorno',blocked:'Bloqueada',done:'Concluída'};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderPlan(db, date = today()) {
  if (!db) return '<div class="empty">Vincule seu banco para acompanhar o plano de Hoje.</div>';
  const items = planItems(db, date);
  if (!items.length) return '<div class="empty">Dia ainda sem plano. Planeje suas ações no Persona.</div>';
  return periods.map(([period, label]) => {
    const group = items.filter(x => x.period === period);
    if (!group.length) return '';
    return `<section><h2>${label}</h2>${group.map(x => {
      const task = db.tasks.find(t => t.id === x.taskId);
      return `<article class="item ${x.done ? 'done' : ''}" data-plan-id="${esc(x.id)}"><span aria-hidden="true">${x.done ? '✓' : '○'}</span><div class="copy"><b>${esc(x.text)}</b><small>${esc(task.title)} · ${esc(labels[task.status] || task.status || '')}</small><small>${x.done ? 'Ação concluída' : 'Ação pendente'}</small></div><span class="badge">${durationText(x.estimatedMinutes)}</span></article>`;
    }).join('')}</section>`;
  }).join('');
}
