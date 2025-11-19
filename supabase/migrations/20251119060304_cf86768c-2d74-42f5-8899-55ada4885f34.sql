-- Create subscription plans table
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'yearly', 'trial')),
  invoice_limit INTEGER, -- NULL means unlimited
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user subscriptions table
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled', 'trial')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create subscription requests table (for manual approval)
CREATE TABLE public.subscription_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create invoice usage tracking table
CREATE TABLE public.invoice_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, month, year)
);

-- Add status field to invoices table
ALTER TABLE public.invoices 
ADD COLUMN status TEXT DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid', 'partial'));

-- Enable RLS on new tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans
CREATE POLICY "Everyone can view active plans"
ON public.subscription_plans FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage plans"
ON public.subscription_plans FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view their own subscription"
ON public.user_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
ON public.user_subscriptions FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage subscriptions"
ON public.user_subscriptions FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for subscription_requests
CREATE POLICY "Users can view their own requests"
ON public.subscription_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create requests"
ON public.subscription_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all requests"
ON public.subscription_requests FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update requests"
ON public.subscription_requests FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for invoice_usage
CREATE POLICY "Users can view their own usage"
ON public.invoice_usage FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage usage"
ON public.invoice_usage FOR ALL
USING (true);

CREATE POLICY "Admins can view all usage"
ON public.invoice_usage FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create triggers for updated_at
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscription_requests_updated_at
BEFORE UPDATE ON public.subscription_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoice_usage_updated_at
BEFORE UPDATE ON public.invoice_usage
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, slug, price, billing_period, invoice_limit, features) VALUES
('Free Trial', 'trial', 0, 'trial', 10, '["10 invoices", "7 days trial", "Basic templates", "PDF export"]'::jsonb),
('Monthly Plan', 'monthly', 999, 'monthly', NULL, '["Unlimited invoices", "All templates", "PDF export", "Priority support", "Custom branding"]'::jsonb),
('Yearly Plan', 'yearly', 9999, 'yearly', NULL, '["Unlimited invoices", "All templates", "PDF export", "Priority support", "Custom branding", "20% savings"]'::jsonb);

-- Function to check subscription status
CREATE OR REPLACE FUNCTION public.check_subscription_status(user_id_param UUID)
RETURNS TABLE(
  has_active_subscription BOOLEAN,
  plan_name TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_trial BOOLEAN,
  days_remaining INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_record RECORD;
BEGIN
  SELECT 
    us.status,
    us.expires_at,
    us.trial_ends_at,
    sp.name
  INTO sub_record
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = user_id_param;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TIMESTAMP WITH TIME ZONE, false, 0;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    (sub_record.status = 'active' OR sub_record.status = 'trial'),
    sub_record.name,
    COALESCE(sub_record.expires_at, sub_record.trial_ends_at),
    (sub_record.status = 'trial'),
    GREATEST(0, EXTRACT(DAY FROM (COALESCE(sub_record.expires_at, sub_record.trial_ends_at) - now()))::INTEGER);
END;
$$;

-- Function to check invoice limits
CREATE OR REPLACE FUNCTION public.can_create_invoice(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_usage INTEGER;
  plan_limit INTEGER;
  current_month INTEGER;
  current_year INTEGER;
BEGIN
  current_month := EXTRACT(MONTH FROM now());
  current_year := EXTRACT(YEAR FROM now());
  
  -- Get current usage
  SELECT COALESCE(count, 0) INTO current_usage
  FROM invoice_usage
  WHERE user_id = user_id_param 
    AND month = current_month 
    AND year = current_year;
  
  -- Get plan limit
  SELECT sp.invoice_limit INTO plan_limit
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = user_id_param
    AND (us.status = 'active' OR us.status = 'trial');
  
  -- NULL limit means unlimited
  IF plan_limit IS NULL THEN
    RETURN true;
  END IF;
  
  RETURN current_usage < plan_limit;
END;
$$;

-- Trigger to auto-create trial subscription for new users
CREATE OR REPLACE FUNCTION public.create_trial_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trial_plan_id UUID;
BEGIN
  -- Get trial plan ID
  SELECT id INTO trial_plan_id
  FROM subscription_plans
  WHERE slug = 'trial'
  LIMIT 1;
  
  -- Create trial subscription for new user (except admin)
  IF NEW.email != 'nssoftwaresolutions1@gmail.com' THEN
    INSERT INTO user_subscriptions (user_id, plan_id, status, trial_ends_at)
    VALUES (NEW.id, trial_plan_id, 'trial', now() + INTERVAL '7 days');
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_created_trial
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.create_trial_subscription();