import tmi from 'tmi.js';
import { prisma } from './prisma';
import { broadcast } from './sse';

// Liste des bots connus à filtrer
const KNOWN_BOTS = new Set([
  'nightbot', 'streamelements', 'streamlabs', 'moobot', 'fossabot',
  'wizebot', 'soundalerts', 'streamstickers', 'botisimo', 'coebot',
  'deepbot', 'ohbot', 'ankhbot', 'phantombot', 'stay_hydrated_bot',
  'pokemoncommunitygame', 'commanderroot', 'restreambot', 'sery_bot'
]);

// Emotes positives/négatives pour sentiment basique
const POSITIVE_EMOTES = new Set([
  'PogChamp', 'Pog', 'POGGERS', 'PogU', 'KEKW', 'LUL', 'LULW', 'OMEGALUL',
  'catJAM', 'PepeJam', 'peepoHappy', 'widepeepoHappy', 'HYPERS', 'PogBones',
  'EZ', 'Clap', 'GG', 'LETS', 'GOOO', ':)', '<3', 'HeyGuys', 'VoHiYo',
  'bleedPurple', 'TwitchUnity', 'PowerUpL', 'PowerUpR', 'SeemsGood', 'CoolCat'
]);

const NEGATIVE_EMOTES = new Set([
  'ResidentSleeper', 'BabyRage', 'NotLikeThis', 'FailFish', 'BibleThump',
  'Sadge', 'PepeHands', 'widepeepoSad', 'OMEGALUL', 'monkaS', 'monkaW',
  'KEKW', 'WeirdChamp', 'cringe', 'Jebaited', 'DansGame', ':(', 'SMOrc'
]);

// État par userId
type ChatState = {
  client: any;
  bucketStart: number; // ms epoch
  messages: number;
  streamId: number;
  sampleCounter: number; // pour échantillonnage
};
const states = new Map<number, ChatState>(); // key: userId

// Échantillonnage : 1 message sur N est sauvegardé
const SAMPLE_RATE = 5;
const MAX_CONTENT_LENGTH = 300;

function analyzeSentiment(content: string): number {
  const words = content.split(/\s+/);
  let score = 0;
  for (const w of words) {
    if (POSITIVE_EMOTES.has(w)) score += 1;
    if (NEGATIVE_EMOTES.has(w)) score -= 1;
  }
  // Également détecter patterns textuels
  const lower = content.toLowerCase();
  if (lower.includes('gg') || lower.includes('nice') || lower.includes('let\'s go') || lower.includes('hype')) score += 1;
  if (lower.includes('boring') || lower.includes('cringe') || lower.includes('bad')) score -= 1;
  
  return score > 0 ? 1 : score < 0 ? -1 : 0;
}

function isEmoteOnlyMessage(content: string): boolean {
  const words = content.trim().split(/\s+/);
  // Si tous les mots commencent par une majuscule ou sont dans les sets d'emotes
  return words.every(w => 
    POSITIVE_EMOTES.has(w) || 
    NEGATIVE_EMOTES.has(w) || 
    /^[A-Z][a-zA-Z0-9]+$/.test(w) || // Pattern emote typique
    /^:[a-z_]+:$/.test(w) // Discord-style emotes
  );
}

export async function startChatIngest(userId: number, channelLogin: string, streamId: number) {
  if (states.has(userId)) return;
  const client = new (tmi as any).Client({ channels: [ channelLogin ] });
  const st: ChatState = { client, bucketStart: Date.now(), messages: 0, streamId, sampleCounter: 0 };
  states.set(userId, st);

  client.on('message', async (_channel: string, tags: any, message: string, _self: boolean) => {
    st.messages += 1;
    st.sampleCounter += 1;
    
    const username = (tags?.username || tags?.['display-name'] || 'anonymous').toLowerCase();
    const content = message.slice(0, MAX_CONTENT_LENGTH);
    
    // Échantillonnage : sauvegarder 1 message sur N (sauf bots)
    if (st.sampleCounter >= SAMPLE_RATE && !KNOWN_BOTS.has(username)) {
      st.sampleCounter = 0;
      const sentiment = analyzeSentiment(content);
      const isEmote = isEmoteOnlyMessage(content);
      
      try {
        await prisma.chatMessage.create({
          data: {
            streamId: st.streamId,
            username,
            content,
            isEmote,
            sentiment,
          }
        });
      } catch {}
    }
    
    const now = Date.now();
    if (now - st.bucketStart >= 60_000) {
      const ts = new Date(st.bucketStart);
      const count = st.messages;
      st.bucketStart = now; st.messages = 0;
      try {
        await prisma.chatMetric.create({ data: { streamId: st.streamId, timestamp: ts, messages: count } });
        broadcast(userId, 'chat.activity', { streamId: st.streamId, at: ts.getTime(), messages: count });
      } catch {}
    }
  });
  try { await client.connect(); } catch {}
}

export async function stopChatIngest(userId: number) {
  const st = states.get(userId);
  if (!st) return;
  // Flush bucket en cours si non vide
  if (st.messages > 0) {
    try {
      const ts = new Date(st.bucketStart);
      await prisma.chatMetric.create({ data: { streamId: st.streamId, timestamp: ts, messages: st.messages } });
      broadcast(userId, 'chat.activity', { streamId: st.streamId, at: ts.getTime(), messages: st.messages });
    } catch {}
  }
  try { await st.client.disconnect(); } catch {}
  states.delete(userId);
}

