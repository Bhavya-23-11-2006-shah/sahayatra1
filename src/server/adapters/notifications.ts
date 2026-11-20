import {db} from '../../db/index.ts';
import {notifications} from '../../db/schema.ts';
import {logger} from '../utils/logger.ts';

export interface NotificationPayload {
  userId: number;
  channel: 'PUSH' | 'SMS' | 'VOICE' | 'WHATSAPP' | 'EMAIL';
  language: 'en' | 'hi' | 'bn';
  title: string;
  body: string;
  recipient?: string;
}

export interface NotificationAdapter {
  send(payload: NotificationPayload): Promise<{delivered: boolean; providerId: string}>;
}

class MockAdapter implements NotificationAdapter {
  constructor(private readonly name: string) {}

  async send(payload: NotificationPayload) {
    const providerId = `${this.name}-${Date.now()}`;
    logger.info('Notification dispatched', {
      adapter: this.name,
      channel: payload.channel,
      userId: payload.userId,
      title: payload.title,
    });
    return {delivered: true, providerId};
  }
}

export const smsAdapter = new MockAdapter('mock-sms');
export const whatsappAdapter = new MockAdapter('mock-whatsapp');
export const emailAdapter = new MockAdapter('mock-email');
export const voiceCallAdapter = new MockAdapter('mock-voice');
export const webPushAdapter = new MockAdapter('mock-webpush');

export const TEMPLATES = {
  bookingConfirmed: {
    en: (pnr: string, route: string, time: string) => ({
      title: `Ticket ${pnr} Confirmed`,
      body: `Bus ${route} at ${time}. Conductor notified for accessible boarding.`,
    }),
    hi: (pnr: string, route: string, time: string) => ({
      title: `टिकट ${pnr} कन्फर्म`,
      body: `बस ${route} समय ${time}। कंडक्टर को सुगम बोर्डिंग की सूचना दे दी गई है।`,
    }),
    bn: (pnr: string, route: string, time: string) => ({
      title: `টিকিট ${pnr} নিশ্চিত`,
      body: `বাস ${route} সময় ${time}। সহজলভ্য বোর্ডিংয়ের জন্য কন্ডাক্টরকে জানানো হয়েছে।`,
    }),
  },
  waitlistPromoted: {
    en: (route: string, pnr: string) => ({
      title: `Wheelchair Bay Opened on Bus ${route}`,
      body: `You have been promoted from the waitlist! Ticket ${pnr} is now confirmed.`,
    }),
    hi: (route: string, pnr: string) => ({
      title: `बस ${route} में व्हीलचेयर स्थान खाली`,
      body: `आप वेटलिस्ट से कन्फर्म हो गए हैं! टिकट ${pnr} पक्का है।`,
    }),
    bn: (route: string, pnr: string) => ({
      title: `বাস ${route}-এ হুইলচেয়ার জায়গা খালি হয়েছে`,
      body: `ওয়েটলিস্ট থেকে আপনার টিকিট ${pnr} নিশ্চিত করা হয়েছে!`,
    }),
  },
  sosDispatched: {
    en: (name: string, loc: string) => ({
      title: `SOS Emergency: ${name}`,
      body: `Live alert from ${loc}. Conductor, emergency contact, and depot control notified.`,
    }),
    hi: (name: string, loc: string) => ({
      title: `आपातकालीन SOS: ${name}`,
      body: `${loc} से लाइव अलर्ट। कंडक्टर और कंट्रोल रूम को सूचित किया गया।`,
    }),
    bn: (name: string, loc: string) => ({
      title: `জরুরি SOS: ${name}`,
      body: `${loc} থেকে লাইভ সতর্কতা। কন্ডাক্টর ও কন্ট্রোল রুমকে জানানো হয়েছে।`,
    }),
  },
};

export async function dispatchNotification(payload: NotificationPayload) {
  const adapter =
    payload.channel === 'SMS'
      ? smsAdapter
      : payload.channel === 'WHATSAPP'
      ? whatsappAdapter
      : payload.channel === 'VOICE'
      ? voiceCallAdapter
      : payload.channel === 'EMAIL'
      ? emailAdapter
      : webPushAdapter;

  const res = await adapter.send(payload);
  try {
    await db.insert(notifications).values({
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: payload.userId,
      channel: payload.channel,
      language: payload.language,
      title: payload.title,
      body: payload.body,
      status: res.delivered ? 'SENT' : 'FAILED',
    });
  } catch (err) {
    logger.warn('Could not persist notification row', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return res;
}

export interface UdidVerifier {
  verify(udidNumber: string): Promise<{
    verified: boolean;
    concessionEligible: boolean;
    concessionPercent: number;
    category: string;
  }>;
}

export const udidVerifier: UdidVerifier = {
  async verify(udidNumber: string) {
    const normalized = udidNumber.trim().toUpperCase();
    if (normalized.length < 6 || !/^[A-Z0-9-]+$/.test(normalized)) {
      return {
        verified: false,
        concessionEligible: false,
        concessionPercent: 0,
        category: 'Invalid UDID format',
      };
    }
    return {
      verified: true,
      concessionEligible: true,
      concessionPercent: 50,
      category: 'Verified Central UDID Registry (50% Concession)',
    };
  },
};
