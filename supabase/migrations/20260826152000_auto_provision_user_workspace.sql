-- Automatically provision the first application workspace for every new Supabase user.
-- We keep one shared schema and isolate each user's data by business_id + RLS;
-- we do not create a physical database/table per user.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS setup_complete boolean NOT NULL DEFAULT false;

-- Existing businesses were already configured through the old onboarding flow.
UPDATE public.businesses
SET setup_complete = true
WHERE setup_complete = false;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_full_name text;
  v_business_name text;
  v_language text;
BEGIN
  v_full_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '');
  v_business_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'business_name'), '');
  v_language := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'language'), ''), 'en');

  -- Profile is created automatically for every auth user, including Google OAuth users.
  INSERT INTO public.profiles (id, full_name, phone, preferred_language)
  VALUES (NEW.id, v_full_name, NEW.phone, v_language)
  ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        preferred_language = COALESCE(EXCLUDED.preferred_language, public.profiles.preferred_language);

  -- Provision exactly one initial business/workspace for the new user.
  -- The UI onboarding step will finish setup and rename this workspace.
  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b WHERE b.owner_id = NEW.id
  ) THEN
    INSERT INTO public.businesses (
      owner_id,
      name,
      business_type,
      currency,
      language,
      inventory_enabled,
      setup_complete
    )
    VALUES (
      NEW.id,
      COALESCE(v_business_name, CASE WHEN v_full_name IS NOT NULL THEN v_full_name || '''s Business' ELSE 'My Business' END),
      'other',
      'INR',
      v_language,
      true,
      false
    );
  END IF;

  RETURN NEW;
END;
$$;

-- The original trigger already exists; replace its function so the same trigger
-- now provisions both the profile and the initial business workspace.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
