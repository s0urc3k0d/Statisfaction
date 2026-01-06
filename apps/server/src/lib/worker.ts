import { 
  getNextJob, 
  completeJob, 
  failJob, 
  JOB_QUEUES,
  isRedisAvailable,
  Job
} from './cache';
import { prisma } from './prisma';
import { computeRecap } from './recap';
import { sendRecapEmail } from './mailer';

// Worker state
let isRunning = false;
let pollInterval: NodeJS.Timeout | null = null;

// Job handlers
type JobHandler = (job: Job) => Promise<any>;

const jobHandlers: Record<string, JobHandler> = {
  // Recap job handler
  'recap:generate': async (job) => {
    const { userId, streamId, email } = job.data;
    
    console.log(`[Worker] Processing recap for stream ${streamId}`);
    
    const recap = await computeRecap(userId, streamId);
    if (!recap) {
      throw new Error('Failed to compute recap');
    }
    
    if (email) {
      await sendRecapEmail(email, recap);
    }
    
    return { success: true, streamId };
  },
  
  // Cleanup job handler
  'cleanup:metrics': async (job) => {
    const { daysOld = 180 } = job.data;
    
    console.log(`[Worker] Cleaning metrics older than ${daysOld} days`);
    
    const cutoff = new Date(Date.now() - daysOld * 24 * 3600 * 1000);
    const result = await prisma.streamMetric.deleteMany({
      where: { timestamp: { lt: cutoff } }
    });
    
    return { deleted: result.count };
  },
  
  'cleanup:chat': async (job) => {
    const { daysOld = 30 } = job.data;
    
    console.log(`[Worker] Cleaning chat messages older than ${daysOld} days`);
    
    const cutoff = new Date(Date.now() - daysOld * 24 * 3600 * 1000);
    const result = await prisma.chatMessage.deleteMany({
      where: { timestamp: { lt: cutoff } }
    });
    
    return { deleted: result.count };
  },
  
  'cleanup:expired-clips': async () => {
    console.log('[Worker] Cleaning expired clip moments');
    
    const result = await prisma.clipMoment.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: new Date() }
      },
      data: { status: 'expired' }
    });
    
    return { expired: result.count };
  }
};

/**
 * Process a single job from a queue
 */
async function processQueue(queue: string): Promise<boolean> {
  const job = await getNextJob(queue);
  if (!job) return false;
  
  console.log(`[Worker] Processing job ${job.id} (${job.type})`);
  
  const handler = jobHandlers[job.type];
  if (!handler) {
    console.warn(`[Worker] No handler for job type: ${job.type}`);
    await failJob(queue, job.id, `Unknown job type: ${job.type}`);
    return true;
  }
  
  try {
    const result = await handler(job);
    await completeJob(queue, job.id, result);
    console.log(`[Worker] Job ${job.id} completed`);
  } catch (err: any) {
    console.error(`[Worker] Job ${job.id} failed:`, err.message);
    await failJob(queue, job.id, err.message);
  }
  
  return true;
}

/**
 * Main worker loop
 */
async function workerLoop(): Promise<void> {
  if (!isRunning) return;
  
  // Process each queue
  for (const queue of Object.values(JOB_QUEUES)) {
    try {
      // Process up to 5 jobs per queue per iteration
      for (let i = 0; i < 5; i++) {
        const processed = await processQueue(queue);
        if (!processed) break;
      }
    } catch (err) {
      console.error(`[Worker] Error processing queue ${queue}:`, err);
    }
  }
}

/**
 * Start the job worker
 */
export function startJobWorker(intervalMs: number = 5000): void {
  if (isRunning) {
    console.warn('[Worker] Already running');
    return;
  }
  
  if (!isRedisAvailable()) {
    console.warn('[Worker] Redis not available, job worker disabled');
    return;
  }
  
  isRunning = true;
  console.log('✅ Job worker started');
  
  // Initial run
  workerLoop().catch(console.error);
  
  // Schedule periodic runs
  pollInterval = setInterval(() => {
    workerLoop().catch(console.error);
  }, intervalMs);
}

/**
 * Stop the job worker
 */
export function stopJobWorker(): void {
  isRunning = false;
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  console.log('🛑 Job worker stopped');
}

/**
 * Check if worker is running
 */
export function isWorkerRunning(): boolean {
  return isRunning;
}

/**
 * Register a custom job handler
 */
export function registerJobHandler(type: string, handler: JobHandler): void {
  jobHandlers[type] = handler;
}

/**
 * Get registered job types
 */
export function getRegisteredJobTypes(): string[] {
  return Object.keys(jobHandlers);
}
