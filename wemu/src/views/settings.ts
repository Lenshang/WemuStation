// Settings overlay: configure frontend navigation bindings (keyboard keys and
// gamepad buttons) plus the in-game gamepad combos. In-game per-button mapping
// is owned by the RetroArch menu (F1 -> Controls) and persisted via the
// retroarch.cfg sync.
import type { InputManager } from '../input/input';
import type { NavButton } from '../types';

const ACTION_LABELS: Record<NavButton, string> = {
  up: '向上 ↑', down: '向下 ↓', left: '向左 ←', right: '向右 →',
  accept: '确定（进入/运行）', cancel: '返回', menu: '菜单 / 导入 ROM', option: '选项',
  search: '搜索游戏（列表内）'
};

export function openSettingsPanel(root: HTMLElement, input: InputManager, onRAMenu?: () => void): () => void {
  if (document.querySelector('.settings-overlay')) return () => {};
  const overlay = document.createElement('div');
  overlay.className = 'upload-overlay settings-overlay';
  let monitorTimer = 0;

  const render = () => {
    overlay.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'upload-card';
    card.style.maxHeight = '88vh';
    card.style.overflowY = 'auto';
    card.innerHTML = `
      <h2>按键设置</h2>
      <p><strong>前端界面</strong>（系统选择 / 游戏列表）的键盘与手柄映射，保存在浏览器本地。<br>
      <strong>游戏内按键</strong>：进游戏按 F1 打开 RetroArch 菜单 → Controls 配置并保存（自动持久化）。</p>
      <table class="bind-table"><thead><tr><th>动作</th><th>键盘</th><th></th><th>手柄</th><th></th></tr></thead><tbody></tbody></table>
      <h3 style="margin:18px 0 4px;font-size:15px;color:#e5e7eb">游戏内组合键（手柄）</h3>
      <table class="bind-table"><tbody>
        <tr><td>退出到主界面</td><td class="bind-val" data-combo="exit"></td><td><button class="mini" data-combo-set="exit">改</button></td></tr>
        <tr><td>呼出 RA 菜单</td><td class="bind-val" data-combo="menu"></td><td><button class="mini" data-combo-set="menu">改</button></td></tr>
      </tbody></table>
      <p style="margin:8px 0 0;font-size:12px;color:#9ca3af">点「改」后依次按下手柄上想组合的两个键（如 Select、Start）。</p>
      <h3 style="margin:18px 0 4px;font-size:15px;color:#e5e7eb">手柄按钮监视器</h3>
      <div class="pad-monitor">按手柄任意键，这里会显示按钮编号（可用于确认 Select / X 等键的实际编号）</div>
      <div class="row" style="margin-top:16px">
        <button class="ghost" data-act="ramenu">打开 RA 主菜单（设置/语言）</button>
        <button class="ghost" data-act="reset">恢复默认</button>
        <button data-act="close">关闭</button>
      </div>`;

    const tbody = card.querySelector('tbody')!;
    for (const action of Object.keys(ACTION_LABELS) as NavButton[]) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${ACTION_LABELS[action]}</td>
        <td class="bind-val" data-k="${action}">${esc(input.keyLabel(action))}</td>
        <td><button class="mini" data-device="keys" data-action="${action}">改</button></td>
        <td class="bind-val" data-p="${action}">${esc(input.padLabel(action))}</td>
        <td><button class="mini" data-device="pad" data-action="${action}">改</button></td>`;
      tbody.appendChild(tr);
    }

    // combo labels
    const comboLabel = (combo: number[]) => combo.map((n) => 'Btn ' + n).join(' + ') || '—';
    (card.querySelector('[data-combo="exit"]') as HTMLElement).textContent = comboLabel(input.combos.exit);
    (card.querySelector('[data-combo="menu"]') as HTMLElement).textContent = comboLabel(input.combos.menu);

    const status = document.createElement('p');
    status.className = 'bind-status';
    card.insertBefore(status, card.querySelector('.row'));

    // nav binding capture
    card.querySelectorAll('button.mini[data-device]').forEach((b) => {
      b.addEventListener('click', async () => {
        const device = (b as HTMLElement).dataset.device as 'keys' | 'pad';
        const action = (b as HTMLElement).dataset.action as NavButton;
        status.textContent = device === 'keys'
          ? `请按下要绑定给「${ACTION_LABELS[action]}」的键盘按键…`
          : `请按下手柄上要绑定给「${ACTION_LABELS[action]}」的按钮…`;
        const v = await input.capture(action, device);
        status.textContent = '';
        render();
        void v;
      });
    });

    // in-game combo capture: wait for two gamepad buttons pressed in turn
    card.querySelectorAll('button[data-combo-set]').forEach((b) => {
      b.addEventListener('click', () => {
        const which = (b as HTMLElement).dataset.comboSet as 'exit' | 'menu';
        const picked: number[] = [];
        status.textContent = '请按下手柄组合的第一个键…';
        const listen = () => {
          const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter((p): p is Gamepad => !!p) : [];
          for (const pad of pads) {
            pad.buttons.forEach((bt, idx) => {
              if (bt.pressed && !picked.includes(idx)) {
                picked.push(idx);
                if (picked.length === 1) status.textContent = '已记录第一个键，请按第二个键…';
                if (picked.length >= 2) {
                  input.combos[which] = picked;
                  input.saveCombos();
                  clearTimeout(monitorTimer);
                  status.textContent = '';
                  render();
                  return;
                }
              }
            });
          }
          if (document.querySelector('.settings-overlay')) monitorTimer = window.setTimeout(listen, 60);
        };
        listen();
      });
    });

    // gamepad button monitor
    const monitor = card.querySelector('.pad-monitor') as HTMLElement;
    const watch = () => {
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter((p): p is Gamepad => !!p) : [];
      const pressed: number[] = [];
      for (const pad of pads) pad.buttons.forEach((bt, idx) => { if (bt.pressed) pressed.push(idx); });
      if (pressed.length) monitor.textContent = '按下中：Btn ' + pressed.join(', Btn ');
      if (document.querySelector('.settings-overlay')) monitorTimer = window.setTimeout(watch, 80);
    };
    watch();

    card.querySelector('[data-act="reset"]')?.addEventListener('click', () => {
      input.resetBindings();
      input.resetCombos();
      render();
    });
    card.querySelector('[data-act="ramenu"]')?.addEventListener('click', () => {
      close();
      onRAMenu?.();
    });
    card.querySelector('[data-act="close"]')?.addEventListener('click', close);
    overlay.appendChild(card);
  };

  const close = () => {
    clearTimeout(monitorTimer);
    overlay.remove();
    input.cancelCapture();
  };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  render();
  root.appendChild(overlay);
  return close;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
