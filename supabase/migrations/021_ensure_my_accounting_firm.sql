-- Allow users who signed up with Google (default workspace only) to register an
-- accounting firm later from the Accountant Portal, without re-signup.

-- NOTE: Parameter order matters for PostgREST schema cache resolution.
-- Keep p_ein first, then p_name, to match the RPC invocation shape.
CREATE OR REPLACE FUNCTION public.ensure_my_accounting_firm(
  p_ein TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_id UUID;
  v_name TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT f.id INTO v_id
  FROM public.firms f
  WHERE f.owner_id = v_user
  ORDER BY f.created_at ASC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  v_name := NULLIF(trim(p_name), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Firm name is required';
  END IF;

  INSERT INTO public.firms (name, owner_id, ein)
  VALUES (v_name, v_user, NULLIF(trim(p_ein), ''))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

ALTER FUNCTION public.ensure_my_accounting_firm(TEXT, TEXT) SET search_path = public;

GRANT EXECUTE ON FUNCTION public.ensure_my_accounting_firm(TEXT, TEXT) TO authenticated;
