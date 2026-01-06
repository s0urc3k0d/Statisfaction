import 'dotenv/config';

function bool(v: string | undefined): boolean | undefined {
  if (v == null) return undefined;
  if (v === '1' || v.toLowerCase() === 'true') return true;
  if (v === '0' || v.toLowerCase() === 'false') return false;
  return undefined;
}

export const config = {
  port: Number(process.env.PORT || 4100),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3100',
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 4100}`,
  sessionSecret: process.env.SESSION_SECRET || 'dev_secret_change_me',
  cookieSecure: !!bool(process.env.COOKIE_SECURE),
  redisUrl: process.env.REDIS_URL,

  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
    eventSubSecret: process.env.TWITCH_EVENTSUB_SECRET,
    eventSubCallback: process.env.TWITCH_EVENTSUB_CALLBACK_URL,
  },
};

export const flags = {
  twitchAppCredentials: !!(config.twitch.clientId && config.twitch.clientSecret),
  eventSubEnabled: !!(config.twitch.eventSubSecret),
};

export function logConfigWarnings() {
  if (!flags.twitchAppCredentials) {
    console.warn('[config] TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET manquants: EventSub et certains appels Helix utiliseront des tokens expirés ou échoueront.');
  }
  if (!flags.eventSubEnabled) {
    console.warn('[config] TWITCH_EVENTSUB_SECRET manquant: aucun abonnement EventSub ne sera créé.');
  }
}
