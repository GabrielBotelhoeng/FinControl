import { useEffect } from 'react';

/** Endereço público do site (canonical, og:url, sitemap). */
export const SITE_URL = 'https://fincontrol-gb.vercel.app';

export type PublicPath = '/' | '/privacidade' | '/termos';
type Head = { title: string; description: string };

/**
 * A cabeça própria de cada página pública (sub-projeto 18, E6): o build a escreve no HTML gerado de cada rota
 * (src/prerender.tsx) e o cliente a aplica ao navegar entre elas. A da home é a mesma do index.html (teste).
 */
export const PUBLIC_HEAD: Record<PublicPath, Head> = {
  '/': {
    title: 'FinControl — controle financeiro pessoal no celular e no computador',
    description:
      'Saiba quanto entra, quanto sai e o que vence no mês. Contas, cartões, faturas, orçamento, metas e relatórios num app simples, em português. Experimente sem cadastro.',
  },
  '/privacidade': {
    title: 'Política de Privacidade — FinControl',
    description:
      'Quais dados o FinControl trata, para quê, onde ficam guardados e como você corrige, exporta ou apaga tudo, conforme a LGPD. Em linguagem direta.',
  },
  '/termos': {
    title: 'Termos de Uso — FinControl',
    description:
      'As regras de uso do FinControl: quem pode usar, o modo demonstração, o que o app é e o que não é, preço, seus dados e a sua conta.',
  },
};

export const canonicalUrl = (path: PublicPath) => `${SITE_URL}${path}`;

/** Os pontos da cabeça que mudam de uma página pública para outra: [seletor, atributo, valor]. */
export function headEntries(path: PublicPath): [selector: string, attribute: string, value: string][] {
  const { title, description } = PUBLIC_HEAD[path];
  const url = canonicalUrl(path);
  return [
    ['meta[name="description"]', 'content', description],
    ['link[rel="canonical"]', 'href', url],
    ['meta[property="og:url"]', 'content', url],
    ['meta[property="og:title"]', 'content', title],
    ['meta[property="og:description"]', 'content', description],
    ['meta[name="twitter:title"]', 'content', title],
    ['meta[name="twitter:description"]', 'content', description],
  ];
}

/**
 * Aplica a cabeça da página pública enquanto ela está aberta e devolve a anterior ao sair (as telas do app trocam só o
 * título). Só mexe no que já existe no documento: na casca do app não há canonical, e ele não é criado.
 */
export function usePublicHead(path: PublicPath) {
  useEffect(() => {
    const previousTitle = document.title;
    const previous = headEntries(path).map(([selector, attribute, value]) => {
      const element = document.head.querySelector(selector);
      const before = element?.getAttribute(attribute) ?? null;
      element?.setAttribute(attribute, value);
      return [element, attribute, before] as const;
    });
    document.title = PUBLIC_HEAD[path].title;
    return () => {
      document.title = previousTitle;
      for (const [element, attribute, before] of previous) if (element && before !== null) element.setAttribute(attribute, before);
    };
  }, [path]);
}
