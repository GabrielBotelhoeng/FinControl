/*
 * Web Push do FinControl (sub-projeto 5, Parte B, W7). Carregado pelo service worker do PWA via `importScripts`.
 * Mostra o aviso que a API manda e, no clique, abre (ou foca) o app no endereço do aviso, sempre no próprio site.
 */
self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'FinControl';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || 'fincontrol',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      lang: 'pt-BR',
      data: { url: data.url || '/notificacoes' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Só caminhos do próprio site: um endereço externo vira a central de notificações.
  const requested = new URL((event.notification.data && event.notification.data.url) || '/notificacoes', self.location.origin);
  const url = requested.origin === self.location.origin ? requested.href : new URL('/notificacoes', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        // `navigate` rejeita numa janela que este service worker não controla (ex.: depois de Shift+F5).
        if ('focus' in w) return w.navigate(url).then((c) => (c || w).focus()).catch(() => self.clients.openWindow(url));
      }
      return self.clients.openWindow(url);
    }),
  );
});
