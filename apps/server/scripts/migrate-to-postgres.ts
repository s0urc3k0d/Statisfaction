#!/usr/bin/env ts-node
/**
 * Migration Script: SQLite → PostgreSQL
 * 
 * Ce script exporte les données de SQLite et les importe dans PostgreSQL.
 * 
 * Usage:
 *   1. S'assurer que SQLite contient les données à migrer
 *   2. S'assurer que PostgreSQL est vide et le schema est appliqué
 *   3. npm run migrate:data
 * 
 * Ordre de migration (respect des foreign keys):
 *   1. User
 *   2. Stream
 *   3. StreamMetric, ChatMetric
 *   4. FollowerEvent, Annotation, Goal, NotificationWebhook
 *   5. RaidEvent, ClipMoment, CreatedClip
 *   6. ScheduleEntry, ABTest
 */

import { PrismaClient as SqliteClient } from '@prisma/client';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const SQLITE_URL = process.env.SQLITE_DATABASE_URL || 'file:./prisma/statisfaction.db';
const POSTGRES_URL = process.env.DATABASE_URL || 'postgresql://statisfaction:changeme@localhost:5432/statisfaction';

const BATCH_SIZE = 500; // Nombre de rows par batch INSERT

interface MigrationStats {
  table: string;
  count: number;
  duration: number;
}

async function main() {
  console.log('🚀 Démarrage de la migration SQLite → PostgreSQL\n');
  
  // Initialiser les clients
  const sqlite = new SqliteClient({
    datasources: { db: { url: SQLITE_URL } }
  });
  
  const pg = new Client({ connectionString: POSTGRES_URL });
  
  try {
    await sqlite.$connect();
    await pg.connect();
    
    console.log('✅ Connexion SQLite OK');
    console.log('✅ Connexion PostgreSQL OK\n');
    
    const stats: MigrationStats[] = [];
    
    // 1. Users
    stats.push(await migrateUsers(sqlite, pg));
    
    // 2. Streams
    stats.push(await migrateStreams(sqlite, pg));
    
    // 3. StreamMetrics & ChatMetrics
    stats.push(await migrateStreamMetrics(sqlite, pg));
    stats.push(await migrateChatMetrics(sqlite, pg));
    
    // 4. FollowerEvents, Annotations, Goals, Webhooks
    stats.push(await migrateFollowerEvents(sqlite, pg));
    stats.push(await migrateAnnotations(sqlite, pg));
    stats.push(await migrateGoals(sqlite, pg));
    stats.push(await migrateWebhooks(sqlite, pg));
    
    // 5. RaidEvents, ClipMoments, CreatedClips
    stats.push(await migrateRaidEvents(sqlite, pg));
    stats.push(await migrateClipMoments(sqlite, pg));
    stats.push(await migrateCreatedClips(sqlite, pg));
    
    // 6. ScheduleEntries, ABTests
    stats.push(await migrateScheduleEntries(sqlite, pg));
    stats.push(await migrateABTests(sqlite, pg));
    
    // Reset sequences (auto-increment)
    await resetSequences(pg);
    
    // Résumé
    console.log('\n' + '='.repeat(50));
    console.log('📊 RÉSUMÉ DE LA MIGRATION');
    console.log('='.repeat(50));
    
    let totalRows = 0;
    let totalTime = 0;
    for (const s of stats) {
      console.log(`  ${s.table.padEnd(20)} : ${s.count.toString().padStart(6)} rows (${s.duration}ms)`);
      totalRows += s.count;
      totalTime += s.duration;
    }
    console.log('='.repeat(50));
    console.log(`  ${'TOTAL'.padEnd(20)} : ${totalRows.toString().padStart(6)} rows (${totalTime}ms)`);
    console.log('\n✅ Migration terminée avec succès !');
    
  } catch (error) {
    console.error('\n❌ Erreur durant la migration:', error);
    process.exit(1);
  } finally {
    await sqlite.$disconnect();
    await pg.end();
  }
}

// ============================================
// Migration functions
// ============================================

