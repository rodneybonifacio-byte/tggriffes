-- Allow users to insert their own customer role (for registration)
CREATE POLICY "Users can assign customer role to themselves" 
ON public.user_roles 
FOR INSERT 
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND role = 'customer'
);

-- Allow users to view their own role
CREATE POLICY "Users can view their own role" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());