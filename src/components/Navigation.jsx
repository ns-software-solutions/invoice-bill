import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, Settings, History, LayoutDashboard, Shield, FileText, CreditCard } from 'lucide-react';

const Navigation = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRole(session.user.id);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminRole = async (userId) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();
    
    setIsAdmin(!!data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (!user) return null;

  return (
    <div className="bg-card border-b border-border p-4 shadow-sm">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')}
        >
          <div className="bg-primary p-2 rounded-lg">
            <FileText className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Invoice SaaS</h1>
            {isAdmin && <p className="text-xs text-muted-foreground">Admin Portal</p>}
          </div>
        </div>
        
        <div className="flex gap-2">
          {isAdmin ? (
            <>
              <Button
                variant="ghost"
                onClick={() => navigate('/admin')}
              >
                <Shield className="mr-2 h-4 w-4" />
                Admin Panel
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate('/dashboard')}
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                User View
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => navigate('/dashboard')}
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
              >
                <FileText className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate('/subscription')}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Subscription
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate('/invoice-history')}
              >
                <History className="mr-2 h-4 w-4" />
                History
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate('/branding')}
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Navigation;
