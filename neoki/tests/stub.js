/* ===== DOMスタブ（innerHTML内の id を走査して要素登録） ===== */
const __registry = {};
function __makeEl(id){
  const el = {
    id: id || '', children: [], style: {}, dataset: {}, scrollTop: 0, scrollHeight: 0, textContent: '', value: '',
    _html: '', _listeners: {},
    classList: {
      _s: new Set(),
      add(...cs){ cs.forEach(c => this._s.add(c)); },
      remove(...cs){ cs.forEach(c => this._s.delete(c)); },
      toggle(c, force){ if (force === undefined) force = !this._s.has(c); force ? this._s.add(c) : this._s.delete(c); return force; },
      contains(c){ return this._s.has(c); },
    },
    addEventListener(ev, fn){ (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    removeEventListener(){},
    click(){ (this._listeners.click || []).forEach(f => f()); },
    appendChild(c){ this.children.push(c); return c; },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    getContext(){ return new Proxy({}, { get: (t, k) => (k === 'canvas' ? el : () => {}) }); },
    toDataURL(){ return 'data:image/png;base64,STUB'; },
  };
  Object.defineProperty(el, 'innerHTML', {
    get(){ return this._html; },
    set(v){
      this._html = String(v);
      const re = /id="([^"]+)"/g; let mm;
      while ((mm = re.exec(this._html)) !== null){ if (!__registry[mm[1]]) __registry[mm[1]] = __makeEl(mm[1]); }
    },
  });
  return el;
}
['callTime','callStat','gSleep','gSusp','vSleep','vSusp','rateMul','log','nowText','qcount','optsWrap','honneBtn','aizuchi','amonText','timingZone','timingMark','slapBtn','slapLeft','startScr','endScr','endResult','endTitle','endSub','endLine','endLineText','endStats','zukan','zukanStart','shareCanvas','stageList'].forEach(id => { __registry[id] = __makeEl(id); });
globalThis.document = {
  getElementById: id => __registry[id] || null,
  createElement: tag => __makeEl(''),
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener(){}, body: __makeEl('body'),
};
globalThis.window = { open(){ return null; } };
globalThis.location = { href: 'https://example.invalid/neoki/', reload(){} };
const __store = {};
globalThis.localStorage = {
  getItem: k => (k in __store ? __store[k] : null),
  setItem: (k, v) => { __store[k] = String(v); },
  removeItem: k => { delete __store[k]; },
};
