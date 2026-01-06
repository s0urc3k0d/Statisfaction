import { prisma } from './prisma';

export type RecapData = {
  stream: { id: number; title: string | null; category: string | null; startedAt: Date; endedAt: Date | null; durationMinutes: number };
  kpis: { avgViewers: number; peakViewers: number; newFollowers: number };
  moments: Array<{ t: number; delta: number; from: number; to: number }>;
  funFacts: { topEmote: string | null };
  // Enhanced recap data
  comparison: {
    vsPreviousStream: { avgViewersDiff: number; peakViewersDiff: number; followersDiff: number } | null;
    vsAverage30Days: { avgViewersDiff: number; peakViewersDiff: number; followersDiff: number } | null;
  };
  highlights: string[];
  badges: Array<{ icon: string; title: string; description: string }>;
  chatStats: { totalMessages: number; uniqueChatters: number; messagesPerMinute: number; topWords: string[] } | null;
  viewerJourney: Array<{ time: string; viewers: number; event?: string }>;
  rating: { score: number; label: string; emoji: string };
};

export async function computeRecap(userId: number, streamId: number): Promise<RecapData | null> {
  const stream = await prisma.stream.findFirst({ 
    where: { id: streamId, userId }, 
    include: { 
      metrics: { orderBy: { timestamp: 'asc' } },
      chatMetrics: { orderBy: { timestamp: 'asc' } },
      chatMessages: { orderBy: { timestamp: 'asc' } },
      annotations: true,
    } 
  });
  if (!stream) return null;
  
  const metrics = stream.metrics;
  const startedAt = stream.startedAt; 
  const endedAt = stream.endedAt ?? new Date();
  const durationMinutes = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime())/60000));
  const peakViewers = metrics.reduce((mx: number, m: any)=>Math.max(mx, m.viewerCount), 0);
  const avgViewers = metrics.length>0 ? Math.round(metrics.reduce((a: number,m:any)=>a+m.viewerCount,0)/metrics.length) : 0;
  const followers = await prisma.followerEvent.findMany({ where: { userId, followedAt: { gte: startedAt, lte: endedAt } } });
  const newFollowers = followers.length;

  // moments "clip": deltas sur 5 points (5 minutes)
  const series = metrics.map((m: { timestamp: Date; viewerCount: number }) => ({ t: new Date(m.timestamp).getTime(), v: m.viewerCount }));
  const moments: Array<{ t: number; delta: number; from: number; to: number }> = [];
  for (let i=5; i<series.length; i++) {
    const prev = series[i-5].v; const curr = series[i].v;
    const delta = curr - prev; const pct = prev>0 ? delta/prev : 0;
    if (delta >= 30 && pct >= 0.25) {
      moments.push({ t: series[i].t, delta, from: prev, to: curr });
    }
  }
  
  // Fun facts - top emote
  const funFacts = { topEmote: null as string | null };
  
  // =====================================
  // Enhanced recap data
  // =====================================
  
  // Comparison with previous stream
  const previousStream = await prisma.stream.findFirst({
    where: { userId, id: { not: streamId }, endedAt: { not: null } },
    orderBy: { startedAt: 'desc' },
    include: { metrics: true },
  });
  
  let vsPreviousStream = null;
  if (previousStream && previousStream.metrics.length > 0) {
    const prevPeak = previousStream.metrics.reduce((mx, m) => Math.max(mx, m.viewerCount), 0);
    const prevAvg = Math.round(previousStream.metrics.reduce((a, m) => a + m.viewerCount, 0) / previousStream.metrics.length);
    const prevFollowers = await prisma.followerEvent.count({
      where: { userId, followedAt: { gte: previousStream.startedAt, lte: previousStream.endedAt ?? new Date() } }
    });
    
    vsPreviousStream = {
      avgViewersDiff: avgViewers - prevAvg,
      peakViewersDiff: peakViewers - prevPeak,
      followersDiff: newFollowers - prevFollowers,
    };
  }
  
  // Comparison with 30-day average
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentStreams = await prisma.stream.findMany({
    where: { userId, id: { not: streamId }, startedAt: { gte: thirtyDaysAgo }, endedAt: { not: null } },
    include: { metrics: true },
  });
  
  let vsAverage30Days = null;
  if (recentStreams.length >= 3) {
    let totalAvg = 0, totalPeak = 0, totalFollows = 0;
    for (const s of recentStreams) {
      if (s.metrics.length > 0) {
        totalAvg += Math.round(s.metrics.reduce((a, m) => a + m.viewerCount, 0) / s.metrics.length);
        totalPeak += s.metrics.reduce((mx, m) => Math.max(mx, m.viewerCount), 0);
      }
      totalFollows += await prisma.followerEvent.count({
        where: { userId, followedAt: { gte: s.startedAt, lte: s.endedAt ?? new Date() } }
      });
    }
    const avg30Avg = Math.round(totalAvg / recentStreams.length);
    const avg30Peak = Math.round(totalPeak / recentStreams.length);
    const avg30Followers = Math.round(totalFollows / recentStreams.length);
    
    vsAverage30Days = {
      avgViewersDiff: avgViewers - avg30Avg,
      peakViewersDiff: peakViewers - avg30Peak,
      followersDiff: newFollowers - avg30Followers,
    };
  }
  
  // Generate highlights
  const highlights: string[] = [];
  if (peakViewers > 0) {
    if (vsPreviousStream && vsPreviousStream.peakViewersDiff > 0) {
      highlights.push(`📈 +${vsPreviousStream.peakViewersDiff} viewers au pic vs stream précédent`);
    }
    if (vsAverage30Days && vsAverage30Days.avgViewersDiff > 0) {
      const pct = Math.round((vsAverage30Days.avgViewersDiff / Math.max(1, avgViewers - vsAverage30Days.avgViewersDiff)) * 100);
      highlights.push(`🔥 ${pct}% au-dessus de ta moyenne`);
    }
  }
  if (newFollowers > 0) {
    highlights.push(`❤️ ${newFollowers} nouveau${newFollowers > 1 ? 'x' : ''} follower${newFollowers > 1 ? 's' : ''}`);
  }
  if (durationMinutes >= 240) {
    highlights.push(`⏰ Stream marathon de ${Math.floor(durationMinutes / 60)}h${durationMinutes % 60}min`);
  }
  if (moments.length > 0) {
    highlights.push(`🎬 ${moments.length} moment${moments.length > 1 ? 's' : ''} fort${moments.length > 1 ? 's' : ''} détecté${moments.length > 1 ? 's' : ''}`);
  }
  
  // Generate badges
  const badges: Array<{ icon: string; title: string; description: string }> = [];
  
  // Peak viewers badges
  if (peakViewers >= 1000) badges.push({ icon: '🔥', title: 'En feu', description: '1000+ viewers' });
  else if (peakViewers >= 500) badges.push({ icon: '⭐', title: 'Star', description: '500+ viewers' });
  else if (peakViewers >= 100) badges.push({ icon: '🌟', title: 'Brillant', description: '100+ viewers' });
  else if (peakViewers >= 50) badges.push({ icon: '✨', title: 'Prometteur', description: '50+ viewers' });
  
  // Duration badges
  if (durationMinutes >= 720) badges.push({ icon: '🏆', title: 'Ultra marathon', description: '12h+ de stream' });
  else if (durationMinutes >= 480) badges.push({ icon: '🥇', title: 'Marathonien', description: '8h+ de stream' });
  else if (durationMinutes >= 240) badges.push({ icon: '🥈', title: 'Endurant', description: '4h+ de stream' });
  
  // Followers badges  
  if (newFollowers >= 50) badges.push({ icon: '💕', title: 'Lovefest', description: '50+ followers' });
  else if (newFollowers >= 20) badges.push({ icon: '❤️', title: 'Populaire', description: '20+ followers' });
  else if (newFollowers >= 10) badges.push({ icon: '💜', title: 'Aimé', description: '10+ followers' });
  
  // Performance badges
  if (vsPreviousStream && vsPreviousStream.avgViewersDiff > 0 && vsPreviousStream.peakViewersDiff > 0) {
    badges.push({ icon: '📈', title: 'En progression', description: 'Meilleur que le précédent' });
  }
  if (vsAverage30Days && vsAverage30Days.avgViewersDiff > avgViewers * 0.2) {
    badges.push({ icon: '🚀', title: 'Performance exceptionnelle', description: '+20% vs moyenne' });
  }
  
  // Chat stats
  let chatStats = null;
  if (stream.chatMetrics.length > 0 || stream.chatMessages.length > 0) {
    const totalMessages = stream.chatMetrics.reduce((sum, m) => sum + m.messages, 0);
    const uniqueChatters = new Set(stream.chatMessages.map(m => m.username)).size;
    const messagesPerMinute = durationMinutes > 0 ? Math.round((totalMessages / durationMinutes) * 10) / 10 : 0;
    
    // Top words (excluding common words)
    const stopWords = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'à', 'au', 'en', 'c', 'est', 'a', 'je', 'tu', 'il', 'on', 'qui', 'que', 'pour', 'pas', 'mais', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once']);
    const wordCounts = new Map<string, number>();
    for (const msg of stream.chatMessages) {
      const words = msg.content.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 2 && !stopWords.has(word) && !/^\d+$/.test(word)) {
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }
      }
    }
    const topWords = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
    
    chatStats = { totalMessages, uniqueChatters, messagesPerMinute, topWords };
  }
  
  // Viewer journey (sampled points for graph)
  const viewerJourney: Array<{ time: string; viewers: number; event?: string }> = [];
  const sampleInterval = Math.max(1, Math.floor(metrics.length / 12));
  for (let i = 0; i < metrics.length; i += sampleInterval) {
    const m = metrics[i];
    const time = new Date(m.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const event = stream.annotations.find(a => 
      Math.abs(new Date(a.at).getTime() - new Date(m.timestamp).getTime()) < 5 * 60 * 1000
    );
    viewerJourney.push({ 
      time, 
      viewers: m.viewerCount,
      event: event?.label,
    });
  }
  
  // Stream rating
  const rating = computeStreamRating(avgViewers, peakViewers, newFollowers, durationMinutes, vsAverage30Days);

  return {
    stream: { id: stream.id, title: stream.title, category: stream.category, startedAt, endedAt: stream.endedAt, durationMinutes },
    kpis: { avgViewers, peakViewers, newFollowers },
    moments,
    funFacts,
    comparison: { vsPreviousStream, vsAverage30Days },
    highlights,
    badges,
    chatStats,
    viewerJourney,
    rating,
  };
}

