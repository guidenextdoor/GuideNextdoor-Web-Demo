-- Add multi-language support for user profiles

-- 1. Create reference table for languages
CREATE TABLE IF NOT EXISTS public.ref_languages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL, -- e.g., 'en', 'zh-HK', 'ja'
    name text NOT NULL, -- e.g., 'English', 'Cantonese', 'Japanese'
    native_name text, -- e.g., 'English', '廣東話', '日本語'
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 2. Create junction table for user languages
CREATE TABLE IF NOT EXISTS public.user_languages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    language_id uuid REFERENCES public.ref_languages(id) ON DELETE CASCADE,
    proficiency text DEFAULT 'fluent', -- 'native', 'fluent', 'intermediate', 'basic'
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, language_id)
);

-- 3. Enable RLS
ALTER TABLE public.ref_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_languages ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Anyone can read active languages" ON public.ref_languages;
CREATE POLICY "Anyone can read active languages" ON public.ref_languages
FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Anyone can read user languages" ON public.user_languages;
CREATE POLICY "Anyone can read user languages" ON public.user_languages
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own languages" ON public.user_languages;
CREATE POLICY "Users can manage own languages" ON public.user_languages
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Seed common languages
INSERT INTO public.ref_languages (code, name, native_name)
VALUES 
    ('en', 'English', 'English'),
    ('zh-HK', 'Cantonese', '廣東話'),
    ('zh-CN', 'Mandarin', '普通話'),
    ('ja', 'Japanese', '日本語'),
    ('ko', 'Korean', '한국어'),
    ('fr', 'French', 'Français'),
    ('es', 'Spanish', 'Español'),
    ('de', 'German', 'Deutsch'),
    ('it', 'Italian', 'Italiano'),
    ('ru', 'Russian', 'Русский'),
    ('th', 'Thai', 'ไทย'),
    ('vi', 'Vietnamese', 'Tiếng Việt')
ON CONFLICT (code) DO NOTHING;
