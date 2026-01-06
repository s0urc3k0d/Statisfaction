import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from './prisma';
import axios from 'axios';

const execAsync = promisify(exec);
const fsPromises = fs.promises;

// Configuration
const COMPILATION_DIR = process.env.COMPILATION_DIR || './compilations';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const MAX_CONCURRENT_JOBS = 2;

// Job queue for compilations
interface CompilationJob {
  id: string;
  userId: number;
  clipIds: string[];
  format: 'landscape' | 'portrait' | 'square';
  quality: 'low' | 'medium' | 'high';
  includeTransitions: boolean;
  status: 'queued' | 'downloading' | 'processing' | 'done' | 'failed';
  progress: number;
  outputPath?: string;
  error?: string;
  createdAt: Date;
}

const compilationJobs = new Map<string, CompilationJob>();
let activeJobs = 0;

// Format presets
const FORMAT_PRESETS = {
  landscape: { width: 1920, height: 1080, name: 'YouTube/Twitch' },
  portrait: { width: 1080, height: 1920, name: 'TikTok/Reels' },
  square: { width: 1080, height: 1080, name: 'Instagram' },
};

const QUALITY_PRESETS = {
  low: { crf: 28, preset: 'fast', bitrate: '2M' },
  medium: { crf: 23, preset: 'medium', bitrate: '4M' },
  high: { crf: 18, preset: 'slow', bitrate: '8M' },
};

/**
 * Check if FFmpeg is available
 */
