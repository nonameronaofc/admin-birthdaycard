import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';
import { logApiError } from '@/lib/logger';
import { escapeIlikePattern, sanitizeSearchTerm } from '@/lib/sanitize';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard) return guard;

  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const gender = searchParams.get('gender');
  const parentsContent = searchParams.get('parents_content');
  const isActive = searchParams.get('is_active');
  const search = sanitizeSearchTerm(searchParams.get('search'));
  const escapedSearch = search ? escapeIlikePattern(search) : '';

  let query = supabase
    .from('themes')
    .select('*, theme_package_codes(package_code), theme_images(id, image_url, storage_path, display_order)')
    .order('created_at', { ascending: false });

  if (gender) query = query.eq('gender', gender);
  if (parentsContent) query = query.eq('parents_content', parentsContent);
  if (isActive !== null && isActive !== '') query = query.eq('is_active', isActive === 'true');
  if (search) query = query.or(`name.ilike.%${escapedSearch}%,theme_code.ilike.%${escapedSearch}%`);

  const { data, error } = await query;
  if (error) {
    if (error.message.includes('theme_images')) {
      let fallbackQuery = supabase
        .from('themes')
        .select('*, theme_package_codes(package_code)')
        .order('created_at', { ascending: false });

      if (gender) fallbackQuery = fallbackQuery.eq('gender', gender);
      if (parentsContent) fallbackQuery = fallbackQuery.eq('parents_content', parentsContent);
      if (isActive !== null && isActive !== '') fallbackQuery = fallbackQuery.eq('is_active', isActive === 'true');
      if (search) fallbackQuery = fallbackQuery.or(`name.ilike.%${escapedSearch}%,theme_code.ilike.%${escapedSearch}%`);

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;
      if (fallbackError) {
        logApiError('admin.themes.list.fallback', fallbackError, {
          gender,
          parentsContent,
          isActive,
          search,
        });
        return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      }
      return NextResponse.json({ data: fallbackData });
    }
    logApiError('admin.themes.list', error, {
      gender,
      parentsContent,
      isActive,
      search,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
