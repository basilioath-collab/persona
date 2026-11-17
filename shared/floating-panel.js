/* Document Picture-in-Picture: browser-owned window, no executable or installation. */
(() => {
  const stylesheet = new URL('floating-panel.css', document.currentScript.src).href;
  const periods = [['morning', 'Manhã'], ['afternoon', 'Tarde'], ['flexible', 'Se sobrar tempo']];
  const labels = { planned: 'Planejada', 'in-progress': 'Em andamento', review: 'Em revisão',
    'waiting-return': 'Aguardando retorno', blocked: 'Bloqueada', done: 'Concluída' };
  function create({ button, getDatabase, onOpenPersona, onMessage }) {
    let panel = null, timer = null, signature = '', generation = 0, opening = false;
    const initialText = button.textContent;
    let list, summary, dateLabel;
    function reset() {
      clearInterval(timer); timer = null; panel = null; signature = ''; opening = false;
      button.disabled = false; button.textContent = initialText; button.setAttribute('aria-pressed', 'false');
    }
    function close() {
      generation++;
      if (panel && !panel.closed) panel.close();
      reset();
    }
    function element(doc, tag, className, text) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }
    function refresh() {
      if (!panel || panel.closed) return;
      const db = getDatabase(), day = PersonaToday.today();
      const rows = PersonaToday.planItems(db, day).map(item => {
        const task = db.tasks.find(task => task.id === item.taskId);
        return { id: item.id, text: item.text, period: item.period, done: !!item.done,
          minutes: item.estimatedMinutes, task: task.title, project: task.project, status: task.status };
      });
      const nextSignature = JSON.stringify({ day, rows });
      if (nextSignature === signature) return;
      signature = nextSignature;
      const doc = panel.document, scrollTop = list.scrollTop;
      dateLabel.textContent = new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
      summary.textContent = `${rows.filter(row => !row.done).length} pendente(s) · ${PersonaToday.durationText(rows.reduce((sum, row) => sum + (+row.minutes || 0), 0))} planejados`;
      list.replaceChildren();
      if (!rows.length) list.append(element(doc, 'p', 'empty', 'Hoje ainda não tem ações planejadas. Monte seu plano no Persona.'));
      for (const [period, label] of periods) {
        const grouped = rows.filter(row => row.period === period);
        if (!grouped.length) continue;
        const section = element(doc, 'section');
        section.append(element(doc, 'h2', '', label));
        for (const row of grouped) {
          const item = element(doc, 'article', `item${row.done ? ' done' : ''}`);
          item.dataset.planId = row.id;
          const copy = element(doc, 'div', 'copy');
          copy.append(element(doc, 'b', '', row.text),
            element(doc, 'small', '', `${row.task} · ${labels[row.status] || row.status || ''}`),
            element(doc, 'small', 'state', row.done ? '✓ Ação concluída' : '○ Ação pendente'));
          item.append(copy, element(doc, 'span', 'duration', PersonaToday.durationText(row.minutes)));
          section.append(item);
        }
        list.append(section);
      }
      list.scrollTop = scrollTop;
    }
    function mount(win) {
      const doc = win.document;
      doc.title = 'Persona • Hoje'; doc.documentElement.lang = 'pt-BR';
      const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = stylesheet;
      doc.head.append(link);
      const header = element(doc, 'header');
      const brand = element(doc, 'div', 'brand', 'PERSONA');
      brand.append(element(doc, 'h1', '', 'Hoje'));
      dateLabel = element(doc, 'small', 'date'); header.append(brand, dateLabel);
      summary = element(doc, 'p', 'summary');
      const toolbar = element(doc, 'div', 'toolbar');
      const open = element(doc, 'button', '', 'Voltar ao Persona'); open.type = 'button';
      open.addEventListener('click', () => { onOpenPersona(); window.focus(); });
      const hide = element(doc, 'button', 'secondary', 'Fechar painel'); hide.type = 'button';
      hide.addEventListener('click', close); toolbar.append(open, hide);
      list = element(doc, 'main'); list.id = 'floatingPlan';
      const footer = element(doc, 'footer', '', 'Arraste pela barra da janela. Mantenha o Persona aberto.');
      doc.body.replaceChildren(header, summary, toolbar, list, footer);
      refresh(); timer = setInterval(refresh, 1000);
    }
    async function open() {
      if (panel && !panel.closed) { refresh(); panel.focus(); return; }
      if (opening) return;
      if (!window.isSecureContext) { onMessage('Abra o Persona por HTTPS ou localhost para usar o painel flutuante.'); return; }
      const api = window.documentPictureInPicture;
      if (!api?.requestWindow) {
        onMessage('Este navegador não oferece painel flutuante. Use Chrome/Edge atualizado; a empresa pode desativar esse recurso.'); return;
      }
      const attempt = ++generation;
      opening = true; button.disabled = true;
      try {
        // Called directly by the user's click, preserving the required browser activation.
        const win = await api.requestWindow({ width: 360, height: 520 });
        if (attempt !== generation) { win.close(); return; }
        panel = win;
        win.addEventListener('pagehide', () => { if (panel === win) reset(); }, { once: true });
        mount(win);
        button.textContent = 'Painel aberto'; button.setAttribute('aria-pressed', 'true');
      } catch (error) {
        close();
        onMessage(error.name === 'NotAllowedError'
          ? 'O navegador não permitiu abrir o painel. Clique diretamente no botão; se persistir, confira se o recurso é permitido pela empresa.'
          : 'Não foi possível abrir o painel flutuante. Abra o site diretamente em uma guia do Chrome/Edge e tente novamente.');
      } finally {
        if (attempt === generation) { opening = false; button.disabled = false; }
      }
    }
    button.hidden = false; button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', open);
    window.addEventListener('pagehide', close);
    return { open, close, refresh };
  }
  window.PersonaFloatingPanel = { create };
})();
