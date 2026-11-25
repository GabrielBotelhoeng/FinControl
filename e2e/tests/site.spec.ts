import { expect, test, type Page } from '@playwright/test';
import { enterDemo, openSite } from './helpers';

/** Rola a página inteira devagar, para todas as seções dispararem a revelação (whileInView), e volta ao topo. */
async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    for (let y = 0; y < document.documentElement.scrollHeight; y += 300) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
}

const hero = (page: Page) => page.getByRole('region', { name: 'Seu dinheiro, sob controle.' });

test('sem sessão, a / mostra o site de apresentação, e as rotas protegidas continuam levando à entrada', async ({ page }) => {
  await openSite(page, '/');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Seu dinheiro, sob controle.' })).toBeVisible();
  await expect(page).toHaveTitle(/FinControl — controle financeiro pessoal/);
  await page.goto('/lancamentos');
  await expect(page).toHaveURL(/\/entrar/);
});

for (const width of [360, 390, 1440]) {
  test(`sem rolagem horizontal a ${width} px, com todas as seções reveladas`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 360 ? 640 : width < 1000 ? 800 : 900 });
    await openSite(page, '/');
    await expect(hero(page)).toBeVisible();
    await scrollThrough(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const id of ['recursos', 'planos', 'perguntas']) await expect(page.locator(`#${id} h2`)).toBeVisible();
    await page.waitForTimeout(900); // a última revelação termina de subir
    // O toBeVisible não olha a opacidade: confere a calculada de cada ancestral, em todo título, item e cartão que está
    // na tela (inclusive os cartões dos recursos no celular), fora as respostas fechadas do acordeão (CodeRabbit, PR #39).
    const transparent = await page.evaluate(() =>
      [...document.querySelectorAll('main h2, main h3, main li')]
        .filter((el) => el.getClientRects().length > 0 && !el.closest('[inert]'))
        .filter((el) => {
          for (let n: Element | null = el; n; n = n.parentElement) if (Number(getComputedStyle(n).opacity) < 0.5) return true;
          return false;
        })
        .map((el) => (el.textContent ?? '').trim().slice(0, 40)),
    );
    expect(transparent).toEqual([]);
  });
}

