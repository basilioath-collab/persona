/* Document Picture-in-Picture: browser-owned window, no executable or installation. */
(() => {
  const stylesheet = new URL('floating-panel.css', document.currentScript.src).href;
  const periods = [['morning', 'Manhã'], ['afternoon', 'Tarde'], ['flexible', 'Se sobrar tempo']];
  const labels = { planned: 'Planejada', 'in-progress': 'Em andamento', review: 'Em revisão',
    'waiting-return': 'Aguardando retorno', blocked: 'Bloqueada', done: 'Concluída' };
  function create({ button, getDatabase, onOpenPersona, onMessage }) {
    let panel = null, timer = null, signature = '', generation = 0, opening = false;
    const initialText = button.textContent, initialTitle = button.title;
    const pageSize = 3;
    let list, summary, focusRow, counter, previous, next, expand, toolbar;
    let rows = [], pageIndex = 0, dayKey = '', expanded = false;
    function reset() {
      clearInterval(timer); timer = null; panel = null; signature = ''; opening = false;
      button.disabled = false; button.textContent = initialText; button.title = initialTitle; button.setAttribute('aria-pressed', 'false');
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
    function compactHeight() { return Math.max(112, 80 + Math.min(pageSize, Math.max(0, rows.length - pageIndex * pageSize)) * 24); }
    function resizePanel() {
      try { panel.resizeTo(panel.outerWidth, (expanded ? 400 : compactHeight()) + Math.max(0, panel.outerHeight - panel.innerHeight)); } catch {}
    }
    function showFocus() {
      const pages = Math.ceil(rows.length / pageSize), visible = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
      counter.textContent = pages ? `${pageIndex + 1}/${pages}` : '0/0';
      counter.title = pages ? `Página ${pageIndex + 1} de ${pages}` : 'Nenhuma página';
      counter.setAttribute('aria-label', counter.title);
      previous.disabled = pageIndex <= 0; next.disabled = !pages || pageIndex >= pages - 1;
      focusRow.replaceChildren(); focusRow.dataset.page = String(pageIndex + 1);
      if (!visible.length) focusRow.append(element(panel.document, 'p', 'empty', 'Nenhuma ação planejada hoje.'));
      for (const row of visible) {
        const point = element(panel.document, 'article', `focus-point${row.done ? ' done' : ''}`);
        point.dataset.planId = row.id;
        const title = element(panel.document, 'b', 'focus-title', `${row.done ? '✓' : '○'} ${row.text}`);
        const period = periods.find(([key]) => key === row.period)?.[1] || '';
        title.title = `${row.text} — ${period} · ${row.task} · ${labels[row.status] || row.status || ''}`;
        point.append(title, element(panel.document, 'span', 'duration', PersonaToday.durationText(row.minutes)));
        focusRow.append(point);
      }
      for (const item of list.querySelectorAll('.item')) {
        if (visible.some(row => row.id === item.dataset.planId)) item.setAttribute('aria-current', 'true');
        else item.removeAttribute('aria-current');
      }
    }
    function setExpanded(value) {
      expanded = value;
      panel.document.body.classList.toggle('expanded', expanded);
      expand.textContent = expanded ? 'Foco' : 'Lista';
      expand.setAttribute('aria-expanded', String(expanded));
      expand.title = expanded ? 'Recolher para o plano paginado' : 'Expandir lista completa';
      expand.setAttribute('aria-label', expand.title);
      // Resizing is browser-controlled and may require the click's user activation.
      resizePanel();
    }
    function move(offset) {
      const target = pageIndex + offset;
      if (target >= 0 && target < Math.ceil(rows.length / pageSize)) { pageIndex = target; showFocus(); resizePanel(); }
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
      const anchor = rows[pageIndex * pageSize]?.id;
      rows = updated;
      const anchorIndex = rows.findIndex(row => row.id === anchor);
      pageIndex = dayKey !== day ? 0 : anchorIndex >= 0 ? Math.floor(anchorIndex / pageSize)
        : Math.min(pageIndex, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
      dayKey = day;
      const doc = panel.document, scrollTop = list.scrollTop;
      summary.textContent = `${rows.filter(row => row.done).length}/${rows.length} concluídas · ${PersonaToday.durationText(rows.reduce((sum, row) => sum + (+row.minutes || 0), 0))} planejados`;
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
          item.addEventListener('click', () => { pageIndex = Math.floor(rows.findIndex(item => item.id === row.id) / pageSize); showFocus(); setExpanded(false); expand.focus({preventScroll:true}); });
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
      showFocus(); resizePanel();
    }
    function mount(win) {
      const doc = win.document;
      rows = []; pageIndex = 0; dayKey = ''; expanded = false;
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
      const navigation = element(doc, 'nav', 'navigation'); navigation.setAttribute('aria-label', 'Páginas do plano de Hoje');
      previous = element(doc, 'button', '', '‹ Anterior'); previous.id = 'previousActivity'; previous.type = 'button';
      next = element(doc, 'button', '', 'Próxima ›'); next.id = 'nextActivity'; next.type = 'button';
      previous.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
      const returnToPersona = () => { onOpenPersona(); window.focus(); };
      const open = element(doc, 'button', 'return-persona', 'Persona'); open.type = 'button';
      open.title = 'Voltar ao Persona'; open.addEventListener('click', returnToPersona);
      navigation.append(previous, open, next);
      summary = element(doc, 'p', 'summary'); summary.id = 'dailyProgress'; summary.setAttribute('role','status');
      toolbar = element(doc, 'div', 'toolbar');
      const fullOpen = element(doc, 'button', '', 'Voltar ao Persona'); fullOpen.type = 'button';
      fullOpen.addEventListener('click', returnToPersona);
      const hide = element(doc, 'button', 'secondary', 'Fechar painel'); hide.type = 'button';
      hide.addEventListener('click', close); toolbar.append(fullOpen, hide);
      list = element(doc, 'main'); list.id = 'floatingPlan';
      doc.body.replaceChildren(header, summary, focusRow, navigation, toolbar, list);
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
        const count = Math.min(pageSize, PersonaToday.planItems(getDatabase(), PersonaToday.today()).length);
        const win = await api.requestWindow({ width: 320, height: Math.max(112, 80 + count * 24), preferInitialWindowPlacement: true });
        if (attempt !== generation) { win.close(); return; }
        panel = win;
        win.addEventListener('pagehide', () => { if (panel === win) reset(); }, { once: true });
        mount(win);
        button.textContent = 'Trazer painel à frente'; button.title = 'Mostrar novamente o painel. Para evitar o recorte, posicione-o acima da barra de tarefas.'; button.setAttribute('aria-pressed', 'true');
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