async function migrateUsers(sqlite: SqliteClient, pg: Client): Promise<MigrationStats> {
  const start = Date.now();
  const users = await sqlite.user.findMany();
  
  if (users.length === 0) {
    console.log('⏭️  User: aucune donnée');
    return { table: 'User', count: 0, duration: 0 };
  }
  
  const values = users.map(u => 
    `(${u.id}, '${esc(u.twitchId)}', ${nullStr(u.login)}, ${nullStr(u.displayName)}, ${nullStr(u.email)}, ${nullStr(u.profileImageUrl)}, '${esc(u.accessToken)}', '${esc(u.refreshToken)}', '${u.tokenExpiresAt.toISOString()}', ${u.isAdmin}, ${u.recapEmailEnabled}, '${u.createdAt.toISOString()}', '${u.updatedAt.toISOString()}')`
  ).join(',\n');
  
  await pg.query(`
    INSERT INTO "User" (id, "twitchId", login, "displayName", email, "profileImageUrl", "accessToken", "refreshToken", "tokenExpiresAt", "isAdmin", "recapEmailEnabled", "createdAt", "updatedAt")
    VALUES ${values}
    ON CONFLICT (id) DO NOTHING
  `);
  
  const duration = Date.now() - start;
  console.log(`✅ User: ${users.length} rows (${duration}ms)`);
  return { table: 'User', count: users.length, duration };
}

async function migrateStreams(sqlite: SqliteClient, pg: Client): Promise<MigrationStats> {
  const start = Date.now();
  const streams = await sqlite.stream.findMany();
  
  if (streams.length === 0) {
    console.log('⏭️  Stream: aucune donnée');
    return { table: 'Stream', count: 0, duration: 0 };
  }
  
  // Batch insert
  for (let i = 0; i < streams.length; i += BATCH_SIZE) {
    const batch = streams.slice(i, i + BATCH_SIZE);
    const values = batch.map(s => 
      `(${s.id}, ${s.userId}, ${nullStr(s.twitchStreamId)}, ${nullStr(s.title)}, ${nullStr(s.category)}, '${s.startedAt.toISOString()}', ${s.endedAt ? `'${s.endedAt.toISOString()}'` : 'NULL'}, '${s.createdAt.toISOString()}', '${s.updatedAt.toISOString()}')`
    ).join(',\n');
    
    await pg.query(`
      INSERT INTO "Stream" (id, "userId", "twitchStreamId", title, category, "startedAt", "endedAt", "createdAt", "updatedAt")
      VALUES ${values}
      ON CONFLICT (id) DO NOTHING
    `);
  }
  
  const duration = Date.now() - start;
  console.log(`✅ Stream: ${streams.length} rows (${duration}ms)`);
  return { table: 'Stream', count: streams.length, duration };
}

async function migrateStreamMetrics(sqlite: SqliteClient, pg: Client): Promise<MigrationStats> {
  const start = Date.now();
  const metrics = await sqlite.streamMetric.findMany();
  
  if (metrics.length === 0) {
    console.log('⏭️  StreamMetric: aucune donnée');
    return { table: 'StreamMetric', count: 0, duration: 0 };
  }
  
  for (let i = 0; i < metrics.length; i += BATCH_SIZE) {
    const batch = metrics.slice(i, i + BATCH_SIZE);
    const values = batch.map(m => 
      `(${m.id}, ${m.streamId}, '${m.timestamp.toISOString()}', ${m.viewerCount})`
    ).join(',\n');
    
    await pg.query(`
      INSERT INTO "StreamMetric" (id, "streamId", timestamp, "viewerCount")
      VALUES ${values}
      ON CONFLICT (id) DO NOTHING
    `);
    
    if (i % 5000 === 0 && i > 0) {
      console.log(`   StreamMetric: ${i}/${metrics.length}...`);
    }
  }
  
  const duration = Date.now() - start;
  console.log(`✅ StreamMetric: ${metrics.length} rows (${duration}ms)`);
  return { table: 'StreamMetric', count: metrics.length, duration };
}