export async function checkFFmpeg(): Promise<boolean> {
  try {
    await execAsync(`${FFMPEG_PATH} -version`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure compilation directory exists
 */
async function ensureCompilationDir(): Promise<void> {
  await fsPromises.mkdir(COMPILATION_DIR, { recursive: true });
}

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get clip download URL from Twitch
 */
async function getClipDownloadUrl(clipId: string, accessToken: string): Promise<string | null> {
  try {
    // Get clip info
    const res = await axios.get(`https://api.twitch.tv/helix/clips?id=${clipId}`, {
      headers: {
        'Client-ID': process.env.TWITCH_CLIENT_ID!,
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    const clip = res.data?.data?.[0];
    if (!clip) return null;
    
    // Extract download URL from thumbnail URL
    // Twitch thumbnail URLs follow pattern: https://clips-media-assets2.twitch.tv/AT-cm%7C{id}.mp4-preview-480x272.jpg
    // The actual video is at: https://clips-media-assets2.twitch.tv/{id}.mp4
    const thumbnailUrl = clip.thumbnail_url;
    const videoUrl = thumbnailUrl.replace(/-preview-\d+x\d+\.jpg$/, '.mp4');
    
    return videoUrl;
  } catch (error) {
    console.error(`Failed to get download URL for clip ${clipId}:`, error);
    return null;
  }
}

/**
 * Download a clip to local storage
 */
async function downloadClip(url: string, outputPath: string): Promise<boolean> {
  try {
    const response = await axios.get(url, { responseType: 'stream' });
    const writer = fs.createWriteStream(outputPath);
    
    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      writer.on('finish', () => resolve(true));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('Download failed:', error);
    return false;
  }
}

/**
 * Get video duration using FFprobe
 */
async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    return parseFloat(stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

/**
 * Create a simple fade transition filter
 */
function createTransitionFilter(inputCount: number, transitionDuration: number = 0.5): string {
  if (inputCount <= 1) return '';
  
  // Simple crossfade between clips
  const filters: string[] = [];
  for (let i = 0; i < inputCount - 1; i++) {
    const fadeStart = 0; // Simplified - would need actual timing calculation
    filters.push(`[${i}:v]fade=t=out:st=${fadeStart}:d=${transitionDuration}[v${i}]`);
  }
  
  return filters.join(';');
}

/**
 * Start a new compilation job
 */
export async function startCompilation(
  userId: number,
  clipIds: string[],
  options: {
    format?: 'landscape' | 'portrait' | 'square';
    quality?: 'low' | 'medium' | 'high';
    includeTransitions?: boolean;
    title?: string;
  } = {}
): Promise<{ jobId: string; error?: string }> {
  // Check FFmpeg availability
  const ffmpegAvailable = await checkFFmpeg();
  if (!ffmpegAvailable) {
    return { jobId: '', error: 'FFmpeg non disponible sur le serveur' };
  }
  
  // Validate clips
  if (!clipIds || clipIds.length === 0) {
    return { jobId: '', error: 'Aucun clip sélectionné' };
  }
  
  if (clipIds.length > 20) {
    return { jobId: '', error: 'Maximum 20 clips par compilation' };
  }
  
  // Create job
  const jobId = generateJobId();
  const job: CompilationJob = {
    id: jobId,
    userId,
    clipIds,
    format: options.format || 'landscape',
    quality: options.quality || 'medium',
    includeTransitions: options.includeTransitions ?? true,
    status: 'queued',
    progress: 0,
    createdAt: new Date(),
  };
  
  compilationJobs.set(jobId, job);
  
  // Process job asynchronously
  processJob(jobId).catch(err => {
    console.error(`Compilation job ${jobId} failed:`, err);
    const j = compilationJobs.get(jobId);
    if (j) {
      j.status = 'failed';
      j.error = err.message;
    }
  });
  
  return { jobId };
}

/**
 * Process a compilation job
 */
async function processJob(jobId: string): Promise<void> {
  const job = compilationJobs.get(jobId);
  if (!job) return;
  
  // Wait if too many jobs running
  while (activeJobs >= MAX_CONCURRENT_JOBS) {
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  activeJobs++;
  
  try {
    await ensureCompilationDir();
    
    // Get user for access token
    const user = await prisma.user.findUnique({ where: { id: job.userId } });
    if (!user) throw new Error('User not found');
    
    const jobDir = path.join(COMPILATION_DIR, jobId);
    await fsPromises.mkdir(jobDir, { recursive: true });
    
    // Download clips
    job.status = 'downloading';
    const downloadedClips: string[] = [];
    
    for (let i = 0; i < job.clipIds.length; i++) {
      const clipId = job.clipIds[i];
      const clipPath = path.join(jobDir, `clip_${i}.mp4`);
      
      // Get download URL
      const url = await getClipDownloadUrl(clipId, user.accessToken);
      if (!url) {
        console.warn(`Could not get URL for clip ${clipId}, skipping`);
        continue;
      }
      
      // Download
      const success = await downloadClip(url, clipPath);
      if (success) {
        downloadedClips.push(clipPath);
      }
      
      job.progress = Math.floor((i + 1) / job.clipIds.length * 40); // 40% for downloads
    }
    
    if (downloadedClips.length === 0) {
      throw new Error('Aucun clip téléchargé avec succès');
    }
    
    // Process with FFmpeg
    job.status = 'processing';
    
    const formatPreset = FORMAT_PRESETS[job.format];
    const qualityPreset = QUALITY_PRESETS[job.quality];
    const outputPath = path.join(jobDir, 'output.mp4');
    
    // Create concat file
    const concatFile = path.join(jobDir, 'concat.txt');
    const concatContent = downloadedClips.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    await fsPromises.writeFile(concatFile, concatContent);
    
    // Build FFmpeg command
    const ffmpegArgs = [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFile,
      '-vf', `scale=${formatPreset.width}:${formatPreset.height}:force_original_aspect_ratio=decrease,pad=${formatPreset.width}:${formatPreset.height}:(ow-iw)/2:(oh-ih)/2`,
      '-c:v', 'libx264',
      '-preset', qualityPreset.preset,
      '-crf', String(qualityPreset.crf),
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      '-y',
      outputPath
    ];
    
    // Run FFmpeg
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs);
      
      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        // Parse progress from FFmpeg output
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
        if (timeMatch) {
          // Update progress (simplified)
          job.progress = 40 + Math.min(55, job.progress + 5);
        }
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
      
      ffmpeg.on('error', reject);
    });
    
    // Cleanup temp files
    for (const clip of downloadedClips) {
      await fsPromises.unlink(clip).catch(() => {});
    }
    await fsPromises.unlink(concatFile).catch(() => {});
    
    // Save to database
    await prisma.compilation.create({
      data: {
        userId: job.userId,
        jobId,
        clipCount: job.clipIds.length,
        format: job.format,
        quality: job.quality,
        outputPath,
        status: 'done',
      }
    });
    
    job.status = 'done';
    job.progress = 100;
    job.outputPath = outputPath;
    
  } catch (error: any) {
    job.status = 'failed';
    job.error = error.message;
    throw error;
  } finally {
    activeJobs--;
  }
}

/**
 * Get job status
 */
export function getJobStatus(jobId: string): CompilationJob | null {
  return compilationJobs.get(jobId) || null;
}

/**
 * Get all jobs for a user
 */
export function getUserJobs(userId: number): CompilationJob[] {
  return Array.from(compilationJobs.values())
    .filter(j => j.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get compilation history from database
 */
export async function getCompilationHistory(userId: number, limit: number = 20) {
  return prisma.compilation.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Delete a compilation
 */
export async function deleteCompilation(userId: number, compilationId: number): Promise<boolean> {
  const compilation = await prisma.compilation.findUnique({
    where: { id: compilationId }
  });
  
  if (!compilation || compilation.userId !== userId) {
    return false;
  }
  
  // Delete file
  if (compilation.outputPath) {
    try {
      await fsPromises.unlink(compilation.outputPath);
      // Also try to delete parent directory
      const dir = path.dirname(compilation.outputPath);
      await fsPromises.rmdir(dir).catch(() => {});
    } catch {
      // File might already be deleted
    }
  }
  
  // Delete from database
  await prisma.compilation.delete({ where: { id: compilationId } });
  
  return true;
}

/**
 * Cleanup old compilations (older than X days)
 */
export async function cleanupOldCompilations(daysOld: number = 7): Promise<number> {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  const oldCompilations = await prisma.compilation.findMany({
    where: { createdAt: { lt: cutoff } }
  });
  
  let deleted = 0;
  for (const comp of oldCompilations) {
    if (comp.outputPath) {
      try {
        await fsPromises.unlink(comp.outputPath);
        const dir = path.dirname(comp.outputPath);
        await fsPromises.rmdir(dir).catch(() => {});
      } catch {}
    }
    await prisma.compilation.delete({ where: { id: comp.id } });
    deleted++;
  }
  
  // Also cleanup stale jobs from memory
  const staleTime = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id, job] of compilationJobs) {
    if (job.createdAt.getTime() < staleTime) {
      compilationJobs.delete(id);
    }
  }
  
  return deleted;
}

/**
 * Start periodic cleanup of old compilations
 */
export function startCompilationCleanup(intervalHours: number = 24): void {
  setInterval(() => {
    cleanupOldCompilations().catch(err => {
      console.warn('Compilation cleanup failed:', err);
    });
  }, intervalHours * 60 * 60 * 1000);
  
  // Initial cleanup
  cleanupOldCompilations().catch(() => {});
}
