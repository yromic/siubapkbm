import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@/lib/errors';

export async function addJob(jobType: string, payload: any): Promise<string> {
  if (!jobType || !payload) {
    throw new AppError('Job type and payload are required.', 'ERR_VALIDATION', 400);
  }

  try {
    const id = uuidv4();
    await db('job_queue').insert({
      id,
      job_type: jobType,
      payload: JSON.stringify(payload),
      status: 'pending',
      error_message: null,
      created_at: new Date(),
      updated_at: new Date()
    });
    return id;
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error adding job to queue',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getJobStatus(id: string) {
  try {
    const job = await db('job_queue').where('id', id).first();
    if (!job) {
      throw new AppError('Job not found.', 'ERR_VALIDATION', 404);
    }
    return {
      id: job.id,
      job_type: job.job_type,
      status: job.status,
      error_message: job.error_message,
      created_at: job.created_at,
      updated_at: job.updated_at
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error getting job status',
      'ERR_DATABASE',
      500
    );
  }
}
