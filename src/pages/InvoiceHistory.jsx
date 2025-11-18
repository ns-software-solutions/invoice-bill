import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Eye, Trash2, Mail } from 'lucide-react';
import { formatCurrency } from '@/utils/formatCurrency';

const InvoiceHistory = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setInvoices(data || []);
    } catch (error) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Invoice deleted successfully');
      loadInvoices();
    } catch (error) {
      toast.error('Failed to delete invoice');
    }
  };

  const handleSendEmail = (invoice) => {
    const billTo = invoice.bill_to;
    const subject = `Invoice ${invoice.invoice_number}`;
    const body = `Dear ${billTo.name},\n\nPlease find attached your invoice ${invoice.invoice_number} for ${formatCurrency(invoice.grand_total, 'USD')}.\n\nThank you for your business!\n\nBest regards`;
    
    window.location.href = `mailto:${billTo.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="bg-card rounded-lg shadow-lg border border-border p-8">
          <h1 className="text-3xl font-bold text-foreground mb-6">Invoice History</h1>

          {invoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No invoices found. Create your first invoice to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-foreground">Invoice #</th>
                    <th className="text-left py-3 px-4 text-foreground">Date</th>
                    <th className="text-left py-3 px-4 text-foreground">Bill To</th>
                    <th className="text-right py-3 px-4 text-foreground">Amount</th>
                    <th className="text-right py-3 px-4 text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-border hover:bg-secondary/50">
                      <td className="py-3 px-4 text-foreground">{invoice.invoice_number}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(invoice.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-foreground">
                        {invoice.bill_to?.name || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right text-foreground">
                        {formatCurrency(invoice.grand_total, 'USD')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSendEmail(invoice)}
                            title="Send Email"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(invoice.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceHistory;