function computeStreamRating(
  avgViewers: number, 
  peakViewers: number, 
  newFollowers: number, 
  durationMinutes: number,
  vsAverage: { avgViewersDiff: number; peakViewersDiff: number; followersDiff: number } | null
): { score: number; label: string; emoji: string } {
  let score = 50; // Base score
  
  // Audience metrics (max +30)
  if (avgViewers >= 100) score += 15;
  else if (avgViewers >= 50) score += 10;
  else if (avgViewers >= 20) score += 5;
  
  if (peakViewers >= 200) score += 15;
  else if (peakViewers >= 100) score += 10;
  else if (peakViewers >= 50) score += 5;
  
  // Followers (max +15)
  if (newFollowers >= 20) score += 15;
  else if (newFollowers >= 10) score += 10;
  else if (newFollowers >= 5) score += 5;
  else if (newFollowers >= 1) score += 2;
  
  // Duration bonus (max +10)
  if (durationMinutes >= 240) score += 10;
  else if (durationMinutes >= 120) score += 5;
  
  // Progression bonus (max +15)
  if (vsAverage) {
    if (vsAverage.avgViewersDiff > 0) score += 5;
    if (vsAverage.peakViewersDiff > 0) score += 5;
    if (vsAverage.followersDiff > 0) score += 5;
  }
  
  // Clamp score
  score = Math.max(0, Math.min(100, score));
  
  // Label and emoji
  if (score >= 90) return { score, label: 'Exceptionnel', emoji: '🏆' };
  if (score >= 75) return { score, label: 'Excellent', emoji: '⭐' };
  if (score >= 60) return { score, label: 'Très bien', emoji: '🎉' };
  if (score >= 45) return { score, label: 'Bien', emoji: '👍' };
  if (score >= 30) return { score, label: 'Correct', emoji: '📊' };
  return { score, label: 'À améliorer', emoji: '💪' };
}
