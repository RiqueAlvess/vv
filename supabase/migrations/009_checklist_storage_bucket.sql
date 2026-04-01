-- Create the storage bucket for checklist evidences
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'checklist-vivamente',
  'checklist-vivamente',
  true,
  52428800,  -- 50MB limit
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read checklist evidences"
ON storage.objects FOR SELECT
USING (bucket_id = 'checklist-vivamente');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated upload checklist evidences"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'checklist-vivamente');

-- Allow authenticated users to delete their own files
CREATE POLICY "Authenticated delete checklist evidences"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'checklist-vivamente');
