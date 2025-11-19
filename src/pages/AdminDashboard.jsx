import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Users, FileText, DollarSign, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import Navigation from '@/components/Navigation';
import { Textarea } from '@/components/ui/textarea';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    expiredAccounts: 0,
    totalInvoices: 0,
  });
  const [subscriptionRequests, setSubscriptionRequests] = useState([]);
  const [allSubscriptions, setAllSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      // Fetch total users
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch active subscriptions
      const { count: activeCount } = await supabase
        .from('user_subscriptions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'trial']);

      // Fetch expired accounts
      const { count: expiredCount } = await supabase
        .from('user_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'expired');

      // Fetch total invoices
      const { count: invoicesCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true });

      // Fetch pending subscription requests
      const { data: requests } = await supabase
        .from('subscription_requests')
        .select(`
          *,
          profiles!subscription_requests_user_id_fkey(email),
          subscription_plans(name, price)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      // Fetch all subscriptions with user details
      const { data: subs } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          profiles!user_subscriptions_user_id_fkey(email),
          subscription_plans(name, price, billing_period)
        `)
        .order('created_at', { ascending: false });

      setStats({
        totalUsers: usersCount || 0,
        activeSubscriptions: activeCount || 0,
        expiredAccounts: expiredCount || 0,
        totalInvoices: invoicesCount || 0,
      });

      setSubscriptionRequests(requests || []);
      setAllSubscriptions(subs || []);
    } catch (error) {
      toast.error('Error fetching admin data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAction = async (requestId, action, adminNotes = '') => {
    try {
      const request = subscriptionRequests.find(r => r.id === requestId);
      
      if (action === 'approved') {
        // Update request status
        await supabase
          .from('subscription_requests')
          .update({ status: action, admin_notes: adminNotes })
          .eq('id', requestId);

        // Create or update user subscription
        const expiresAt = request.subscription_plans.billing_period === 'monthly'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        const { error } = await supabase
          .from('user_subscriptions')
          .upsert({
            user_id: request.user_id,
            plan_id: request.plan_id,
            status: 'active',
            expires_at: expiresAt,
            trial_ends_at: null,
          });

        if (error) throw error;
        toast.success('Subscription approved and activated');
      } else {
        await supabase
          .from('subscription_requests')
          .update({ status: action, admin_notes: adminNotes })
          .eq('id', requestId);
        
        toast.success('Request rejected');
      }

      fetchAdminData();
    } catch (error) {
      toast.error('Error processing request');
      console.error(error);
    }
  };

  const toggleSubscriptionStatus = async (subscription) => {
    try {
      const newStatus = subscription.status === 'active' ? 'expired' : 'active';
      
      await supabase
        .from('user_subscriptions')
        .update({ status: newStatus })
        .eq('id', subscription.id);

      toast.success(`Subscription ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      fetchAdminData();
    } catch (error) {
      toast.error('Error updating subscription');
      console.error(error);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      active: 'default',
      trial: 'secondary',
      expired: 'destructive',
      cancelled: 'outline',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage your SaaS platform</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Expired Accounts</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.expiredAccounts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInvoices}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="requests" className="space-y-4">
          <TabsList>
            <TabsTrigger value="requests">
              Pending Requests ({subscriptionRequests.length})
            </TabsTrigger>
            <TabsTrigger value="subscriptions">All Subscriptions</TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Requests</CardTitle>
                <CardDescription>Review and approve user subscription requests</CardDescription>
              </CardHeader>
              <CardContent>
                {subscriptionRequests.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No pending requests</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User Email</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptionRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">
                            {request.profiles?.email}
                          </TableCell>
                          <TableCell>{request.subscription_plans?.name}</TableCell>
                          <TableCell>₹{request.subscription_plans?.price}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {request.message || 'No message'}
                          </TableCell>
                          <TableCell>
                            {new Date(request.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleRequestAction(request.id, 'approved')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRequestAction(request.id, 'rejected')}
                              >
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions">
            <Card>
              <CardHeader>
                <CardTitle>All Subscriptions</CardTitle>
                <CardDescription>Manage user subscriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User Email</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allSubscriptions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">
                          {sub.profiles?.email}
                        </TableCell>
                        <TableCell>{sub.subscription_plans?.name}</TableCell>
                        <TableCell>{getStatusBadge(sub.status)}</TableCell>
                        <TableCell>
                          {sub.expires_at || sub.trial_ends_at
                            ? new Date(sub.expires_at || sub.trial_ends_at).toLocaleDateString()
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleSubscriptionStatus(sub)}
                          >
                            {sub.status === 'active' ? 'Deactivate' : 'Activate'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
