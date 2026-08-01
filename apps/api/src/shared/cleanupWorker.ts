import { FastifyInstance } from 'fastify';
import { listExpired, deleteFile } from './storage.js';
import { cleanupBatches, fileDeletionsTotal, fileDeletionErrorsTotal, s3DeletionsTotal, s3DeletionErrorsTotal } from './metrics.js';

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export function startCleanupWorker(server: FastifyInstance, options?: { batchSize?: number; intervalMs?: number }) {
  const batchSize = options?.batchSize ?? 20;
  const intervalMs = options?.intervalMs ?? 60 * 1000;
  let stopped = false;
  let running = false;

  const loop = async () => {
    running = true;
    while (!stopped) {
      try {
        const expired = await listExpired();
        if (expired.length > 0) {
          server.log.info({ count: expired.length }, 'Found expired uploads');
          // process in batches
          for (let i = 0; i < expired.length; i += batchSize) {
            const batch = expired.slice(i, i + batchSize);
            cleanupBatches.inc();
            await Promise.all(
              batch.map(async (code) => {
                try {
                  const result = await deleteFile(code);
                  if (result.s3) {
                    if (result.success) s3DeletionsTotal.inc();
                    else s3DeletionErrorsTotal.inc();
                  } else {
                    if (result.success) fileDeletionsTotal.inc();
                    else fileDeletionErrorsTotal.inc();
                  }
                  server.log.info({ code, result }, 'Deleted expired upload');
                } catch (err) {
                  fileDeletionErrorsTotal.inc();
                  server.log.error({ code, err }, 'Error deleting expired upload');
                }
              }),
            );
            await sleep(500);
          }
        }
      } catch (err) {
        server.log.error({ err }, 'Cleanup worker error');
      }

      // wait before next poll
      let waited = 0;
      while (!stopped && waited < intervalMs) {
        await sleep(500);
        waited += 500;
      }
    }
    running = false;
  };

  loop();

  return async function stop() {
    stopped = true;
    while (running) {
      await sleep(200);
    }
  };
}
*** End Patch