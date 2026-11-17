/* Native bridge is inert in the PWA. The full Persona window owns editing. */
(() => {
  if (!window.__TAURI__) return;
  const invoke = (command, args = {}) => window.__TAURI__.core.invoke(command, args);
  window.PersonaDesktop = { invoke };
  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('installAppBtn')?.classList.add('hidden');
    const button = document.createElement('button');
    button.className = 'btn'; button.id = 'desktopOverlay'; button.textContent = 'Hoje na área de trabalho';
    button.onclick = () => invoke('show_overlay').catch(error => alert(String(error)));
    document.querySelector('.top')?.append(button);
    document.title = 'Orizon Persona';
  });
})();
