CREATE POLICY "Authenticated users can update own deals"
ON public.deals
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM uploads
  WHERE uploads.id = deals.upload_id
    AND uploads.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM uploads
  WHERE uploads.id = deals.upload_id
    AND uploads.user_id = auth.uid()
));