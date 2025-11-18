-- Insert admin role for the specified user
-- First, we need to check if the user exists and create the admin role
-- Note: The user must sign up first before this role can be assigned

-- Create a function to assign admin role after user signs up
CREATE OR REPLACE FUNCTION public.assign_admin_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the new user's email matches the admin email
  IF NEW.email = 'nssoftwaresolutions1@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    -- Assign regular user role to all other users
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to automatically assign roles on user creation
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_admin_role();

-- Add website field to branding_settings table
ALTER TABLE public.branding_settings
ADD COLUMN IF NOT EXISTS website text;