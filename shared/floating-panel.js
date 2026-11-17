/* Document Picture-in-Picture: browser-owned window, no executable or installation. */
(() => {
  const stylesheet = new URL('floating-panel.css', document.currentScript.src).href;
  const periods = [['morning', 'Manhã'], ['afternoon', 'Tarde'], ['flexible', 'Se sobrar tempo']];
  const labels = { planned: 'Planejada', 'in-progress': 'Em andamento', review: 'Em revisão',
    'waiting-return': 'Aguardando retorno', blocked: 'Bloqueada', done: 'Concluída' };
  function create({ button, getDatabase, onOpenPersona, onMessage }) {
    let panel = null, timer = null, signature = '', generation = 0, opening = false;
    const initialText = button.textContent;
    let list, summary, focusRow, counter, previous, next, expand, toolbar;
    let rows = [], selectedId = null, dayKey = '', expanded = false;
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
    function showFocus() {
      const index = rows.findIndex(row => row.id === selectedId), row = rows[index];
      counter.textContent = rows.length ? `${index + 1}/${rows.length}` : '0/0';
      previous.disabled = index <= 0; next.disabled = index < 0 || index >= rows.length - 1;
      focusRow.replaceChildren();
      focusRow.removeAttribute('data-plan-id'); focusRow.classList.remove('done');
      if (!row) {
        focusRow.append(element(panel.document, 'p', 'empty', 'Nenhuma ação planejada hoje.'));
        return;
      }
      focusRow.dataset.planId = row.id;
      focusRow.classList.toggle('done', row.done);
      const title = element(panel.document, 'b', 'focus-title', `${row.done ? '✓' : '○'} ${row.text}`);
      title.title = `${row.text} — ${row.task} · ${labels[row.status] || row.status || ''}`;
      focusRow.append(title, element(panel.document, 'span', 'duration', PersonaToday.durationText(row.minutes)));
      for (const item of list.querySelectorAll('.item')) {
        if (item.dataset.planId === selectedId) item.setAttribute('aria-current', 'true');
        else item.removeAttribute('aria-current');
      }
    }
    function setExpanded(value) {
      expanded = value;
      panel.document.body.classList.toggle('expanded', expanded);
      expand.textContent = expanded ? 'Foco' : 'Lista';
      expand.setAttribute('aria-expanded', String(expanded));
      expand.title = expanded ? 'Recolher para uma atividade' : 'Expandir lista completa';
      expand.setAttribute('aria-label', expand.title);
      // Resizing is browser-controlled and may require the click's user activation.
      try { panel.resizeTo(panel.outerWidth, (expanded ? 400 : 112) + Math.max(0, panel.outerHeight - panel.innerHeight)); } catch {}
    }
    function move(offset) {
      const index = rows.findIndex(row => row.id === selectedId), row = rows[index + offset];
      if (row) { selectedId = row.id; showFocus(); }
    }
    function refresh() {
      if (!panel || panel.closed) return;
      const db = getDatabase(), day = PersonaToday.today();
      const items = PersonaToday.planItems(db, day);
      const updated = periods.flatMap(([period]) => items.filter(item => item.period === period)).map(item => {
        const task = db.tasks.find(task => task.id === item.taskId);
        return { id: item.id, text: item.text, period: item.period, done: !!item.done,
          minutes: item.estimatedMinutes, task: task.title, status: task.status };
      });
      const nextSignature = JSON.stringify({ day, rows: updated });
      if (nextSignature === signature) return;
      signature = nextSignature;
      const before = rows.find(row => row.id === selectedId);
      rows = updated;
      const current = rows.find(row => row.id === selectedId);
      if (dayKey !== day || !current) selectedId = (rows.find(row => !row.done) || rows[0])?.id ?? null;
      else if (before && !before.done && current.done) {
        const index = rows.indexOf(current);
        selectedId = [...rows.slice(index + 1), ...rows.slice(0, index)].find(row => !row.done)?.id || current.id;
      }
      dayKey = day;
      const doc = panel.document, scrollTop = list.scrollTop;
      summary.textContent = `${rows.filter(row => !row.done).length} pendente(s) · ${PersonaToday.durationText(rows.reduce((sum, row) => sum + (+row.minutes || 0), 0))}`;
      list.replaceChildren();
      if (!rows.length) list.append(element(doc, 'p', 'empty', 'Hoje ainda não tem ações planejadas. Monte seu plano no Persona.'));
      for (const [period, label] of periods) {
        const grouped = rows.filter(row => row.period === period);
        if (!grouped.length) continue;
        const section = element(doc, 'section');
        section.append(element(doc, 'h2', '', label));
        for (const row of grouped) {
          const item = element(doc, 'button', `item${row.done ? ' done' : ''}`);
          item.type = 'button'; item.dataset.planId = row.id; item.title = 'Mostrar esta atividade no modo Foco';
          item.addEventListener('click', () => { selectedId = row.id; showFocus(); setExpanded(false); });
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
      showFocus();
    }
    function mount(win) {
      const doc = win.document;
      rows = []; selectedId = null; dayKey = ''; expanded = false;
      doc.title = 'Persona • Hoje'; doc.documentElement.lang = 'pt-BR';
      const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = stylesheet;
      doc.head.append(link);
      const header = element(doc, 'header');
      const brand = element(doc, 'div', 'brand', 'PERSONA · HOJE');
      counter = element(doc, 'span', 'counter'); counter.id = 'focusCounter';
      expand = element(doc, 'button', 'expand', 'Lista'); expand.id = 'expandPlan'; expand.type = 'button';
      expand.title = 'Expandir lista completa'; expand.setAttribute('aria-label', expand.title); expand.setAttribute('aria-expanded', 'false');
      expand.addEventListener('click', () => setExpanded(!expanded));
      header.append(brand, counter, expand);
      focusRow = element(doc, 'article', 'focus-row'); focusRow.id = 'focusActivity';
      const navigation = element(doc, 'nav', 'navigation'); navigation.setAttribute('aria-label', 'Atividades do plano');
      previous = element(doc, 'button', '', '‹ Anterior'); previous.id = 'previousActivity'; previous.type = 'button';
      next = element(doc, 'button', '', 'Próxima ›'); next.id = 'nextActivity'; next.type = 'button';
      previous.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
      const returnToPersona = () => { onOpenPersona(); window.focus(); };
      const open = element(doc, 'button', 'return-persona', 'Persona'); open.type = 'button';
      open.title = 'Voltar ao Persona'; open.addEventListener('click', returnToPersona);
      navigation.append(previous, open, next);
      summary = element(doc, 'p', 'summary');
      toolbar = element(doc, 'div', 'toolbar');
      const fullOpen = element(doc, 'button', '', 'Voltar ao Persona'); fullOpen.type = 'button';
      fullOpen.addEventListener('click', returnToPersona);
      const hide = element(doc, 'button', 'secondary', 'Fechar painel'); hide.type = 'button';
      hide.addEventListener('click', close); toolbar.append(fullOpen, hide);
      list = element(doc, 'main'); list.id = 'floatingPlan';
      doc.body.replaceChildren(header, focusRow, navigation, summary, toolbar, list);
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
        const win = await api.requestWindow({ width: 320, height: 112, preferInitialWindowPlacement: true });
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
