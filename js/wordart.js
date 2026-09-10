// wordart.js — 単語の「絵」をDOM要素にする（words.jsのkindごとの描画）
// 絵文字はそのまま、いろは色の丸、かずは数字＋ドット、かたちはSVGで描く。
// ゲーム側は createWordVisual(word) を呼ぶだけ（描き方の違いを知らなくてよい）。

const SVG_NS = 'http://www.w3.org/2000/svg';

function shapePath(name) {
  switch (name) {
    case 'circle': return { tag: 'circle', attrs: { cx: 50, cy: 50, r: 40 } };
    case 'square': return { tag: 'rect', attrs: { x: 12, y: 12, width: 76, height: 76, rx: 6 } };
    case 'rectangle': return { tag: 'rect', attrs: { x: 6, y: 26, width: 88, height: 48, rx: 6 } };
    case 'oval': return { tag: 'ellipse', attrs: { cx: 50, cy: 50, rx: 44, ry: 28 } };
    case 'triangle': return { tag: 'polygon', attrs: { points: '50,10 92,88 8,88' } };
    case 'diamond': return { tag: 'polygon', attrs: { points: '50,6 92,50 50,94 8,50' } };
    case 'star': return { tag: 'polygon', attrs: { points: '50,6 61,38 95,38 67,58 78,92 50,71 22,92 33,58 5,38 39,38' } };
    case 'heart': return {
      tag: 'path',
      attrs: { d: 'M50 88 C20 66 6 50 6 32 A18 18 0 0 1 50 24 A18 18 0 0 1 94 32 C94 50 80 66 50 88 Z' },
    };
    default: return { tag: 'circle', attrs: { cx: 50, cy: 50, r: 40 } };
  }
}

export function createWordVisual(word, { color = '#f28b3b' } = {}) {
  const el = document.createElement('span');
  el.className = `kgb-wordart kgb-wordart-${word.kind}`;
  if (word.kind === 'emoji') {
    el.textContent = word.value;
  } else if (word.kind === 'color') {
    const dot = document.createElement('span');
    dot.className = 'kgb-wordart-dot';
    dot.style.background = word.value;
    el.append(dot);
  } else if (word.kind === 'number') {
    const digit = document.createElement('span');
    digit.className = 'kgb-wordart-digit';
    digit.textContent = String(word.value);
    // ドットは1個ずつ別要素にして5個で折り返す（文字列だと折り返せず右にはみ出す）
    const dots = document.createElement('span');
    dots.className = 'kgb-wordart-dots';
    for (let i = 0; i < word.value; i++) {
      const dot = document.createElement('span');
      dot.className = 'kgb-wordart-dotsm';
      dot.textContent = '●';
      dots.append(dot);
    }
    el.append(digit, dots);
  } else if (word.kind === 'shape') {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', 'kgb-wordart-svg');
    const { tag, attrs } = shapePath(word.value);
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    node.setAttribute('fill', color);
    svg.append(node);
    el.append(svg);
  }
  return el;
}
