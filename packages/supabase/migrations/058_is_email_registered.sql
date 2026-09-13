-- Used by the check-email edge function to detect duplicate accounts before signUp()
CREATE OR REPLACE FUNCTION public.is_email_registered(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(check_email));
$$;

GRANT EXECUTE ON FUNCTION public.is_email_registered TO service_role;
