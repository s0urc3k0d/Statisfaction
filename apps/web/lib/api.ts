export type SessionResponse = {
  authenticated: boolean;
  user?: { id: number; displayName?: string | null; login?: string | null; profileImageUrl?: string | null; isAdmin?: boolean };
};

export type MeResponse = { id: number; login: string | null; displayName: string | null; profileImageUrl: string | null; email?: string | null; recapEmailEnabled?: boolean };

export type TwitchStreamData = {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
};

export type TwitchStreamResponse = { data: TwitchStreamData[] };

export type LastStreamResponse = {
  summary: null | {
    title: string | null;
    category: string | null;
    durationMinutes: number;
    peakViewers: number;
    avgViewers: number;
    newFollowers: number | null;
    newSubscribers: number | null;
  };
  series: { t: number; viewers: number }[];
};

// Conversion API types
export type ConversionItem = { streamId: number; title: string | null; category: string | null; startedAt: string; endedAt: string | null; durationMinutes: number; followers: number; ratePerHour: number };
export type ConversionResp = { range: { from: string; to: string }; items: ConversionItem[]; totals: { followers: number; durationMinutes: number; ratePerHour: number } };

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4100';

export async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...(init || {}) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// Goals
export type Goal = { id: number; userId: number; kind: 'followers'|'avgViewers'|'peakViewers'|'duration'; target: number; from: string; to: string };
export type GoalProgress = { id: number; current: number; target: number; pct: number };

// Annotations
export type Annotation = { id: number; userId: number; streamId: number | null; at: string; type: string; label: string; meta?: string | null };

// Admin Webhooks
export type NotificationWebhook = {
  id: number;
  userId: number;
  kind: 'discord' | 'slack' | 'custom';
  url: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

// Tools: Schedule & Suggestions
export type ScheduleEntry = { id: number; userId: number; title: string; category?: string | null; start: string; end: string; timezone?: string | null; twitchSegmentId?: string | null; createdAt: string };
export type TitleSuggestionsResp = { suggestions: string[] };

// ============================================
// Phase 2: Advanced Analytics Types
// ============================================

// Stream Comparison
export type StreamCompareItem = {
  id: number;
  title: string | null;
  category: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  peakViewers: number;
  avgViewers: number;
  followers: number;
  followersPerHour: number;
  trend: number;
  series: { pct: number; viewers: number }[];
  deltas: {
    peakViewers: number;
    avgViewers: number;
    durationMinutes: number;
    followers: number;
    peakViewersPct: number;
    avgViewersPct: number;
  };
};

export type StreamCompareResponse = {
  streams: StreamCompareItem[];
  averages: { peakViewers: number; avgViewers: number; durationMinutes: number; followers: number };
  bestStreamId: number;
  factors: string[];
  dayPerformance: { dow: number; dayName: string; avgViewers: number; count: number }[];
};

// Best Times Prediction
export type BestTimesSlot = {
  dow: number;
  hour: number;
  dayName: string;
  avgViewers: number;
  followers: number;
  streamCount: number;
  score: number;
  confidence: 'high' | 'medium' | 'low';
};

export type BestTimesResponse = {
  period: { from: string; days: number };
  topSlots: BestTimesSlot[];
  heatmap: number[][];
  recommendations: string[];
  labels: { days: string[]; hours: number[] };
};

// Category Performance
export type CategoryStats = {
  category: string;
  streams: number;
  totalHours: number;
  avgViewers: number;
  peakViewers: number;
  avgDuration: number;
  followers: number;
  followersPerHour: number;
  performanceVsAvg: number;
  rating: 'excellent' | 'good' | 'average' | 'poor';
};

export type CategoriesResponse = {
  period: { from: string; days: number };
  globalAvgViewers: number;
  totalStreams: number;
  categories: CategoryStats[];
  topCategories: CategoryStats[];
  bottomCategories: CategoryStats[];
  recommendations: string[];
};

// Retention Analysis
export type RetentionPoint = {
  pct: number;
  minutes: number;
  viewers: number;
  retention: number;
};

export type DropOff = {
  minute: number;
  pct: number;
  drop: number;
  possibleCause: string;
};

export type RetentionResponse = {
  stream: { id: number; title: string | null; category: string | null; durationMinutes: number };
  initialViewers: number;
  curve: RetentionPoint[];
  dropOffs: DropOff[];
  avgRetention: number;
  keyPoints: { at25pct: number | null; at50pct: number | null; at75pct: number | null; at90pct: number | null };
  trend: 'stable' | 'declining' | 'steep_decline';
  rating: 'excellent' | 'good' | 'average' | 'poor';
};

// ================================================
// Phase 3: Chat Analytics Types
// ================================================

// Word cloud
export type WordCloudWord = {
  word: string;
  count: number;
  weight: number;
};

export type WordCloudResponse = {
  words: WordCloudWord[];
  totalMessages: number;
};

// Chat timeline
export type ChatTimelinePoint = {
  timestamp: number;
  minute: number;
  messages: number;
  viewers?: number;
  messagesPerViewer?: number;
};

export type ChatTimelineResponse = {
  timeline: ChatTimelinePoint[];
  stats: {
    totalMessages: number;
    avgMessagesPerMin: number;
    peakMessages: number;
    peakMinute: number | null;
  };
};

// Chat moments
export type ChatMoment = {
  timestamp: number;
  minute: number;
  messages: number;
  intensity: number;
  duration: number;
  keywords: string[];
};

export type ChatMomentsResponse = {
  moments: ChatMoment[];
  avgMessages: number;
  threshold: number;
};

// Sentiment analysis
export type SentimentTimelinePoint = {
  minute: number;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  score: number;
};

export type SentimentResponse = {
  timeline: SentimentTimelinePoint[];
  summary: {
    positive: number;
    neutral: number;
    negative: number;
    score: number;
    positivePercent: number;
    negativePercent: number;
  };
  hypeMoments: SentimentTimelinePoint[];
  toxicMoments: SentimentTimelinePoint[];
};

// Chat-viewers correlation
export type CorrelationDataPoint = {
  minute: number;
  messages: number;
  viewers: number;
};

export type CorrelationResponse = {
  correlation: number | null;
  data: CorrelationDataPoint[];
  insight: string;
};

