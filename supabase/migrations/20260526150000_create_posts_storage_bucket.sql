-- Create the storage bucket for posts
INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO NOTHING;

-- Set up access policies for the 'posts' bucket

-- 1. Allow public read access to all post media
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'posts' );

-- 2. Allow authenticated users (instructors) to upload media to their own folder
-- The path structure is folder/{user_id}/{filename}
CREATE POLICY "Instructor Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'posts' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow instructors to delete their own media
CREATE POLICY "Instructor Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'posts' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
