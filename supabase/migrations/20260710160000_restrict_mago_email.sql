-- Restrict accounts to @mago.studio email addresses. Enforced at the auth layer
-- so it applies to every signup path (password, OAuth, invite) regardless of the
-- client. Non-Mago inserts into auth.users are rejected.

CREATE OR REPLACE FUNCTION public.enforce_mago_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR lower(NEW.email) NOT LIKE '%@mago.studio' THEN
    RAISE EXCEPTION 'Only mago.studio email addresses are allowed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_mago_email_before_insert ON auth.users;
CREATE TRIGGER enforce_mago_email_before_insert
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_mago_email();