async function migrateChatMetrics(sqlite: SqliteClient, pg: Client): Promise<MigrationStats> {
  const start = Date.now();
  const metrics = await sqlite.chatMetric.findMany();
  
  if (metrics.length === 0) {
    console.log('⏭️  ChatMetric: aucune donnée');
    return { table: 'ChatMetric', count: 0, duration: 0 };
  }
  
  for (let i = 0; i < metrics.length; i += BATCH_SIZE) {
    const batch = metrics.slice(i, i + BATCH_SIZE);
    const values = batch.map(m => 
      `(${m.id}, ${m.streamId}, '${m.timestamp.toISOString()}', ${m.messages})`
    ).join(',\n');
    
    await pg.query(`
      INSERT INTO "ChatMetric" (id, "streamId", timestamp, messages)
      VALUES ${values}
      ON CONFLICT (id) DO NOTHING
    `);
  }
  
  const duration = Date.now() - start;
  console.log(`✅ ChatMetric: ${metrics.length} rows (${duration}ms)`);
  return { table: 'ChatMetric', count: metrics.length, duration };
}

async function migrateFollowerEvents(sqlite: SqliteClient, pg: Client): Promise<MigrationStats> {
  const start = Date.now();
  const events = await sqlite.followerEvent.findMany();
  
  if (events.length === 0) {
    console.log('⏭️  FollowerEvent: aucune donnée');
    return { table: 'FollowerEvent', count: 0, duration: 0 };
  }
  
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const values = batch.map(e => 
      `(${e.id}, ${e.userId}, '${esc(e.followerId)}', ${nullStr(e.followerLogin)}, ${nullStr(e.followerName)}, '${e.followedAt.toISOString()}', '${e.createdAt.toISOString()}')`
    ).join(',\n');
    
    await pg.query(`
      INSERT INTO "FollowerEvent" (id, "userId", "followerId", "followerLogin", "followerName", "followedAt", "createdAt")
      VALUES ${values}
      ON CONFLICT (id) DO NOTHING
    `);
  }
  
  const duration = Date.now() - start;
  console.log(`✅ FollowerEvent: ${events.length} rows (${duration}ms)`);
  return { table: 'FollowerEvent', count: events.length, duration };
}

async function migrateAnnotations(sqlite: SqliteClient, pg: Client): Promise<MigrationStats> {
  const start = Date.now();
  const annotations = await sqlite.annotation.findMany();
  
  if (annotations.length === 0) {
    console.log('⏭️  Annotation: aucune donnée');
    return { table: 'Annotation', count: 0, duration: 0 };
  }
  
  const values = annotations.map(a => {
    // Convertir meta String → JSON
    let metaJson = 'NULL';
    if (a.meta) {
      try {
        JSON.parse(a.meta); // Vérifier que c'est du JSON valide
        metaJson = `'${esc(a.meta)}'::jsonb`;
      } catch {
        metaJson = 'NULL';
      }
    }
    return `(${a.id}, ${a.userId}, ${a.streamId || 'NULL'}, '${a.at.toISOString()}', '${esc(a.type)}', '${esc(a.label)}', ${metaJson}, '${a.createdAt.toISOString()}')`;
  }).join(',\n');
  
  await pg.query(`
    INSERT INTO "Annotation" (id, "userId", "streamId", at, type, label, meta, "createdAt")
    VALUES ${values}
    ON CONFLICT (id) DO NOTHING
  `);
  
  const duration = Date.now() - start;
  console.log(`✅ Annotation: ${annotations.length} rows (${duration}ms)`);
  return { table: 'Annotation', count: annotations.length, duration };
}

