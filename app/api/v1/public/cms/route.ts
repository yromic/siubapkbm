import { NextRequest, NextResponse } from 'next/server';
import { getBrandingConfig, getContactConfig, getSocialConfig } from '@/lib/services/websiteConfigService';
import { getActiveSections } from '@/lib/services/sectionService';
import { getNavigationMenu } from '@/lib/services/navigationService';
import { successResponse, errorResponse } from '@/lib/response';

// GET /api/v1/public/cms - Unified headless public content endpoint
export async function GET(req: NextRequest) {
  try {
    // 1. Fetch config subsets
    const branding = await getBrandingConfig();
    const contact = await getContactConfig();
    const social = await getSocialConfig();

    // 2. Fetch header/footer navigation
    const navbarMenu = await getNavigationMenu('navbar');
    const footerMenu = await getNavigationMenu('footer');

    // 3. Fetch active sections (published only, no drafts)
    const sections = await getActiveSections(false);

    // 4. Return consolidated payload
    return successResponse({
      config: {
        branding,
        contact,
        social
      },
      navigation: {
        navbar: navbarMenu?.links || [],
        footer: footerMenu?.links || []
      },
      sections
    }, 'Public CMS content retrieved successfully.');
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Database error compiling public CMS data.',
      'ERR_INTERNAL_SERVER',
      500
    );
  }
}
