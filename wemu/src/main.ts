import { App } from './app';

const root = document.getElementById('app')!;
const app = new App(root);
(window as unknown as { __app: App }).__app = app;
app.init().catch((e) => console.error(e));

// keep layout responsive: re-render the CURRENT screen (not always system)
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const a = app as unknown as {
      screen: string;
      renderSystem: (a?: string) => Promise<void>;
      enterGamelist: () => Promise<void>;
    };
    if (a.screen === 'game' || document.querySelector('.upload-overlay') || document.querySelector('.mainmenu-overlay')) return;
    if (a.screen === 'gamelist') void a.enterGamelist();
    else void a.renderSystem();
  }, 300);
});
