import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { v4 as uuidv4 } from 'uuid';
import { Asset } from './assetService';

export interface SectionItem {
  id: string;
  section_id: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  badge?: string | null;
  icon?: string | null;
  image_id?: string | null;
  sort_order: number;
  link_url?: string | null;
  link_text?: string | null;
  custom_fields?: any; // JSON
  created_at?: Date;
  
  // Joined asset
  image?: Asset | null;
}

export interface Section {
  id: string;
  type: string;
  title?: string | null;
  subtitle?: string | null;
  badge?: string | null;
  sort_order: number;
  is_active: boolean;
  content?: any; // JSON
  is_draft: boolean;
  draft_content?: any; // JSON
  published_at?: Date | null;
  updated_by?: string | null;
  published_by?: string | null;
  created_at?: Date;
  updated_at?: Date;
  
  items?: SectionItem[];
}

const DEFAULT_SECTIONS: Array<Omit<Section, 'id' | 'items'>> = [
  { type: 'hero', sort_order: 1, is_active: true, is_draft: false, content: '{}' },
  { type: 'why-choose-us', sort_order: 2, is_active: true, is_draft: false, content: '{}' },
  { type: 'about', sort_order: 3, is_active: true, is_draft: false, content: '{}' },
  { type: 'programs', sort_order: 4, is_active: true, is_draft: false, content: '{}' },
  { type: 'school-life', sort_order: 5, is_active: true, is_draft: false, content: '{}' },
  { type: 'gallery', sort_order: 6, is_active: true, is_draft: false, content: '{}' },
  { type: 'testimonials', sort_order: 7, is_active: true, is_draft: false, content: '{}' },
  { type: 'principal', sort_order: 8, is_active: true, is_draft: false, content: '{}' },
  { type: 'faq', sort_order: 9, is_active: true, is_draft: false, content: '{}' },
  { type: 'cta', sort_order: 10, is_active: true, is_draft: false, content: '{}' }
];

export async function getActiveSections(includeDrafts = false): Promise<Section[]> {
  try {
    let sections = await db('sections')
      .where('is_active', true)
      .orderBy('sort_order', 'asc');
      
    // Auto-seed sections if empty
    if (sections.length === 0) {
      const inserts = DEFAULT_SECTIONS.map(sec => ({
        id: uuidv4(),
        ...sec
      }));
      await db('sections').insert(inserts);
      sections = await db('sections')
        .where('is_active', true)
        .orderBy('sort_order', 'asc');
    }
    
    const populatedSections: Section[] = [];
    
    for (const sec of sections) {
      // Parse JSON
      if (typeof sec.content === 'string') sec.content = JSON.parse(sec.content);
      if (typeof sec.draft_content === 'string') sec.draft_content = JSON.parse(sec.draft_content);
      
      // If includeDrafts is false, use content; if true and draft exists, merge/override with draft_content
      const activeContent = includeDrafts && sec.is_draft ? (sec.draft_content || sec.content) : sec.content;
      
      // Fetch items joined with assets
      const items = await db('section_items')
        .select(
          'section_items.*',
          'assets.url as asset_url',
          'assets.alt as asset_alt',
          'assets.caption as asset_caption',
          'assets.title as asset_title',
          'assets.mime_type as asset_mime_type',
          'assets.size_bytes as asset_size_bytes'
        )
        .leftJoin('assets', 'section_items.image_id', 'assets.id')
        .where('section_items.section_id', sec.id)
        .orderBy('section_items.sort_order', 'asc');
        
      const parsedItems = items.map(item => {
        if (typeof item.custom_fields === 'string') item.custom_fields = JSON.parse(item.custom_fields);
        
        const image = item.image_id ? {
          id: item.image_id,
          url: item.asset_url,
          alt: item.asset_alt,
          caption: item.asset_caption,
          title: item.asset_title,
          mime_type: item.asset_mime_type,
          size_bytes: item.asset_size_bytes
        } : null;
        
        const { asset_url, asset_alt, asset_caption, asset_title, asset_mime_type, asset_size_bytes, ...rest } = item;
        return {
          ...rest,
          image
        } as SectionItem;
      });
      
      populatedSections.push({
        ...sec,
        content: activeContent,
        items: parsedItems
      });
    }
    
    return populatedSections;
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error retrieving active landing sections',
      'ERR_DATABASE',
      500
    );
  }
}

export async function createSection(data: Omit<Section, 'id' | 'items' | 'created_at' | 'updated_at'>): Promise<Section> {
  try {
    const id = uuidv4();
    const secData: any = {
      id,
      ...data,
      created_at: new Date(),
      updated_at: new Date()
    };
    if (data.content) secData.content = JSON.stringify(data.content);
    if (data.draft_content) secData.draft_content = JSON.stringify(data.draft_content);
    
    await db('sections').insert(secData);
    
    const created = await db('sections').where('id', id).first();
    return created;
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error creating section',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updateSectionDraft(id: string, draftContent: any, userId?: string): Promise<void> {
  try {
    await db('sections')
      .where('id', id)
      .update({
        is_draft: true,
        draft_content: JSON.stringify(draftContent),
        updated_by: userId || null,
        updated_at: new Date()
      });
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating section draft',
      'ERR_DATABASE',
      500
    );
  }
}

export async function publishSection(id: string, userId?: string): Promise<void> {
  try {
    const section = await db('sections').where('id', id).first();
    if (!section) {
      throw new AppError('Section not found', 'ERR_NOT_FOUND', 404);
    }
    
    const draftContent = section.draft_content || section.content;
    
    await db('sections')
      .where('id', id)
      .update({
        content: draftContent,
        is_draft: false,
        published_at: new Date(),
        published_by: userId || null,
        updated_at: new Date()
      });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error publishing section',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updateSectionItems(sectionId: string, items: Array<Omit<SectionItem, 'section_id' | 'created_at'>>): Promise<void> {
  try {
    await db.transaction(async (trx) => {
      // Clear existing
      await trx('section_items').where('section_id', sectionId).delete();
      
      const toInsert = items.map(item => {
        const ins: any = {
          id: item.id || uuidv4(),
          section_id: sectionId,
          title: item.title || null,
          subtitle: item.subtitle || null,
          description: item.description || null,
          badge: item.badge || null,
          icon: item.icon || null,
          image_id: item.image_id || null,
          sort_order: item.sort_order || 0,
          link_url: item.link_url || null,
          link_text: item.link_text || null
        };
        if (item.custom_fields) {
          ins.custom_fields = JSON.stringify(item.custom_fields);
        }
        return ins;
      });
      
      if (toInsert.length > 0) {
        await trx('section_items').insert(toInsert);
      }
    });
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating section items',
      'ERR_DATABASE',
      500
    );
  }
}