async function migrateGoals(sqlite: SqliteClient, pg: Client): Promise<MigrationStats> {
  const start = Date.now();
  const goals = await sqlite.goal.findMany();
  
  if (goals.length === 0) {
    console.log('⏭️  Goal: aucune donnée');
    return { table: 'Goal', count: 0, duration: 0 };
  }
  
  const values = goals.map(g => 
    `(${g.id}, ${g.userId}, '${esc(g.kind)}', ${g.target}, '${g.from.toISOString()}', '${g.to.toISOString()}', '${g.createdAt.toISOString()}')`
  ).join(',\n');
  
  await pg.query(`
    INSERT INTO "Goal" (id, "userId", kind, target, "from", "to", "createdAt")
    VALUES ${values}
    ON CONFLICT (id) DO NOTHING
  `);
  
  const duration = Date.now() - start;
  console.log(`✅ Goal: ${goals.length} rows (${duration}ms)`);
  return { table: 'Goal', count: goals.length, duration };
}

async function migrateWebhooks(sqlite: SqliteClient, pg: Client): Promise<MigrationStats> {
  const start = Date.now();
  const webhooks = await sqlite.notificationWebhook.findMany();
  
  if (webhooks.length === 0) {
    console.log('⏭️  NotificationWebhook: aucune donnée');
    return { table: 'NotificationWebhook', count: 0, duration: 0 };
  }
  
  const values = webhooks.map(w => 
    `(${w.id}, ${w.userId}, '${esc(w.kind)}', '${esc(w.url)}', ${w.active}, '${w.createdAt.toISOString()}')`
  ).join(',\n');
  
  await pg.query(`
    INSERT INTO "NotificationWebhook" (id, "userId", kind, url, active, "createdAt")
    VALUES ${values}
    ON CONFLICT (id) DO NOTHING
  `);
  
  const duration = Date.now() - start;
  console.log(`✅ NotificationWebhook: ${webhooks.length} rows (${duration}ms)`);
  return { table: 'NotificationWebhook', count: webhooks.length, duration };
}

async function migrateRaidEvents(sqlite: SqliteClient, pg: Client): Promise<MigrationStats> {
  const start = Date.now();
  const raids = await sqlite.raidEvent.findMany();
  
  if (raids.length === 0) {
    console.log('⏭️  RaidEvent: aucune donnée');
    return { table: 'RaidEvent', count: 0, duration: 0 };
  }
  
  const values = raids.map(r => 
    `(${r.id}, ${r.userId}, ${r.streamId}, '${r.at.toISOString()}', ${r.fromViewers}, ${r.toViewers}, ${r.delta}, '${r.createdAt.toISOString()}')`
  ).join(',\n');
  
  await pg.query(`
    INSERT INTO "RaidEvent" (id, "userId", "streamId", at, "fromViewers", "toViewers", delta, "createdAt")
    VALUES ${values}
    ON CONFLICT (id) DO NOTHING
  `);
  
  const duration = Date.now() - start;
  console.log(`✅ RaidEvent: ${raids.length} rows (${duration}ms)`);
  return { table: 'RaidEvent', count: raids.length, duration };
}

async function migrateClipMoments(sqlite: SqliteClient, pg: Client): Promise<MigrationStats> {
  const start = Date.now();
  const clips = await sqlite.clipMoment.findMany();
  
  if (clips.length === 0) {
    console.log('⏭️  ClipMoment: aucune donnée');
    return { table: 'ClipMoment', count: 0, duration: 0 };
  }
  
  const values = clips.map(c => 
    `(${c.id}, ${c.userId}, ${c.streamId}, '${c.at.toISOString()}', ${nullStr(c.label)}, ${c.score}, '${c.createdAt.toISOString()}')`
  ).join(',\n');
  
  await pg.query(`
    INSERT INTO "ClipMoment" (id, "userId", "streamId", at, label, score, "createdAt")
    VALUES ${values}
    ON CONFLICT (id) DO NOTHING
  `);
  
  const duration = Date.now() - start;
  console.log(`✅ ClipMoment: ${clips.length} rows (${duration}ms)`);
  return { table: 'ClipMoment', count: clips.length, duration };
}

