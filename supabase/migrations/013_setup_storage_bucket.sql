-- Migration 013: Setup Supabase Storage bucket for invoice documents

-- Insert the invoice-documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-documents',
  'invoice-documents',
  false,
  true,
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can upload documents to invoice-documents bucket
CREATE POLICY "Authenticated users can upload invoices"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoice-documents' AND
  auth.role() = 'authenticated'
);

-- Policy: Authenticated users can view their own invoice documents
CREATE POLICY "Authenticated users can view invoices"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoice-documents' AND
  auth.role() = 'authenticated'
);

-- Policy: Authenticated users can update their invoice documents
CREATE POLICY "Authenticated users can update invoices"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'invoice-documents' AND
  auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'invoice-documents' AND
  auth.role() = 'authenticated'
);

-- Policy: Authenticated users can delete their invoice documents
CREATE POLICY "Authenticated users can delete invoices"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoice-documents' AND
  auth.role() = 'authenticated'
);
