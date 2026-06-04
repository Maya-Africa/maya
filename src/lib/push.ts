import webpush from 'web-push';

let initialized = false;

function ensureInitialized() {
  if (initialized) return;

  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE;
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    // In dev, skip gracefully. In production this would be caught by env validation.
    console.warn('Web Push VAPID keys not configured — notifications disabled.');
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  initialized = true;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send a Web Push notification to a single subscription.
 * Returns true on success, false on failure.
 * Throws a special error if the subscription is gone (410) so callers can delete it.
 */
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushPayload,
): Promise<boolean> {
  ensureInitialized();
  if (!initialized) return false;

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
    );
    return true;
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 410 || statusCode === 404) {
      // Subscription is expired or invalid — caller should delete it
      throw new ExpiredSubscriptionError(subscription.endpoint);
    }
    console.error('Push notification failed:', err);
    return false;
  }
}

export class ExpiredSubscriptionError extends Error {
  constructor(public endpoint: string) {
    super(`Push subscription expired: ${endpoint}`);
    this.name = 'ExpiredSubscriptionError';
  }
}
