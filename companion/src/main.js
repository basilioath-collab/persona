import './style.css';
import { renderPlan, today } from './render.js';
const $ = id => document.getElementById(id);
const native = window.__TAURI__;
let prefs, lastData, lastDay, collapsed = false, expandedHeight = 560, polling = false;
function error(err) { $('error').textContent = String(err); }
const invoke = (cmd, args) => native.core.invoke(cmd, args);
function previewOpacity(value) {
  const percent = Math.max(15, Math.min(75, Number(value) || 35));
  document.body.style.setProperty('--idle-opacity', String(percent / 100));
  $('opacityValue').textContent = `${percent}%`;
}
function fill(p) {
  prefs = p; collapsed = p.collapsed;
  $('idleOpacity').value = p.idleOpacity ?? 35; previewOpacity($('idleOpacity').value);
  $('time').value = p.summaryTime;
  $('summary').checked = p.summaryEnabled; $('top').checked = p.alwaysOnTop;
  $('file').textContent = p.database || 'Nenhum arquivo selecionado';
  document.body.classList.toggle('collapsed', collapsed);
  $('collapse').textContent = collapsed ? '+' : '−';
}
async function refresh() {
  if (polling) return;
  polling = true;
  try {
    const state = await invoke('status');
    if (!prefs) { fill(state.preferences); $('settings').hidden = !!prefs.database; }
    const s = state.snapshot;
    const data = JSON.stringify(s.data), day = today();
    if (data !== lastData || day !== lastDay) {
      $('plan').innerHTML = renderPlan(s.data, day); lastData = data; lastDay = day;
    }
    $('connection').classList.toggle('connected', s.connection === 'connected');
    $('connection').textContent = s.connection === 'connected' ? '● Banco conectado · somente leitura' :
      (s.connection || 'Selecione o banco vinculado no Persona') + (s.data ? ' · exibindo última leitura válida' : '');
    $('connection').title = s.lastValidAt ? `Última leitura válida: ${new Date(s.lastValidAt).toLocaleString()}` : '';
    if (state.alertError) error(`Alerta: ${state.alertError}`);
  } catch (err) { error(err); } finally { polling = false; }
}
async function save(overrides = {}) {
  await invoke('configure', {
    personaUrl: '', summaryTime: $('time').value,
    idleOpacity: Number($('idleOpacity').value), summaryEnabled: $('summary').checked, alwaysOnTop: $('top').checked, collapsed, ...overrides,
  });
  prefs = (await invoke('status')).preferences;
  await native.window.getCurrentWindow().setAlwaysOnTop(prefs.alwaysOnTop);
}
async function toggleCollapse() {
  const win = native.window.getCurrentWindow();
  if (!collapsed) { expandedHeight = (await win.innerSize()).height / await win.scaleFactor(); }
  const nextCollapsed = !collapsed;
  await save({ collapsed: nextCollapsed });
  collapsed = nextCollapsed;
  document.body.classList.toggle('collapsed', collapsed);
  $('collapse').textContent = collapsed ? '+' : '−';
  await win.setSize(new native.dpi.LogicalSize(360, collapsed ? 110 : expandedHeight));
}
function action(id, fn) { $(id).onclick = async () => { try { $('error').textContent = ''; await fn(); } catch (err) { error(err); } }; }
$('idleOpacity').oninput = () => previewOpacity($('idleOpacity').value);
if (native) {
  $('dragRegion').addEventListener('mousedown', event => {
    if (event.button !== 0 || event.target.closest('button')) return;
    event.preventDefault();
    native.window.getCurrentWindow().startDragging().catch(error);
  });
  action('select', async () => { await invoke('select_database'); fill((await invoke('status')).preferences); await refresh(); });
  action('open', () => invoke('open_persona'));
  action('hide', () => native.window.getCurrentWindow().hide());
  action('collapse', toggleCollapse);
  action('save', async () => { await save(); $('error').textContent = 'Ajustes salvos.'; });
  action('settingsToggle', () => { $('settings').hidden = !$('settings').hidden; $('settingsToggle').setAttribute('aria-expanded', String(!$('settings').hidden)); });
  const auto = native.core;
  $('autostart').onchange = async () => {
    try { await auto.invoke(`plugin:autostart|${$('autostart').checked ? 'enable' : 'disable'}`); }
    catch (err) { $('autostart').checked = !$('autostart').checked; error(err); }
  };
  auto.invoke('plugin:autostart|is_enabled').then(enabled => $('autostart').checked = enabled).catch(error);
  refresh(); setInterval(refresh, 1000);
} else {
  $('connection').textContent = 'Visualização de desenvolvimento: abra com Tauri para vincular um banco.';
  $('plan').innerHTML = renderPlan(null);
}
