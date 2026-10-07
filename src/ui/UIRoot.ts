/** Thin helpers around the #ui DOM overlay root. All menus/HUD/captions are semantic HTML drawn over the canvas. */

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(label: string, onClick: () => void, className = ''): HTMLButtonElement {
  const b = el('button', `bb-btn ${className}`.trim(), label);
  b.type = 'button';
  b.addEventListener('click', (e) => { e.preventDefault(); onClick(); });
  return b;
}

export class UIRoot {
  private static _root: HTMLElement | null = null;
  static get root(): HTMLElement {
    if (!this._root) {
      this._root = document.getElementById('ui') ?? document.body.appendChild(el('div'));
      this._root.id = 'ui';
    }
    return this._root;
  }

  static mount(node: HTMLElement): HTMLElement {
    this.root.appendChild(node);
    return node;
  }

  private static toastTimer: number | null = null;
  static toast(text: string, ms = 2200): void {
    this.root.querySelector('.bb-toast')?.remove();
    const t = this.mount(el('div', 'bb-toast', text));
    t.setAttribute('role', 'status');
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.remove(), ms);
  }
}

/** Keyboard focus trap for modal menus: Tab cycles inside, arrows move between buttons. */
export function trapFocus(panel: HTMLElement): () => void {
  const focusables = (): HTMLElement[] => Array.from(panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((n) => !n.hasAttribute('disabled'));
  const onKey = (e: KeyboardEvent): void => {
    const items = focusables();
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Tab') {
      e.preventDefault();
      const next = items[(idx + (e.shiftKey ? -1 : 1) + items.length) % items.length];
      next.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === 'SELECT' || (active as HTMLInputElement).type === 'range')) return;
      e.preventDefault();
      const next = items[(idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
      next.focus();
    }
  };
  panel.addEventListener('keydown', onKey);
  queueMicrotask(() => focusables()[0]?.focus());
  return () => panel.removeEventListener('keydown', onKey);
}
