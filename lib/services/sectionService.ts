import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { v4 as uuidv4 } from 'uuid';
import { Asset } from './assetService';
import { createAuditLog } from './auditService';

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
  { type: 'cta', sort_order: 10, is_active: true, is_draft: false, content: '{}' },
  { type: 'achievements', sort_order: 11, is_active: true, is_draft: false, content: '{}' }
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
    } else {
      // Ensure 'achievements' section exists
      const hasAchievements = await db('sections').where('type', 'achievements').first();
      if (!hasAchievements) {
        await db('sections').insert({
          id: uuidv4(),
          type: 'achievements',
          sort_order: 11,
          is_active: true,
          is_draft: false,
          content: '{}'
        });
        sections = await db('sections')
          .where('is_active', true)
          .orderBy('sort_order', 'asc');
      }
    }
    
    const populatedSections: Section[] = [];
    
    for (const sec of sections) {
      // Parse JSON
      if (typeof sec.content === 'string') sec.content = JSON.parse(sec.content);
      if (typeof sec.draft_content === 'string') sec.draft_content = JSON.parse(sec.draft_content);
      
      // If includeDrafts is false, use content; if true and draft exists, merge/override with draft_content
      const activeContent = includeDrafts && sec.is_draft ? (sec.draft_content || sec.content) : sec.content;

      // Fetch items joined with assets (either from draft_content or production database table)
      let parsedItems: SectionItem[] = [];

      if (includeDrafts && sec.is_draft && activeContent && Array.isArray(activeContent.items)) {
        const draftItems = activeContent.items;
        const imageIds = draftItems.map((item: any) => item.image_id).filter(Boolean);
        
        let assetsMap: Record<string, any> = {};
        if (imageIds.length > 0) {
          const assets = await db('assets').whereIn('id', imageIds);
          for (const a of assets) {
            assetsMap[a.id] = a;
          }
        }
        
        parsedItems = draftItems.map((item: any) => {
          let customFields = item.custom_fields;
          if (typeof customFields === 'string') customFields = JSON.parse(customFields);
          
          const image = item.image_id && assetsMap[item.image_id] && assetsMap[item.image_id].url ? {
            id: item.image_id,
            url: assetsMap[item.image_id].url,
            alt: assetsMap[item.image_id].alt || '',
            caption: assetsMap[item.image_id].caption || null,
            title: assetsMap[item.image_id].title || null,
            mime_type: assetsMap[item.image_id].mime_type || null,
            size_bytes: assetsMap[item.image_id].size_bytes || null
          } : null;
          
          return {
            id: item.id || '',
            section_id: sec.id,
            title: item.title || null,
            subtitle: item.subtitle || null,
            description: item.description || null,
            badge: item.badge || null,
            icon: item.icon || null,
            image_id: item.image_id || null,
            sort_order: item.sort_order || 0,
            link_url: item.link_url || null,
            link_text: item.link_text || null,
            custom_fields: customFields,
            image
          } as SectionItem;
        });
      } else {
        if (sec.type === 'faq') {
          const rows = await db('faqs').where('is_active', true).orderBy('sort_order', 'asc');
          parsedItems = rows.map((r: any) => ({
            id: r.id,
            section_id: sec.id,
            title: r.question,
            description: r.answer,
            sort_order: r.sort_order,
            image: null
          } as SectionItem));
        } else if (sec.type === 'testimonials') {
          const rows = await db('testimonials')
            .leftJoin('assets', 'testimonials.avatar_image_id', 'assets.id')
            .select('testimonials.*', 'assets.url as asset_url', 'assets.alt as asset_alt')
            .where('testimonials.is_active', true)
            .orderBy('testimonials.sort_order', 'asc');
          parsedItems = rows.map((r: any) => ({
            id: r.id,
            section_id: sec.id,
            title: r.name,
            subtitle: r.role,
            description: r.quote,
            image_id: r.avatar_image_id,
            sort_order: r.sort_order,
            image: (r.avatar_image_id && r.asset_url) ? {
              id: r.avatar_image_id,
              url: r.asset_url,
              alt: r.asset_alt || ''
            } : null
          } as SectionItem));
        } else if (sec.type === 'gallery') {
          const rows = await db('gallery_items')
            .leftJoin('assets', 'gallery_items.image_id', 'assets.id')
            .select('gallery_items.*', 'assets.url as asset_url', 'assets.alt as asset_alt')
            .where('gallery_items.is_active', true)
            .orderBy('gallery_items.sort_order', 'asc');
          parsedItems = rows.map((r: any) => ({
            id: r.id,
            section_id: sec.id,
            title: r.title,
            description: r.description,
            image_id: r.image_id,
            sort_order: r.sort_order,
            custom_fields: r.category ? { category: r.category } : null,
            image: (r.image_id && r.asset_url) ? {
              id: r.image_id,
              url: r.asset_url,
              alt: r.asset_alt || ''
            } : null
          } as SectionItem));
        } else {
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
            
          parsedItems = items.map((item: any) => {
            if (typeof item.custom_fields === 'string') item.custom_fields = JSON.parse(item.custom_fields);
            
            const image = (item.image_id && item.asset_url) ? {
              id: item.image_id,
              url: item.asset_url,
              alt: item.asset_alt || '',
              caption: item.asset_caption || null,
              title: item.asset_title || null,
              mime_type: item.asset_mime_type || null,
              size_bytes: item.asset_size_bytes || null
            } : null;
            
            const { asset_url, asset_alt, asset_caption, asset_title, asset_mime_type, asset_size_bytes, ...rest } = item;
            return {
              ...rest,
              image
            } as SectionItem;
          });
        }
      }
      
      populatedSections.push({
        ...sec,
        title: activeContent?.title !== undefined ? activeContent.title : sec.title,
        subtitle: activeContent?.subtitle !== undefined ? activeContent.subtitle : sec.subtitle,
        badge: activeContent?.badge !== undefined ? activeContent.badge : sec.badge,
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
    
    let draftContent = section.draft_content;
    if (typeof draftContent === 'string') {
      draftContent = JSON.parse(draftContent);
    }
    
    if (!draftContent) {
      draftContent = typeof section.content === 'string' ? JSON.parse(section.content) : (section.content || {});
    }
    
    // Publish staged items to section_items if present in draft_content
    if (draftContent && Array.isArray(draftContent.items)) {
      const itemsToPublish = draftContent.items;
      
      await db.transaction(async (trx: any) => {
        if (section.type === 'faq') {
          await trx('faqs').delete();
          const toInsert = itemsToPublish.map((item: any) => ({
            id: item.id || uuidv4(),
            question: item.title || item.question || '',
            answer: item.description || item.answer || '',
            sort_order: item.sort_order || 0,
            is_active: true
          }));
          if (toInsert.length > 0) {
            await trx('faqs').insert(toInsert);
          }
        } else if (section.type === 'testimonials') {
          await trx('testimonials').delete();
          const toInsert = itemsToPublish.map((item: any) => ({
            id: item.id || uuidv4(),
            name: item.title || item.name || '',
            role: item.subtitle || item.role || '',
            quote: item.description || item.quote || '',
            avatar_image_id: item.image_id || null,
            sort_order: item.sort_order || 0,
            is_active: true
          }));
          if (toInsert.length > 0) {
            await trx('testimonials').insert(toInsert);
          }
        } else if (section.type === 'gallery') {
          await trx('gallery_items').delete();
          const toInsert = itemsToPublish.map((item: any) => {
            const parsed = item.custom_fields
              ? (typeof item.custom_fields === 'string' ? JSON.parse(item.custom_fields) : item.custom_fields)
              : {};
            const cat = item.subtitle || parsed.category || parsed.tag || null;
            return {
              id: item.id || uuidv4(),
              title: item.title || null,
              description: item.description || null,
              image_id: item.image_id || null,
              category: cat,
              sort_order: item.sort_order || 0,
              is_active: true
            };
          });
          if (toInsert.length > 0) {
            await trx('gallery_items').insert(toInsert);
          }
        } else {
          await trx('section_items').where('section_id', id).delete();
          
          const toInsert = itemsToPublish.map((item: any) => {
            const ins: any = {
              id: item.id || uuidv4(),
              section_id: id,
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
              ins.custom_fields = typeof item.custom_fields === 'string'
                ? item.custom_fields
                : JSON.stringify(item.custom_fields);
            }
            return ins;
          });
          
          if (toInsert.length > 0) {
            await trx('section_items').insert(toInsert);
          }
        }
      });
      
      delete draftContent.items;
    }
    
    await db('sections')
      .where('id', id)
      .update({
        content: JSON.stringify(draftContent),
        is_draft: false,
        published_at: new Date(),
        published_by: userId || null,
        updated_at: new Date()
      });

    // Create audit log version snapshot of this publication (header + child items)
    const activeSections = await getActiveSections(false);
    const publishedSnapshot = activeSections.find(s => s.id === id);
    if (publishedSnapshot) {
      await createAuditLog({
        action: 'publish',
        entity_type: 'sections',
        entity_id: id,
        old_value: null,
        new_value: publishedSnapshot,
        description: `Mempublikasikan perubahan seksi: ${publishedSnapshot.type}.`,
        user_id: userId
      });
    }
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
    const section = await db('sections').where('id', sectionId).first();
    if (!section) {
      throw new AppError('Section not found', 'ERR_NOT_FOUND', 404);
    }

    let draftContent: any = {};
    if (section.draft_content) {
      draftContent = typeof section.draft_content === 'string'
        ? JSON.parse(section.draft_content)
        : section.draft_content;
    } else if (section.content) {
      draftContent = typeof section.content === 'string'
        ? JSON.parse(section.content)
        : section.content;
    }

    draftContent.items = items;

    await db('sections')
      .where('id', sectionId)
      .update({
        is_draft: true,
        draft_content: JSON.stringify(draftContent),
        updated_at: new Date()
      });
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating section items',
      'ERR_DATABASE',
      500
    );
  }
}