async function migrateCreatedClips(sqlite: SqliteClient, pg: Client): Promise<MigrationStats> {
  const start = Date.now();
  const clips = await sqlite.createdClip.findMany();
  
  if (clips.length === 0) {
    console.log('⏭️  CreatedClip: aucune donnée');
    return { table: 'CreatedClip', count: 0, duration: 0 };
  }
  
  const values = clips.map(c => 
    `(${c.id}, ${c.userId}, ${c.streamId}, '${esc(c.twitchClipId)}', ${nullStr(c.editUrl)}, ${nullStr(c.url)}, ${c.confirmed}, '${c.createdAt.toISOString()}')`
  ).join(',\n');
  
  await pg.query(`
    INSERT INTO "CreatedClip" (id, "userId", "streamId", "twitchClipId", "editUrl", url, confirmed, "createdAt")
    VALUES ${values}
    ON CONFLICT (id) DO NOTHING
  `);
  
  const duration = Date.now() - start;
  console.log(`✅ CreatedClip: ${clips.length} rows (${duration}ms)`);
  return { table: 'CreatedClip', count: clips.length, duration };
}

async function migrateScheduleEntries(sqlite: SqliteClient, pg: Client): Promise<MigrationStats> {
  const start = Date.now();
  const entries = await sqlite.scheduleEntry.findMany();
  
  if (entries.length === 0) {
    console.log('⏭️  ScheduleEntry: aucune donnée');
    return { table: 'ScheduleEntry', count: 0, duration: 0 };
  }
  
  const values = entries.map(e => 
    `(${e.id}, ${e.userId}, '${esc(e.title)}', ${nullStr(e.category)}, '${e.start.toISOString()}', '${e.end.toISOString()}', ${nullStr(e.timezone)}, ${nullStr(e.twitchSegmentId)}, '${e.createdAt.toISOString()}')`
  ).join(',\n');
  
  await pg.query(`
    INSERT INTO "ScheduleEntry" (id, "userId", title, category, start, "end", timezone, "twitchSegmentId", "createdAt")
    VALUES ${values}
    ON CONFLICT (id) DO NOTHING
  `);
  
  const duration = Date.now() - start;
  console.log(`✅ ScheduleEntry: ${entries.length} rows (${duration}ms)`);
  return { table: 'ScheduleEntry', count: entries.length, duration };
}

async function migrateABTests(sqlite: SqliteClient, pg: Client): Promise<MigrationStats> {
  const start = Date.now();
  const tests = await sqlite.aBTest.findMany();
  
  if (tests.length === 0) {
    console.log('⏭️  ABTest: aucune donnée');
    return { table: 'ABTest', count: 0, duration: 0 };
  }
  
  const values = tests.map(t => 
    `(${t.id}, ${t.userId}, '${esc(t.name)}', '${esc(t.variantA)}', '${esc(t.variantB)}', '${esc(t.metric)}', '${t.createdAt.toISOString()}')`
  ).join(',\n');
  
  await pg.query(`
    INSERT INTO "ABTest" (id, "userId", name, "variantA", "variantB", metric, "createdAt")
    VALUES ${values}
    ON CONFLICT (id) DO NOTHING
  `);
  
  const duration = Date.now() - start;
  console.log(`✅ ABTest: ${tests.length} rows (${duration}ms)`);
  return { table: 'ABTest', count: tests.length, duration };
}

async function resetSequences(pg: Client) {
  console.log('\n🔄 Reset des séquences auto-increment...');
  
  const tables = [
    'User', 'Stream', 'StreamMetric', 'ChatMetric', 'FollowerEvent',
    'Annotation', 'Goal', 'NotificationWebhook', 'RaidEvent',
    'ClipMoment', 'CreatedClip', 'ScheduleEntry', 'ABTest'
  ];
  
  for (const table of tables) {
    await pg.query(`
      SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)
    `);
  }
  
  console.log('✅ Séquences réinitialisées');
}

// ============================================
// Helpers
// ============================================

function esc(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

function nullStr(str: string | null | undefined): string {
  if (str === null || str === undefined) return 'NULL';
  return `'${esc(str)}'`;
}

// Run
main();
