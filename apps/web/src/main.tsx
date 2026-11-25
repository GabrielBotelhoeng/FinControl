import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root ausente');

/**
 * Chama `fn` depois da primeira pintura com conteúdo (o evento `paint` do navegador), ou em 1,5 s se ele não vier.
 * O HTML estático não espera o app: no Lighthouse do celular, baixar e avaliar o app antes de pintar segurava o FCP e
 * o LCP (sub-projeto 18, E11).
 */
function afterFirstPaint(fn: () => void) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    fn();
  };
  try {
    new PerformanceObserver((list, observer) => {
      if (!list.getEntriesByName('first-contentful-paint').length) return;
      observer.disconnect();
      run();
    }).observe({ type: 'paint', buffered: true });
  } catch {
    // Sem a medida de pintura: só o limite de tempo.
  }
  setTimeout(run, 1500);
}

// O HTML estático vale (sub-projeto 18, E3)? Então ele é pintado antes de o app chegar, e o pedaço do app (React,
// roteador, login) vem depois. Fora disso, o app carrega na hora (o theme-init.js já o adiantou).
const hydrate = root.dataset.prerenderedRoute !== undefined && document.documentElement.dataset.boot === 'static';

// Um botão tocado antes da hidratação (ex.: "Experimentar sem cadastro") não faria nada: o toque fica guardado e é
// repetido quando o app assume. Links continuam valendo sozinhos (navegam sem o JavaScript).
let heldButton: HTMLButtonElement | null = null;
const holdButtonClick = (event: MouseEvent) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  heldButton = button;
};

const start = () =>
  void import('./boot')
    .then(({ boot }) => boot(root, hydrate))
    .finally(() => {
      root.removeEventListener('click', holdButtonClick, true);
      // O React repete o clique assim que a parte tocada estiver hidratada.
      if (heldButton?.isConnected) heldButton.click();
    });

if (hydrate) {
  root.addEventListener('click', holdButtonClick, true);
  afterFirstPaint(start);
} else start();