export async function getSectionHistory(sectionId: string): Promise<any[]> {
  try {
    const logs = await db('audit_logs')
      .where('entity_type', 'sections')
      .where('entity_id', sectionId)
      .orderBy('created_at', 'desc');
    return logs.map((log: any) => {
      if (typeof log.new_value === 'string') log.new_value = JSON.parse(log.new_value);
      if (typeof log.old_value === 'string') log.old_value = JSON.parse(log.old_value);
      return log;
    });
  } catch (error) {
    throw new AppError('Gagal mengambil riwayat seksi.', 'ERR_DATABASE', 500);
  }
}

export async function rollbackSection(sectionId: string, auditLogId: string): Promise<void> {
  try {
    const log = await db('audit_logs').where('id', auditLogId).first();
    if (!log) {
      throw new AppError('Versi riwayat tidak ditemukan.', 'ERR_NOT_FOUND', 404);
    }
    
    const snapshot = typeof log.new_value === 'string' ? JSON.parse(log.new_value) : log.new_value;
    if (!snapshot) {
      throw new AppError('Snapshot kosong atau tidak valid.', 'ERR_VALIDATION', 400);
    }
    
    const section = await db('sections').where('id', sectionId).first();
    if (!section) {
      throw new AppError('Seksi tidak ditemukan.', 'ERR_NOT_FOUND', 404);
    }
    
    const content = typeof snapshot.content === 'string' ? JSON.parse(snapshot.content) : snapshot.content;
    const items = snapshot.items || [];
    
    await db.transaction(async (trx: any) => {
      // 1. Restore parent section record
      await trx('sections')
        .where('id', sectionId)
        .update({
          title: snapshot.title || null,
          subtitle: snapshot.subtitle || null,
          badge: snapshot.badge || null,
          is_active: snapshot.is_active !== undefined ? snapshot.is_active : true,
          content: JSON.stringify(content),
          is_draft: false,
          updated_at: new Date()
        });
        
      // 2. Restore child items depending on type
      if (section.type === 'faq') {
        await trx('faqs').delete();
        const toInsert = items.map((item: any) => ({
          id: item.id || uuidv4(),
          question: item.title || item.question || '',
          answer: item.description || item.answer || '',
          sort_order: item.sort_order || 0,
          is_active: true
        }));
        if (toInsert.length > 0) {
          await trx('faqs').insert(toInsert);
        }
      } else if (section.type === 'testimonials') {
        await trx('testimonials').delete();
        const toInsert = items.map((item: any) => ({
          id: item.id || uuidv4(),
          name: item.title || item.name || '',
          role: item.subtitle || item.role || '',
          quote: item.description || item.quote || '',
          avatar_image_id: item.image_id || null,
          sort_order: item.sort_order || 0,
          is_active: true
        }));
        if (toInsert.length > 0) {
          await trx('testimonials').insert(toInsert);
        }
      } else if (section.type === 'gallery') {
        await trx('gallery_items').delete();
        const toInsert = items.map((item: any) => {
          let cat = null;
          if (item.custom_fields) {
            const parsed = typeof item.custom_fields === 'string' ? JSON.parse(item.custom_fields) : item.custom_fields;
            cat = parsed.category || parsed.tag || null;
          }
          return {
            id: item.id || uuidv4(),
            title: item.title || null,
            description: item.description || null,
            image_id: item.image_id || null,
            category: cat,
            sort_order: item.sort_order || 0,
            is_active: true
          };
        });
        if (toInsert.length > 0) {
          await trx('gallery_items').insert(toInsert);
        }
      } else {
        await trx('section_items').where('section_id', sectionId).delete();
        
        const toInsert = items.map((item: any) => {
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
            ins.custom_fields = typeof item.custom_fields === 'string'
              ? item.custom_fields
              : JSON.stringify(item.custom_fields);
          }
          return ins;
        });
        
        if (toInsert.length > 0) {
          await trx('section_items').insert(toInsert);
        }
      }
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Gagal melakukan rollback seksi.',
      'ERR_DATABASE',
      500
    );
  }
}