test('"Experimentar sem cadastro" do herói abre o painel da demo', async ({ page }) => {
  await openSite(page, '/');
  await hero(page).getByRole('button', { name: 'Experimentar sem cadastro' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByText('Criar conta de verdade')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Seu dinheiro, sob controle.' })).toHaveCount(0);
});

test('com sessão, a / continua sendo o painel', async ({ page }) => {
  await enterDemo(page);
  await openSite(page, '/');
  await expect(page.getByText('Criar conta de verdade')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Seu dinheiro, sob controle.' })).toHaveCount(0);
});

test('a chave dos planos troca o preço do Completo', async ({ page }) => {
  await openSite(page, '/#planos');
  const price = page.getByTestId('preco-complete');
  await expect(price).toContainText('por mês');
  await expect(price).toContainText('9,90');
  await page.getByRole('radiogroup', { name: 'Forma de pagamento' }).getByRole('radio', { name: /Anual/ }).click();
  await expect(price).toContainText('por ano');
  await expect(price).toContainText('99,00');
  await expect(page.getByText('Preços de lançamento, provisórios')).toBeVisible();
});

test('os botões escuros sobre o limão têm texto visível (QA E-001)', async ({ page }) => {
  await openSite(page, '/');
  await scrollThrough(page);
  const buttons = [
    page.getByRole('button', { name: 'Experimentar o Completo' }),
    page.getByRole('region', { name: /Comece agora/ }).getByRole('button', { name: 'Experimentar sem cadastro' }),
  ];
  for (const button of buttons) {
    const { color, background } = await button.evaluate((el) => {
      const style = getComputedStyle(el);
      return { color: style.color, background: style.backgroundColor };
    });
    expect(color, 'cor do texto igual à do fundo').not.toBe(background);
    expect(color).toBe('rgb(200, 242, 75)'); // o limão, só sobre o quase-preto (DESIGN.md)
  }
});

test('a 390 px, o "Experimentar" do cabeçalho tem folga da borda', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSite(page, '/');
  const right = await page.getByRole('banner').getByRole('button', { name: 'Experimentar' }).evaluate((el) => el.getBoundingClientRect().right);
  // O portal do celular perde ~10 px para a barra de rolagem; o botão precisa terminar antes disso.
  expect(right).toBeLessThanOrEqual(390 - 16);
});

test('as duas faixas em X andam em sentidos opostos e o fundo flutua só com transform (sub-projeto 20)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSite(page, '/');
  const tracks = await page.locator('.site-marquee-track').evaluateAll((els) =>
    els.map((el) => ({ name: getComputedStyle(el).animationName, direction: getComputedStyle(el).animationDirection, hidden: el.getAttribute('aria-hidden') })),
  );
  expect(tracks.map((t) => t.direction)).toEqual(['reverse', 'reverse', 'normal', 'normal']);
  expect(tracks.every((t) => t.name === 'site-marquee')).toBe(true);
  expect(tracks.map((t) => t.hidden)).toEqual([null, 'true', null, 'true']);
  // Os elementos do fundo: escondidos do leitor de tela, sem receber toque, e as animações só mexem em transform.
  const layers = await page.locator('[data-backdrop]').evaluateAll((els) =>
    els.map((el) => ({ hidden: el.getAttribute('aria-hidden'), pointer: getComputedStyle(el).pointerEvents })),
  );
  expect(layers.length).toBeGreaterThanOrEqual(4);
  expect(layers.every((l) => l.hidden === 'true' && l.pointer === 'none')).toBe(true);
  const props = await page.evaluate(() =>
    [...new Set(document.getAnimations().flatMap((a) => ((a.effect as KeyframeEffect | null)?.getKeyframes() ?? []).flatMap((k) => Object.keys(k))))],
  );
  const animated = props.filter((p) => !['offset', 'computedOffset', 'easing', 'composite'].includes(p));
  expect(animated.every((p) => ['transform', 'opacity'].includes(p)), animated.join(', ')).toBe(true);
});

for (const width of [1920, 1440, 360]) {
  test(`a ${width} px, cada lista das faixas cobre a largura da faixa (sem lado vazio no fim da volta)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openSite(page, '/');
    const gaps = await page.evaluate(() =>
      [...document.querySelectorAll('.site-marquee')].flatMap((strip) =>
        [...strip.querySelectorAll('ul')].map((ul) => Math.round(ul.scrollWidth - (strip as HTMLElement).offsetWidth)),
      ),
    );
    expect(gaps).toHaveLength(4);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(0);
  });
}

for (const width of [360, 390]) {
  test(`a ${width} px, as duas faixas em X ficam legíveis: cada uma com pelo menos 2 termos inteiros à vista (QA)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await openSite(page, '/');
    await page.locator('section[aria-label="O que o FinControl faz"]').scrollIntoViewIfNeeded();
    // As faixas andam: conta, em 10 instantes, os termos inteiros à vista em cada uma (dentro da tela e sem nada por cima
    // em três pontos ao longo do termo) e exige a mediana de 2 ou mais.
    const counts: [number[], number[]] = [[], []];
    for (let i = 0; i < 10; i++) {
      const [back, front] = await page.evaluate(() =>
        [...document.querySelectorAll('.site-marquee')].map(
          (strip) =>
            // Todo rótulo com texto conta (as repetições são `aria-hidden`, mas aparecem na tela).
            [...strip.querySelectorAll('ul > li')].filter((li) => {
              if (!li.textContent) return false;
              const r = li.getBoundingClientRect();
              if (r.left < 0 || r.right > innerWidth) return false;
              return [0.15, 0.5, 0.85].every((f) => {
                const hit = document.elementFromPoint(r.left + r.width * f, r.top + r.height / 2);
                return hit === li || li.contains(hit);
              });
            }).length,
        ),
      );
      counts[0].push(back ?? 0);
      counts[1].push(front ?? 0);
      await page.waitForTimeout(600);
    }
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
    expect(median(counts[0]), `faixa de trás: ${counts[0].join(',')}`).toBeGreaterThanOrEqual(2);
    expect(median(counts[1]), `faixa da frente: ${counts[1].join(',')}`).toBeGreaterThanOrEqual(2);
  });
}

test.describe('com prefers-reduced-motion', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('todo o conteúdo aparece parado, sem precisar rolar, a faixa não anda e as âncoras não rolam animadas', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openSite(page, '/');
    await expect(hero(page)).toBeVisible();
    // Sem rolar: nada depende da revelação para aparecer. Textos com opacidade parcial de propósito (0,7–0,8) contam
    // como visíveis; as respostas fechadas do acordeão (inert) ficam de fora.
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll('main h2, main h3, main li, main p')]
        .filter((el) => !el.closest('[inert]'))
        .filter((el) => {
          for (let n: Element | null = el; n; n = n.parentElement) if (Number(getComputedStyle(n).opacity) < 0.5) return true;
          return false;
        })
        .map((el) => (el.textContent ?? '').slice(0, 40)),
    );
    expect(hidden).toEqual([]);
    // As duas faixas em X e os elementos flutuando no fundo ficam parados (sub-projeto 20).
    const moving = await page.evaluate(() =>
      [...document.querySelectorAll('.site-marquee-track, [data-backdrop] *')].filter((el) => getComputedStyle(el).animationName !== 'none').length,
    );
    expect(moving).toBe(0);
    expect(await page.locator('.site-marquee-track').count()).toBe(4);
    // As âncoras do cabeçalho também não rolam animadas.
    const scrollBehavior = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    expect(scrollBehavior).toBe('auto');
  });
});
