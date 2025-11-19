import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { FileText, Plus, Calendar, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import Navigation from '@/components/Navigation';

const UserDashboard = () => {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState({ current: 0, limit: 10 });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

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

      setUsage({
        current: usageData?.count || 0,
        limit: subData?.subscription_plans?.invoice_limit || null,
      });

      // Fetch recent invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentInvoices(invoices || []);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysRemaining = () => {
    if (!subscription) return 0;
    const expiryDate = new Date(subscription.expires_at || subscription.trial_ends_at);
    const now = new Date();
    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getUsagePercentage = () => {
    if (!usage.limit) return 0;
    return (usage.current / usage.limit) * 100;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'text-green-500';
      case 'unpaid':
        return 'text-red-500';
      case 'partial':
        return 'text-yellow-500';
      default:
        return 'text-muted-foreground';
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

  const isExpired = subscription?.status === 'expired';
  const isTrial = subscription?.status === 'trial';
  const daysRemaining = getDaysRemaining();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your account overview</p>
        </div>

        {isExpired && (
          <Card className="mb-6 border-destructive">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">Subscription Expired</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4">Your subscription has expired. Please upgrade to continue creating invoices.</p>
              <Button onClick={() => navigate('/subscription')}>Upgrade Now</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Subscription Status</CardTitle>
              <CardDescription>
                {subscription?.subscription_plans?.name || 'No active subscription'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={isExpired ? 'destructive' : isTrial ? 'secondary' : 'default'}>
                  {subscription?.status || 'Inactive'}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Days Remaining</span>
                  <span className="font-medium">{daysRemaining} days</span>
                </div>
                <Progress value={(daysRemaining / 30) * 100} className="h-2" />
              </div>

              {isTrial && (
                <div className="bg-secondary/50 rounded-lg p-4">
                  <p className="text-sm text-foreground">
                    You're on a free trial. Upgrade anytime to unlock unlimited invoices!
                  </p>
                  <Button className="mt-3" onClick={() => navigate('/subscription')}>
                    View Plans
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                className="w-full" 
                onClick={() => navigate('/')}
                disabled={isExpired}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/invoice-history')}
              >
                <FileText className="mr-2 h-4 w-4" />
                View History
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/branding')}
              >
                Settings
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Usage</CardTitle>
              <CardDescription>
                {usage.limit ? `${usage.current} of ${usage.limit} invoices used this month` : 'Unlimited invoices'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usage.limit ? (
                <>
                  <Progress value={getUsagePercentage()} className="h-3 mb-4" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {usage.limit - usage.current} remaining
                    </span>
                    {usage.current >= usage.limit && (
                      <span className="text-destructive font-medium">Limit reached</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Unlimited invoices available</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>This Month</CardTitle>
              <CardDescription>Invoices created in current period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-3xl font-bold">{usage.current}</div>
                  <p className="text-sm text-muted-foreground">Total Invoices</p>
                </div>
                <TrendingUp className="h-12 w-12 text-primary opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
            <CardDescription>Your latest generated invoices</CardDescription>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No invoices yet</p>
                <Button onClick={() => navigate('/')}>Create Your First Invoice</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{invoice.invoice_number}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(invoice.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium">₹{invoice.grand_total}</div>
                        <div className={`text-sm capitalize ${getStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserDashboard;
