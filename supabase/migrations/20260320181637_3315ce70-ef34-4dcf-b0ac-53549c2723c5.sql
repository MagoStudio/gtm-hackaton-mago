
-- Create uploads table to track weekly CSV uploads
CREATE TABLE public.uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_label TEXT NOT NULL,
  upload_date DATE NOT NULL DEFAULT CURRENT_DATE,
  file_name TEXT,
  record_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all uploads"
  ON public.uploads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert uploads"
  ON public.uploads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Create deals table to store parsed CSV rows
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  external_id TEXT,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  job_title TEXT,
  status TEXT NOT NULL DEFAULT '',
  deal_value NUMERIC DEFAULT 0,
  actual_acv NUMERIC DEFAULT 0,
  company_size TEXT,
  company_vertical TEXT,
  prospect_owner TEXT,
  country TEXT,
  next_steps TEXT,
  closed_date DATE,
  lost_reason TEXT,
  last_interaction TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all deals"
  ON public.deals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert deals"
  ON public.deals FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.uploads WHERE uploads.id = upload_id AND uploads.user_id = auth.uid())
  );

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes for fast queries
CREATE INDEX idx_deals_upload_id ON public.deals(upload_id);
CREATE INDEX idx_deals_status ON public.deals(status);
CREATE INDEX idx_uploads_week ON public.uploads(week_label);
