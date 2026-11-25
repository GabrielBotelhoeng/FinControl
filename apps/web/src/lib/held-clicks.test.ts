import { afterEach, describe, expect, it } from 'vitest';
import { holdButtonClicks } from './held-clicks';

/** Um #root com botões que anotam o próprio nome quando o clique chega até eles (como o app, depois da hidratação). */
function setup() {
  const root = document.createElement('div');
  const log: string[] = [];
  for (const name of ['a', 'b', 'c']) {
    const button = document.createElement('button');
    button.textContent = name;
    button.addEventListener('click', () => log.push(name));
    root.appendChild(button);
  }
  const link = document.createElement('a');
  link.href = '#destino';
  root.appendChild(link);
  document.body.appendChild(root);
  const button = (name: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === name)!;
  return { root, log, button, link };
}

describe('toques antes da hidratação (sub-projeto 18, revisão)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('guarda os toques em botões sem deixar chegar ao app e, ao soltar, repete todos na ordem, sem duplicar', () => {
    const { root, log, button } = setup();
    const { release } = holdButtonClicks(root);
    button('b').click();
    button('a').click();
    button('b').click();
    expect(log).toEqual([]);
    release();
    expect(log).toEqual(['b', 'a']);
  });

  it('depois de soltar, os toques chegam direto, e um botão que saiu da página não é repetido', () => {
    const { root, log, button } = setup();
    const { release } = holdButtonClicks(root);
    button('c').click();
    button('a').click();
    button('c').remove();
    release();
    expect(log).toEqual(['a']);
    button('b').click();
    expect(log).toEqual(['a', 'b']);
  });

  it('links não são segurados (navegam sozinhos, sem o JavaScript)', () => {
    const { root, link } = setup();
    holdButtonClicks(root);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('se o app não vier (desistiu), o toque guardado não fica preso: a página recarrega', () => {
    const { root, log, button } = setup();
    let reloads = 0;
    const { giveUp } = holdButtonClicks(root, () => reloads++);
    button('a').click();
    giveUp();
    expect(reloads).toBe(1);
    expect(log).toEqual([]);
  });

  it('desistiu sem toque guardado: o próximo toque num botão recarrega a página (links seguem sozinhos)', () => {
    const { root, button, link } = setup();
    let reloads = 0;
    const { giveUp } = holdButtonClicks(root, () => reloads++);
    giveUp();
    expect(reloads).toBe(0);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(reloads).toBe(0);
    button('b').click();
    expect(reloads).toBe(1);
  });
});
