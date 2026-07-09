-- Fix deal_notes: allow any authenticated user to insert
DROP POLICY "Authenticated users can insert deal notes" ON public.deal_notes;

CREATE POLICY "Authenticated users can insert deal notes"
ON public.deal_notes
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also allow updates and deletes on deal_notes
CREATE POLICY "Authenticated users can update deal notes"
ON public.deal_notes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete deal notes"
ON public.deal_notes
FOR DELETE
TO authenticated
USING (true);

-- Fix deal_contacts: allow any authenticated user to manage contacts
DROP POLICY "Users can insert deal contacts" ON public.deal_contacts;
DROP POLICY "Users can update deal contacts" ON public.deal_contacts;
DROP POLICY "Users can delete deal contacts" ON public.deal_contacts;

CREATE POLICY "Authenticated users can insert deal contacts"
ON public.deal_contacts
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update deal contacts"
ON public.deal_contacts
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete deal contacts"
ON public.deal_contacts
FOR DELETE
TO authenticated
USING (true);