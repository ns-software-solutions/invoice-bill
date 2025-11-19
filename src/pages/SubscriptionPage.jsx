import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Check, Sparkles, Crown, Zap } from 'lucide-react';
import Navigation from '@/components/Navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SubscriptionPage = () => {
  const [plans, setPlans] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [showRequestDialog, setShowRequestDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Fetch available plans
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      setPlans(plansData || []);

      // Fetch current subscription
      const { data: subData } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans(*)
        `)
        .eq('user_id', user.id)
        .single();

      setCurrentSubscription(subData);
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (plan) => {
    if (plan.slug === 'trial') {
      toast.error('Trial plan is automatically assigned to new users');
      return;
    }

    setSelectedPlan(plan);
    setShowRequestDialog(true);
  };

  const submitSubscriptionRequest = async () => {
    if (!requestMessage.trim()) {
      toast.error('Please add a message for the admin');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('subscription_requests')
        .insert({
          user_id: user.id,
          plan_id: selectedPlan.id,
          message: requestMessage,
          status: 'pending',
        });

      if (error) throw error;

      toast.success('Subscription request submitted! Admin will review it soon.');
      setShowRequestDialog(false);
      setRequestMessage('');
      setSelectedPlan(null);
    } catch (error) {
      toast.error('Error submitting request');
      console.error(error);
    }
  };

  const getPlanIcon = (slug) => {
    switch (slug) {
      case 'trial':
        return <Sparkles className="h-6 w-6" />;
      case 'monthly':
        return <Zap className="h-6 w-6" />;
      case 'yearly':
        return <Crown className="h-6 w-6" />;
      default:
        return <Check className="h-6 w-6" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto p-8 flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  const isCurrentPlan = (planId) => {
    return currentSubscription?.plan_id === planId;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Choose Your Plan</h1>
          <p className="text-muted-foreground text-lg">
            Select the perfect plan for your business needs
          </p>
        </div>

        {currentSubscription && (
          <Card className="mb-8 bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle>Current Subscription</CardTitle>
              <CardDescription>
                You're currently on the {currentSubscription.subscription_plans?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    ₹{currentSubscription.subscription_plans?.price}
                  </div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {currentSubscription.subscription_plans?.billing_period}
                  </div>
                </div>
                <Badge variant={currentSubscription.status === 'active' ? 'default' : 'secondary'}>
                  {currentSubscription.status}
                </Badge>
              </div>
              {currentSubscription.expires_at && (
                <p className="text-sm text-muted-foreground mt-4">
                  Expires: {new Date(currentSubscription.expires_at).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const features = Array.isArray(plan.features) ? plan.features : [];
            const isCurrent = isCurrentPlan(plan.id);

            return (
              <Card
                key={plan.id}
                className={`relative ${
                  plan.slug === 'yearly' ? 'border-primary shadow-lg' : ''
                } ${isCurrent ? 'bg-accent/50' : ''}`}
              >
                {plan.slug === 'yearly' && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                  </div>
                )}

                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      {getPlanIcon(plan.slug)}
                    </div>
                    {isCurrent && <Badge variant="secondary">Current Plan</Badge>}
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>
                    <div className="text-3xl font-bold text-foreground mt-4">
                      ₹{plan.price}
                      <span className="text-base font-normal text-muted-foreground">
                        /{plan.billing_period === 'yearly' ? 'year' : plan.billing_period}
                      </span>
                    </div>
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  {isCurrent ? (
                    <Button className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={plan.slug === 'yearly' ? 'default' : 'outline'}
                      onClick={() => handlePlanSelect(plan)}
                    >
                      {plan.slug === 'trial' ? 'Already Active' : 'Request Plan'}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Payment gateway integration coming soon. For now, submit a request and admin will activate your subscription.
          </p>
        </div>
      </div>

      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request {selectedPlan?.name}</DialogTitle>
            <DialogDescription>
              Submit your subscription request. Admin will review and activate it manually.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm font-medium mb-2">Plan Details:</p>
              <div className="bg-accent/50 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span>Plan:</span>
                  <span className="font-medium">{selectedPlan?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Price:</span>
                  <span className="font-medium">₹{selectedPlan?.price}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Message to Admin <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder="Provide payment details or any additional information..."
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitSubscriptionRequest}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubscriptionPage;
