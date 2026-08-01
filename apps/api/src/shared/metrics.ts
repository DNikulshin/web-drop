import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const fileDeletionsTotal = new client.Counter({
  name: 'webdrop_file_deletions_total',
  help: 'Number of file deletions completed',
});
export const fileDeletionErrorsTotal = new client.Counter({
  name: 'webdrop_file_deletion_errors_total',
  help: 'Number of file deletion errors',
});
export const s3DeletionsTotal = new client.Counter({
  name: 'webdrop_s3_deletions_total',
  help: 'Number of S3 deletions completed',
});
export const s3DeletionErrorsTotal = new client.Counter({
  name: 'webdrop_s3_deletion_errors_total',
  help: 'Number of S3 deletion errors',
});
export const cleanupBatches = new client.Counter({
  name: 'webdrop_cleanup_batches_total',
  help: 'Number of cleanup batches processed',
});

register.registerMetric(fileDeletionsTotal);
register.registerMetric(fileDeletionErrorsTotal);
register.registerMetric(s3DeletionsTotal);
register.registerMetric(s3DeletionErrorsTotal);
register.registerMetric(cleanupBatches);

export function getMetrics() {
  return register.metrics();
}
