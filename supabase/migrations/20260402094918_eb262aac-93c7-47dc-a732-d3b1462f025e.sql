DROP POLICY "Authenticated users can update own deals" ON public.deals;

CREATE POLICY "Authenticated users can update all deals"
ON public.deals
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);