/**
 * O que o navegador oferece para Web Push (sub-projeto 5, Parte B, W4). Fica atrás desta interface para a tela
 * ser testada sem service worker de verdade.
 */
export type PushSupport = 'supported' | 'unsupported' | 'ios-needs-install';
export type BrowserSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export type PushClient = {
  support(): PushSupport;
  permission(): NotificationPermission;
  /** A assinatura deste navegador, ou `null`. */
  current(): Promise<BrowserSubscription | null>;
  /** Pede a permissão (precisa do clique da pessoa) e assina com a chave pública da API. */
  subscribe(publicKey: string): Promise<BrowserSubscription>;
  unsubscribe(): Promise<string | null>;
};

const READY_TIMEOUT_MS = 5_000;

/** Sem service worker (ex.: `vite dev`), `ready` nunca resolve: desiste depois de alguns segundos. */
async function registration(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('O app ainda não terminou de carregar. Tente de novo.')), READY_TIMEOUT_MS)),
  ]);
}

function toKey(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64url}${'='.repeat((4 - (base64url.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function toJson(sub: PushSubscription): BrowserSubscription {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  return { endpoint: json.endpoint ?? sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } };
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export const browserPushClient: PushClient = {
  support() {
    const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (capable) return 'supported';
    // No iPhone, o Web Push só existe com o app instalado na tela inicial (iOS 16.4+).
    return isIos() && !isStandalone() ? 'ios-needs-install' : 'unsupported';
  },
  permission() {
    return Notification.permission;
  },
  async current() {
    const sub = await (await registration()).pushManager.getSubscription();
    return sub ? toJson(sub) : null;
  },
  async subscribe(publicKey) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Sem permissão para mostrar avisos neste navegador.');
    const reg = await registration();
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
    return toJson(sub);
  },
  async unsubscribe() {
    const sub = await (await registration()).pushManager.getSubscription();
    if (!sub) return null;
    const { endpoint } = sub;
    await sub.unsubscribe();
    return endpoint;
  },
};
