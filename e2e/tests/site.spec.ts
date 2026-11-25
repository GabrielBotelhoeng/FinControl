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
    const marquee = await page.locator('.site-marquee-track').first().evaluate((el) => getComputedStyle(el).animationName);
    expect(marquee).toBe('none');
    // As âncoras do cabeçalho também não rolam animadas.
    const scrollBehavior = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    expect(scrollBehavior).toBe('auto');
  });
});
