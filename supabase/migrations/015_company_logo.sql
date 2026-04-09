-- Migration: add logo_url to companies + create company-logos storage bucket
ALTER TABLE core.companies ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Create storage bucket for company logos (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read logo files (public bucket)
CREATE POLICY "Public logo read" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-logos');

-- Allow service role to manage logo files
CREATE POLICY "Service role logo write" ON storage.objects
  FOR ALL USING (bucket_id = 'company-logos');
