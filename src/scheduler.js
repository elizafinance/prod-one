// src/scheduler.js
import cron from 'node-cron';
import { questLifecycleService } from './services/questLifecycle.service.js';
import { connectToDatabase } from './lib/mongodb.js'; // For initial connection if needed by service

console.log('[Scheduler] Starting up...');

async function initializeAndScheduleJobs() {
  try {
    // Ensure DB connection is available for the services, though services connect themselves.
    // This is more of a check or a warm-up.
    await connectToDatabase();
    console.log('[Scheduler] Database connection established/verified.');

    // Schedule tasks
    // Example: Run every minute to check for quests to activate/expire.
    // For production, you might choose longer intervals, e.g., every 5 or 10 minutes, or hourly.
    cron.schedule('* * * * *', async () => {
      console.log('[Scheduler] Running scheduled job: activateScheduledQuests');
      try {
        await questLifecycleService.activateScheduledQuests();
      } catch (e) {
        console.error('[Scheduler] Error during activateScheduledQuests job:', e);
      }
    });

    cron.schedule('* * * * *', async () => { // Can be the same or different schedule
      console.log('[Scheduler] Running scheduled job: expireOverdueQuests');
      try {
        await questLifecycleService.expireOverdueQuests();
      } catch (e) {
        console.error('[Scheduler] Error during expireOverdueQuests job:', e);
      }
    });

    console.log('[Scheduler] Cron jobs scheduled. Checking for quest status updates every minute.');
    console.log('[Scheduler] Scheduler process is running. Press Ctrl+C to exit.');

  } catch (error) {
    console.error('[Scheduler] Failed to initialize scheduler or connect to DB:', error);
    process.exit(1);
  }
}

initializeAndScheduleJobs();

// Keep the process alive if it's a standalone scheduler
// This is often not needed if cron jobs themselves keep it alive or if managed by PM2.
// For a simple `node src/scheduler.js`, it might exit if nothing else is holding it.
// However, node-cron jobs should keep the process running.
// If it exits prematurely, you might need: setInterval(() => {}, 1 << 30); // A long interval no-op 