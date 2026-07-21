import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { v4 as uuidv4 } from 'uuid';

export interface NavigationLink {
  id: string;
  menu_id: string;
  parent_id?: string | null;
  label: string;
  url: string;
  sort_order: number;
  icon?: string | null;
  target: string;
  created_at?: Date;
  children?: NavigationLink[];
}

export interface NavigationMenu {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: Date;
  links?: NavigationLink[];
}

const DEFAULT_MENUS: Record<string, Array<{ label: string; url: string; sort_order: number }>> = {
  navbar: [
    { label: 'Beranda', url: '/', sort_order: 1 },
    { label: 'Mengapa Kami', url: '#why-choose-us', sort_order: 2 },
    { label: 'Tentang', url: '#about', sort_order: 3 },
    { label: 'Program', url: '#programs', sort_order: 4 },
    { label: 'FAQ', url: '#faq', sort_order: 5 }
  ],
  footer: [
    { label: 'Beranda', url: '/', sort_order: 1 },
    { label: 'Mengapa Kami', url: '#why-choose-us', sort_order: 2 },
    { label: 'Tentang', url: '#about', sort_order: 3 },
    { label: 'Program', url: '#programs', sort_order: 4 }
  ]
};

export async function getNavigationMenu(name: string): Promise<NavigationMenu | null> {
  try {
    let menu = await db('navigation_menus').where('name', name).first();
    
    // Auto-seed if empty
    if (!menu) {
      if (DEFAULT_MENUS[name]) {
        const menuId = uuidv4();
        await db('navigation_menus').insert({
          id: menuId,
          name,
          is_active: true
        });
        
        const linksToInsert = DEFAULT_MENUS[name].map(link => ({
          id: uuidv4(),
          menu_id: menuId,
          parent_id: null,
          label: link.label,
          url: link.url,
          sort_order: link.sort_order,
          icon: null,
          target: '_self'
        }));
        
        if (linksToInsert.length > 0) {
          await db('navigation_links').insert(linksToInsert);
        }
        
        menu = await db('navigation_menus').where('id', menuId).first();
      } else {
        return null;
      }
    }
    
    if (!menu.is_active) {
      return { ...menu, links: [] };
    }
    
    // Fetch links
    const links = await db('navigation_links')
      .where('menu_id', menu.id)
      .orderBy('sort_order', 'asc');
      
    // Build tree
    const tree: NavigationLink[] = [];
    const lookup: Record<string, NavigationLink> = {};
    
    for (const link of links) {
      lookup[link.id] = { ...link, children: [] };
    }
    
    for (const link of links) {
      const node = lookup[link.id];
      if (link.parent_id && lookup[link.parent_id]) {
        lookup[link.parent_id].children?.push(node);
      } else {
        tree.push(node);
      }
    }
    
    return {
      ...menu,
      links: tree
    };
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error retrieving navigation menu',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updateNavigationLinks(menuId: string, links: Array<Omit<NavigationLink, 'menu_id'>>): Promise<void> {
  try {
    await db.transaction(async (trx: any) => {
      // Clear existing links
      await trx('navigation_links').where('menu_id', menuId).delete();
      
      // Helper function to insert links recursively to maintain parent_id references
      const insertTree = async (nodes: any[], parentId: string | null = null) => {
        for (const node of nodes) {
          const newId = node.id || uuidv4();
          await trx('navigation_links').insert({
            id: newId,
            menu_id: menuId,
            parent_id: parentId,
            label: node.label,
            url: node.url,
            sort_order: node.sort_order,
            icon: node.icon || null,
            target: node.target || '_self'
          });
          if (node.children && node.children.length > 0) {
            await insertTree(node.children, newId);
          }
        }
      };
      
      await insertTree(links);
    });
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating navigation links',
      'ERR_DATABASE',
      500
    );
  }
}
