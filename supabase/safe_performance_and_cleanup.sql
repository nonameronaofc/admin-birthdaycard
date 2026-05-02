create index if not exists idx_theme_package_codes_package_theme
on public.theme_package_codes (package_code, theme_id);

create index if not exists idx_themes_customer_filter
on public.themes (gender, parents_content, is_active, name);

create index if not exists idx_theme_images_theme_order
on public.theme_images (theme_id, display_order);

create index if not exists idx_character_assets_customer_lookup
on public.character_assets (
  gender,
  hair_style_code,
  eyeglasses_code,
  is_active
);

create index if not exists idx_customer_style_options_visible_order
on public.customer_style_options (is_visible, sort_order);

create index if not exists idx_customer_style_options_type_code
on public.customer_style_options (option_type, option_code);

create index if not exists idx_order_codes_code
on public.order_codes (code);

create index if not exists idx_order_codes_live_session
on public.order_codes (live_session_id);

create index if not exists idx_code_attempts_updated_at
on public.code_attempts (updated_at);

delete from public.code_attempts
where updated_at < now() - interval '30 days';
