import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useSubscription = () => {
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState({ current: 0, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [canCreateInvoice, setCanCreateInvoice] = useState(true);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch subscription
      const { data: subData } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans(name, price, billing_period, invoice_limit)
        `)
        .eq('user_id', user.id)
        .single();

      setSubscription(subData);

      // Check if subscription is active
      if (subData?.status === 'expired' || subData?.status === 'cancelled') {
        setCanCreateInvoice(false);
        setLoading(false);
        return;
      }

      // Fetch current month usage
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const { data: usageData } = await supabase
        .from('invoice_usage')
        .select('count')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .single();

      const currentUsage = usageData?.count || 0;
      const limit = subData?.subscription_plans?.invoice_limit;

      setUsage({
        current: currentUsage,
        limit: limit,
      });

      // Check if user can create invoice
      if (limit !== null && currentUsage >= limit) {
        setCanCreateInvoice(false);
      } else {
        setCanCreateInvoice(true);
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const incrementUsage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Check if usage record exists
      const { data: existing } = await supabase
        .from('invoice_usage')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .single();

      if (existing) {
        // Update existing record
        await supabase
          .from('invoice_usage')
          .update({ count: existing.count + 1 })
          .eq('id', existing.id);
      } else {
        // Create new record
        await supabase
          .from('invoice_usage')
          .insert({
            user_id: user.id,
            month: currentMonth,
            year: currentYear,
            count: 1,
          });
      }

      // Refresh subscription data
      await fetchSubscriptionData();
    } catch (error) {
      console.error('Error incrementing usage:', error);
    }
  };

  return {
    subscription,
    usage,
    loading,
    canCreateInvoice,
    incrementUsage,
    refreshSubscription: fetchSubscriptionData,
  };
};
