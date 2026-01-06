import axios from 'axios';
import { prisma } from './prisma';

export async function sendWebhooks(userId: number, subject: string, text: string, payload?: any) {
  const hooks = await prisma.notificationWebhook.findMany({ where: { userId, active: true } });
  for (const h of hooks) {
    try {
      if (h.kind === 'discord') {
        await axios.post(h.url, { content: `**${subject}**\n${text}` });
      } else if (h.kind === 'slack') {
        await axios.post(h.url, { text: `*${subject}*\n${text}` });
      } else {
        await axios.post(h.url, { subject, text, payload });
      }
    } catch (e) {
      // ignore webhook errors to avoid breaking main flow
      // optionally log
      // console.warn('webhook send failed', e);
    }
  }
}
