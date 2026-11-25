/**
 * Segura os toques em botões dentro de `root` enquanto o app não assumiu (antes da hidratação, um botão não faria nada).
 * `release()`: o app chegou; cada botão tocado é repetido uma vez, na ordem do primeiro toque, se ainda estiver na página.
 * `giveUp()`: o app não vai chegar; o toque não fica preso: com algum guardado, a página recarrega; senão, o próximo
 * toque num botão recarrega. Links nunca são segurados: navegam sozinhos, sem o JavaScript (sub-projeto 18).
 */
export function holdButtonClicks(root: HTMLElement, reload: () => void = () => window.location.reload()) {
  const held: HTMLButtonElement[] = [];
  const buttonOf = (event: MouseEvent) => (event.target instanceof Element ? event.target.closest('button') : null);
  const hold = (event: MouseEvent) => {
    const button = buttonOf(event);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (!held.includes(button)) held.push(button);
  };
  root.addEventListener('click', hold, true);
  return {
    release() {
      root.removeEventListener('click', hold, true);
      // O React repete o clique assim que a parte tocada estiver hidratada.
      for (const button of held) if (button.isConnected) button.click();
    },
    giveUp() {
      root.removeEventListener('click', hold, true);
      if (held.length > 0) {
        reload();
        return;
      }
      root.addEventListener(
        'click',
        (event) => {
          if (buttonOf(event)) reload();
        },
        true,
      );
    },
  };
}
