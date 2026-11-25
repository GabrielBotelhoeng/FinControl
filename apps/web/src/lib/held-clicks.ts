/**
 * Segura os toques em botões dentro de `root` enquanto o app não assumiu (antes da hidratação, um botão não faria nada)
 * e devolve a função que os solta: cada botão tocado é repetido uma vez, na ordem do primeiro toque, se ainda estiver na
 * página. Links não são segurados: navegam sozinhos, sem o JavaScript (sub-projeto 18).
 */
export function holdButtonClicks(root: HTMLElement): () => void {
  const held: HTMLButtonElement[] = [];
  const hold = (event: MouseEvent) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (!held.includes(button)) held.push(button);
  };
  root.addEventListener('click', hold, true);
  return () => {
    root.removeEventListener('click', hold, true);
    // O React repete o clique assim que a parte tocada estiver hidratada.
    for (const button of held) if (button.isConnected) button.click();
  };
}
