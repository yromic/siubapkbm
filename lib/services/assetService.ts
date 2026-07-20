import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { v4 as uuidv4 } from 'uuid';

export interface Asset {
  id: string;
  url: string;
  alt: string;
  caption?: string | null;
  title?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  created_at?: Date;
  updated_at?: Date;
}

export async function createAsset(data: Omit<Asset, 'id' | 'created_at' | 'updated_at'>): Promise<Asset> {
  try {
    const id = uuidv4();
    const asset: Asset = {
      id,
      ...data
    };
    await db('assets').insert(asset);
    return asset;
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error creating asset',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getAssetById(id: string): Promise<Asset | null> {
  try {
    const row = await db('assets').where('id', id).first();
    return row || null;
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error retrieving asset',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updateAsset(id: string, data: Partial<Omit<Asset, 'id' | 'created_at' | 'updated_at'>>): Promise<Asset> {
  try {
    await db('assets')
      .where('id', id)
      .update({
        ...data,
        updated_at: new Date()
      });
    const updated = await getAssetById(id);
    if (!updated) {
      throw new AppError('Asset not found after update', 'ERR_NOT_FOUND', 404);
    }
    return updated;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating asset',
      'ERR_DATABASE',
      500
    );
  }
}

export async function deleteAsset(id: string): Promise<void> {
  try {
    // Check referential integrity (referencing tables)
    const configRefs = await db('website_config')
      .where('logo_id', id)
      .orWhere('favicon_id', id)
      .orWhere('principal_photo_id', id)
      .first();

    const itemRefs = await db('section_items')
      .where('image_id', id)
      .first();

    if (configRefs || itemRefs) {
      throw new AppError(
        'Cannot delete asset because it is currently referenced by website config or landing page sections.',
        'ERR_REFERENTIAL_INTEGRITY',
        400
      );
    }

    await db('assets').where('id', id).delete();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error deleting asset',
      'ERR_DATABASE',
      500
    );
  }
}

export async function listAssets(): Promise<Asset[]> {
  try {
    return await db('assets').orderBy('created_at', 'desc');
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error listing assets',
      'ERR_DATABASE',
      500
    );
  }
}
