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

  it('o JSON-LD é válido, só com a oferta grátis (os preços pagos são provisórios, sub-projeto 18, E8) e as mesmas perguntas do site', () => {
    const blocks = [...doc.querySelectorAll('script[type="application/ld+json"]')];
    expect(blocks).toHaveLength(1);
    const nodes = JSON.parse(blocks[0]!.textContent ?? '') as LdNode[];

    const app = nodes.find((n) => n['@type'] === 'SoftwareApplication')!;
    expect(app.offers!.length).toBeGreaterThan(0);
    for (const o of app.offers!) {
      expect(Number(o.price)).toBe(0);
      expect(o.priceCurrency).toBe('BRL');
    }
    expect(PLANS.some((p) => p.monthlyCents === 0)).toBe(true);

    const faq = nodes.find((n) => n['@type'] === 'FAQPage')!;
    expect(faq.mainEntity!.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(FAQ.map((f) => [f.question, f.answer]));
  });

  it('robots.txt aponta o sitemap, e o sitemap lista só as páginas públicas (sem a /entrar)', () => {
    expect(read('public/robots.txt')).toContain('Sitemap: https://fincontrol-gb.vercel.app/sitemap.xml');
    const sitemap = read('public/sitemap.xml');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(['', 'privacidade', 'termos'].map((path) => `https://fincontrol-gb.vercel.app/${path}`));
  });
});
