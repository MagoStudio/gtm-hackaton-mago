
CREATE OR REPLACE FUNCTION public.update_deal_interaction_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  target_deal_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_deal_id := OLD.deal_id;
  ELSE
    target_deal_id := NEW.deal_id;
  END IF;

  UPDATE public.deals
  SET
    nb_interactions = (
      SELECT COUNT(*)::integer
      FROM public.deal_interactions
      WHERE deal_id = target_deal_id
    ),
    last_interaction = (
      SELECT MAX(occurred_at)
      FROM public.deal_interactions
      WHERE deal_id = target_deal_id
    )
  WHERE id = target_deal_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_deal_interaction_stats
AFTER INSERT OR UPDATE OR DELETE ON public.deal_interactions
FOR EACH ROW
EXECUTE FUNCTION public.update_deal_interaction_stats();
