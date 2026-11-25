// Só o que o src/prerender.test.tsx usa do jsdom (o pacote não traz tipos, e o @types/jsdom não está instalado).
declare module 'jsdom' {
  export class JSDOM {
    constructor(html: string);
    readonly window: Window & typeof globalThis;
  }
}
