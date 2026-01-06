import nodemailer from 'nodemailer';
import { RecapData } from './recap';

export type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

export function getMailConfigFromEnv(): MailConfig | null {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  const user = process.env.SMTP_USER || undefined;
  const pass = process.env.SMTP_PASS || undefined;
  const from = process.env.MAIL_FROM || '';
  if (!host || !port || !from) return null;
  return { host, port, secure, user, pass, from };
}

export async function sendRecapEmail(to: string, recap: RecapData, cfg?: MailConfig) {
  const conf = cfg ?? getMailConfigFromEnv();
  if (!conf) throw new Error('SMTP config missing');
  const transporter = nodemailer.createTransport({
    host: conf.host,
    port: conf.port,
    secure: conf.secure,
    auth: conf.user && conf.pass ? { user: conf.user, pass: conf.pass } : undefined,
  });
  const subject = `Récap du stream — ${recap.stream.title || 'Sans titre'}`;
  const html = renderRecapHtml(recap);
  const text = renderRecapText(recap);
  await transporter.sendMail({ from: conf.from, to, subject, html, text });
}

function renderRecapHtml(r: RecapData) {
  const fmt = (d?: Date | null) => d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const fmtTime = (d?: Date | null) => d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
  const moments = r.moments.slice(0, 5).map(m => `
    <div style="display:flex; align-items:center; gap:8px; padding:8px 12px; background:#1e293b; border-radius:6px; margin-bottom:6px;">
      <span style="font-size:20px;">🎬</span>
      <div>
        <div style="font-weight:600; color:#e2e8f0;">${new Date(m.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
        <div style="font-size:12px; color:#22c55e;">+${m.delta} viewers (${m.from} → ${m.to})</div>
      </div>
    </div>
  `).join('');
  
  // Badges HTML
  const badgesHtml = r.badges.length > 0 ? `
    <div style="margin-bottom:20px;">
      <div style="font-weight:600; color:#e2e8f0; margin-bottom:10px; font-size:14px;">🏅 Badges obtenus</div>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${r.badges.map(b => `
          <div style="display:inline-flex; align-items:center; gap:6px; background:linear-gradient(135deg, #1e293b, #0f172a); border:1px solid #334155; border-radius:20px; padding:6px 12px;">
            <span style="font-size:18px;">${b.icon}</span>
            <div>
              <div style="font-weight:600; font-size:12px; color:#e2e8f0;">${escapeHtml(b.title)}</div>
              <div style="font-size:10px; color:#94a3b8;">${escapeHtml(b.description)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';
  
  // Rating HTML
  const ratingColor = r.rating.score >= 75 ? '#22c55e' : r.rating.score >= 50 ? '#eab308' : '#f97316';
  const ratingHtml = `
    <div style="text-align:center; padding:20px; background:linear-gradient(135deg, #1e293b, #0f172a); border-radius:12px; margin-bottom:20px;">
      <div style="font-size:48px; margin-bottom:8px;">${r.rating.emoji}</div>
      <div style="font-size:32px; font-weight:700; color:${ratingColor};">${r.rating.score}/100</div>
      <div style="font-size:16px; color:#e2e8f0; font-weight:600;">${escapeHtml(r.rating.label)}</div>
    </div>
  `;
  
  // Highlights HTML
  const highlightsHtml = r.highlights.length > 0 ? `
    <div style="background:#1e293b; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
      ${r.highlights.map(h => `<div style="padding:4px 0; color:#e2e8f0; font-size:14px;">${escapeHtml(h)}</div>`).join('')}
    </div>
  ` : '';
  
  // Comparison arrows helper
  const arrow = (diff: number) => {
    if (diff > 0) return `<span style="color:#22c55e;">↑ +${diff}</span>`;
    if (diff < 0) return `<span style="color:#ef4444;">↓ ${diff}</span>`;
    return `<span style="color:#94a3b8;">= 0</span>`;
  };
  
  // Comparison HTML
  const comparisonHtml = (r.comparison.vsPreviousStream || r.comparison.vsAverage30Days) ? `
    <div style="margin-bottom:20px;">
      <div style="font-weight:600; color:#e2e8f0; margin-bottom:10px; font-size:14px;">📊 Comparaison</div>
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="border-bottom:1px solid #334155;">
            <th style="text-align:left; padding:8px 12px; color:#94a3b8;"></th>
            ${r.comparison.vsPreviousStream ? '<th style="text-align:center; padding:8px 12px; color:#94a3b8;">vs Stream précédent</th>' : ''}
            ${r.comparison.vsAverage30Days ? '<th style="text-align:center; padding:8px 12px; color:#94a3b8;">vs Moyenne 30j</th>' : ''}
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #1e293b;">
            <td style="padding:8px 12px; color:#e2e8f0;">Moyenne viewers</td>
            ${r.comparison.vsPreviousStream ? `<td style="text-align:center; padding:8px 12px;">${arrow(r.comparison.vsPreviousStream.avgViewersDiff)}</td>` : ''}
            ${r.comparison.vsAverage30Days ? `<td style="text-align:center; padding:8px 12px;">${arrow(r.comparison.vsAverage30Days.avgViewersDiff)}</td>` : ''}
          </tr>
          <tr style="border-bottom:1px solid #1e293b;">
            <td style="padding:8px 12px; color:#e2e8f0;">Pic viewers</td>
            ${r.comparison.vsPreviousStream ? `<td style="text-align:center; padding:8px 12px;">${arrow(r.comparison.vsPreviousStream.peakViewersDiff)}</td>` : ''}
            ${r.comparison.vsAverage30Days ? `<td style="text-align:center; padding:8px 12px;">${arrow(r.comparison.vsAverage30Days.peakViewersDiff)}</td>` : ''}
          </tr>
          <tr>
            <td style="padding:8px 12px; color:#e2e8f0;">Followers</td>
            ${r.comparison.vsPreviousStream ? `<td style="text-align:center; padding:8px 12px;">${arrow(r.comparison.vsPreviousStream.followersDiff)}</td>` : ''}
            ${r.comparison.vsAverage30Days ? `<td style="text-align:center; padding:8px 12px;">${arrow(r.comparison.vsAverage30Days.followersDiff)}</td>` : ''}
          </tr>
        </tbody>
      </table>
    </div>
  ` : '';
  
  // Chat stats HTML
  const chatStatsHtml = r.chatStats ? `
    <div style="margin-bottom:20px;">
      <div style="font-weight:600; color:#e2e8f0; margin-bottom:10px; font-size:14px;">💬 Statistiques du chat</div>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        ${miniStat('Messages', String(r.chatStats.totalMessages), '💬')}
        ${miniStat('Chatteurs', String(r.chatStats.uniqueChatters), '👥')}
        ${miniStat('Msg/min', String(r.chatStats.messagesPerMinute), '⚡')}
      </div>
      ${r.chatStats.topWords.length > 0 ? `
        <div style="margin-top:10px; padding:10px; background:#1e293b; border-radius:6px;">
          <div style="font-size:12px; color:#94a3b8; margin-bottom:6px;">Mots les plus utilisés</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${r.chatStats.topWords.map(w => `<span style="background:#334155; color:#e2e8f0; padding:4px 10px; border-radius:12px; font-size:12px;">${escapeHtml(w)}</span>`).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  ` : '';
  
  // Viewer journey mini-graph (simple text-based representation)
  const journeyHtml = r.viewerJourney.length > 0 ? `
    <div style="margin-bottom:20px;">
      <div style="font-weight:600; color:#e2e8f0; margin-bottom:10px; font-size:14px;">📈 Parcours du stream</div>
      <div style="display:flex; align-items:flex-end; gap:4px; height:60px; padding:10px; background:#1e293b; border-radius:8px;">
        ${renderMiniChart(r.viewerJourney)}
      </div>
      <div style="display:flex; justify-content:space-between; padding:4px 10px; font-size:10px; color:#94a3b8;">
        <span>${r.viewerJourney[0]?.time || ''}</span>
        <span>${r.viewerJourney[r.viewerJourney.length - 1]?.time || ''}</span>
      </div>
    </div>
  ` : '';

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin:0; padding:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color:#e5e7eb; background:#0b0f14;">
    <div style="padding:20px;">
      <div style="max-width:600px; margin:0 auto; background:#0f172a; border:1px solid #1f2937; border-radius:12px; overflow:hidden;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg, #7c3aed, #2563eb); padding:24px 20px; text-align:center;">
          <div style="font-size:24px; font-weight:700; color:#fff; margin-bottom:4px;">📺 Récap du Stream</div>
          <div style="font-size:14px; color:rgba(255,255,255,0.8);">${fmt(r.stream.startedAt)}</div>
        </div>
        
        <!-- Content -->
        <div style="padding:20px;">
          <!-- Title & Category -->
          <div style="text-align:center; margin-bottom:20px;">
            <div style="font-size:18px; font-weight:600; color:#fff; margin-bottom:4px;">${escapeHtml(r.stream.title || 'Sans titre')}</div>
            <div style="font-size:13px; color:#94a3b8;">
              🎮 ${escapeHtml(r.stream.category || 'Pas de catégorie')} • ⏱️ ${formatDuration(r.stream.durationMinutes)}
            </div>
          </div>
          
          <!-- Rating -->
          ${ratingHtml}
          
          <!-- Badges -->
          ${badgesHtml}
          
          <!-- Highlights -->
          ${highlightsHtml}
          
          <!-- KPIs -->
          <div style="display:flex; gap:12px; margin-bottom:20px;">
            ${statCard('Moyenne', String(r.kpis.avgViewers), '👥', '#3b82f6')}
            ${statCard('Pic', String(r.kpis.peakViewers), '🔥', '#f97316')}
            ${statCard('Followers', String(r.kpis.newFollowers), '❤️', '#ec4899')}
          </div>
          
          <!-- Comparison -->
          ${comparisonHtml}
          
          <!-- Viewer Journey -->
          ${journeyHtml}
          
          <!-- Chat Stats -->
          ${chatStatsHtml}
          
          <!-- Moments to clip -->
          ${r.moments.length > 0 ? `
            <div style="margin-bottom:20px;">
              <div style="font-weight:600; color:#e2e8f0; margin-bottom:10px; font-size:14px;">🎬 Moments à clipper</div>
              ${moments}
            </div>
          ` : ''}
        </div>
        
        <!-- Footer -->
        <div style="padding:16px 20px; border-top:1px solid #1f2937; text-align:center;">
          <div style="font-size:12px; color:#64748b;">
            Généré par <strong style="color:#7c3aed;">Statisfaction</strong> • 
            <a href="#" style="color:#3b82f6; text-decoration:none;">Voir le tableau de bord</a>
          </div>
        </div>
      </div>
    </div>
  </body>
  </html>`;
}

function renderMiniChart(journey: Array<{ time: string; viewers: number; event?: string }>) {
  if (journey.length === 0) return '';
  const max = Math.max(...journey.map(j => j.viewers), 1);
  return journey.map(j => {
    const height = Math.max(4, Math.round((j.viewers / max) * 50));
    const color = j.event ? '#7c3aed' : '#3b82f6';
    return `<div style="flex:1; background:${color}; height:${height}px; border-radius:2px;" title="${j.time}: ${j.viewers} viewers${j.event ? ' - ' + j.event : ''}"></div>`;
  }).join('');
}

function statCard(label: string, value: string, icon: string, color: string) {
  return `
    <div style="flex:1; background:#1e293b; border-radius:10px; padding:16px; text-align:center;">
      <div style="font-size:24px; margin-bottom:4px;">${icon}</div>
      <div style="font-size:24px; font-weight:700; color:${color};">${escapeHtml(value)}</div>
      <div style="font-size:12px; color:#94a3b8;">${escapeHtml(label)}</div>
    </div>
  `;
}

function miniStat(label: string, value: string, icon: string) {
  return `
    <div style="flex:1; min-width:80px; background:#0f172a; border:1px solid #334155; border-radius:8px; padding:10px; text-align:center;">
      <div style="font-size:16px;">${icon}</div>
      <div style="font-size:18px; font-weight:700; color:#e2e8f0;">${escapeHtml(value)}</div>
      <div style="font-size:10px; color:#94a3b8;">${escapeHtml(label)}</div>
    </div>
  `;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h${mins.toString().padStart(2, '0')}`;
  return `${mins}min`;
}

function renderRecapText(r: RecapData) {
  const fmt = (d?: Date | null) => d ? new Date(d).toLocaleString('fr-FR') : '—';
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════');
  lines.push(`  ${r.rating.emoji} RÉCAP DU STREAM - ${r.rating.score}/100 (${r.rating.label})`);
  lines.push('═══════════════════════════════════════');
  lines.push('');
  lines.push(`📺 ${r.stream.title || 'Sans titre'}`);
  lines.push(`🎮 ${r.stream.category || 'Pas de catégorie'}`);
  lines.push(`📅 ${fmt(r.stream.startedAt)} -> ${fmt(r.stream.endedAt)}`);
  lines.push(`⏱️ Durée: ${Math.floor(r.stream.durationMinutes / 60)}h${r.stream.durationMinutes % 60}min`);
  lines.push('');
  
  // Badges
  if (r.badges.length > 0) {
    lines.push('🏅 BADGES OBTENUS');
    lines.push('───────────────────');
    for (const b of r.badges) {
      lines.push(`  ${b.icon} ${b.title} - ${b.description}`);
    }
    lines.push('');
  }
  
  // Highlights
  if (r.highlights.length > 0) {
    lines.push('✨ FAITS MARQUANTS');
    lines.push('───────────────────');
    for (const h of r.highlights) {
      lines.push(`  ${h}`);
    }
    lines.push('');
  }
  
  // KPIs
  lines.push('📊 STATISTIQUES');
  lines.push('───────────────────');
  lines.push(`  👥 Moyenne viewers: ${r.kpis.avgViewers}`);
  lines.push(`  🔥 Pic viewers: ${r.kpis.peakViewers}`);
  lines.push(`  ❤️ Nouveaux followers: ${r.kpis.newFollowers}`);
  lines.push('');
  
  // Comparison
  if (r.comparison.vsPreviousStream || r.comparison.vsAverage30Days) {
    lines.push('📈 COMPARAISON');
    lines.push('───────────────────');
    if (r.comparison.vsPreviousStream) {
      const vs = r.comparison.vsPreviousStream;
      lines.push('  vs Stream précédent:');
      lines.push(`    • Moyenne: ${vs.avgViewersDiff >= 0 ? '+' : ''}${vs.avgViewersDiff}`);
      lines.push(`    • Pic: ${vs.peakViewersDiff >= 0 ? '+' : ''}${vs.peakViewersDiff}`);
      lines.push(`    • Followers: ${vs.followersDiff >= 0 ? '+' : ''}${vs.followersDiff}`);
    }
    if (r.comparison.vsAverage30Days) {
      const vs = r.comparison.vsAverage30Days;
      lines.push('  vs Moyenne 30 jours:');
      lines.push(`    • Moyenne: ${vs.avgViewersDiff >= 0 ? '+' : ''}${vs.avgViewersDiff}`);
      lines.push(`    • Pic: ${vs.peakViewersDiff >= 0 ? '+' : ''}${vs.peakViewersDiff}`);
      lines.push(`    • Followers: ${vs.followersDiff >= 0 ? '+' : ''}${vs.followersDiff}`);
    }
    lines.push('');
  }
  
  // Chat stats
  if (r.chatStats) {
    lines.push('💬 STATISTIQUES DU CHAT');
    lines.push('───────────────────');
    lines.push(`  • Messages: ${r.chatStats.totalMessages}`);
    lines.push(`  • Chatteurs uniques: ${r.chatStats.uniqueChatters}`);
    lines.push(`  • Messages/min: ${r.chatStats.messagesPerMinute}`);
    if (r.chatStats.topWords.length > 0) {
      lines.push(`  • Mots populaires: ${r.chatStats.topWords.join(', ')}`);
    }
    lines.push('');
  }
  
  // Moments to clip
  if (r.moments.length) {
    lines.push('🎬 MOMENTS À CLIPPER');
    lines.push('───────────────────');
    for (const m of r.moments.slice(0, 5)) {
      lines.push(`  • ${new Date(m.t).toLocaleTimeString('fr-FR')} - +${m.delta} viewers (${m.from} → ${m.to})`);
    }
    lines.push('');
  }
  
  lines.push('═══════════════════════════════════════');
  lines.push('  Généré par Statisfaction');
  lines.push('═══════════════════════════════════════');
  
  return lines.join('\n');
}

function stat(label: string, value: string) {
  return `<div style=\"flex:1; background:#0b1220; border:1px solid #1f2937; border-radius:6px; padding:10px;\"><div style=\"font-size:12px; color:#94a3b8;\">${escapeHtml(label)}</div><div style=\"font-size:18px; font-weight:700; color:#e2e8f0;\">${escapeHtml(value)}</div></div>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c] as string));
}
