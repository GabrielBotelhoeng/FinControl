// O web-push 4 é ESM só com exports nomeados (sem `default`).
import { sendNotification } from 'web-push';

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url: string; tag: string };
/** `gone`: o serviço respondeu 404/410, a assinatura expirou e deve ser apagada (W3). */
export type PushResult = 'sent' | 'gone' | 'failed';
export type PushSender = (target: PushTarget, payload: PushPayload) => Promise<PushResult>;

export type VapidKeys = { publicKey: string; privateKey: string; subject: string };

/** Envio real pela biblioteca `web-push` (spec do sub-projeto 5, Parte B, W1). Nos testes, entra um falso. */
export function createWebPushSender(vapid: VapidKeys): PushSender {
  return async (target, payload) => {
    try {
      await sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        // 1 dia: um aviso de conta não vale nada depois disso. `urgency: normal` respeita o modo economia do celular.
        { vapidDetails: vapid, TTL: 24 * 60 * 60, urgency: 'normal', timeout: 10_000 },
      );
      return 'sent';
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      return status === 404 || status === 410 ? 'gone' : 'failed';
    }
  };
}
