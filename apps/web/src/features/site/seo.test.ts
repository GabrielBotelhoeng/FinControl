import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FAQ } from './faq-data';
import { PLANS } from './pricing';
import { SITE_TITLE } from './site-page';

// O Vitest roda a partir de apps/web.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const doc = new DOMParser().parseFromString(read('index.html'), 'text/html');
const meta = (selector: string) => doc.querySelector(selector)?.getAttribute('content');

type Offer = { name: string; price: string; priceCurrency: string };
type LdNode = { '@type': string; offers?: Offer[]; mainEntity?: { name: string; acceptedAnswer: { text: string } }[] };

describe('SEO do index.html (sub-projeto 17, S11)', () => {
  it('título, descrição, canonical, Open Graph e Twitter Card', () => {
    expect(doc.title).toBe(SITE_TITLE);
    expect(meta('meta[name="description"]')?.length).toBeGreaterThan(80);
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://fincontrol-gb.vercel.app/');
    expect(meta('meta[property="og:locale"]')).toBe('pt_BR');
    expect(meta('meta[property="og:title"]')).toBe(SITE_TITLE);
    expect(meta('meta[property="og:image"]')).toBe('https://fincontrol-gb.vercel.app/og-image.png');
    expect(meta('meta[property="og:image:width"]')).toBe('1200');
    expect(meta('meta[property="og:image:height"]')).toBe('630');
    expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image');
  });

  it('não há script inline executável (a CSP só aceita scripts do próprio site); o JSON-LD é só dados', () => {
    for (const script of doc.querySelectorAll('script')) {
      if (script.getAttribute('type') === 'application/ld+json') continue;
      expect(script.getAttribute('src')).toBeTruthy();
    }
  });

  it('o JSON-LD é válido e tem os mesmos preços de pricing.ts e as mesmas perguntas do site', () => {
    const blocks = [...doc.querySelectorAll('script[type="application/ld+json"]')];
    expect(blocks).toHaveLength(1);
    const nodes = JSON.parse(blocks[0]!.textContent ?? '') as LdNode[];

    const app = nodes.find((n) => n['@type'] === 'SoftwareApplication')!;
    const prices = app.offers!.map((o) => Math.round(Number(o.price) * 100)).sort((a, b) => a - b);
    const expected = [...new Set(PLANS.flatMap((p) => [p.monthlyCents, p.yearlyCents]))].sort((a, b) => a - b);
    expect(prices).toEqual(expected);
    for (const o of app.offers!) expect(o.priceCurrency).toBe('BRL');

    const faq = nodes.find((n) => n['@type'] === 'FAQPage')!;
    expect(faq.mainEntity!.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(FAQ.map((f) => [f.question, f.answer]));
  });

  it('robots.txt aponta o sitemap, e o sitemap lista as páginas públicas', () => {
    expect(read('public/robots.txt')).toContain('Sitemap: https://fincontrol-gb.vercel.app/sitemap.xml');
    const sitemap = read('public/sitemap.xml');
    for (const path of ['', 'entrar', 'privacidade', 'termos']) expect(sitemap).toContain(`<loc>https://fincontrol-gb.vercel.app/${path}</loc>`);
  });
});
