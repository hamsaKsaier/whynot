import React from 'react';
import { Card } from '../common/Card';
import { FiDownload, FiExternalLink } from 'react-icons/fi';

interface Invoice {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  invoice_url: string | null;
  invoice_pdf: string | null;
  created_at: string;
}

interface InvoiceListProps {
  invoices: Invoice[];
}

export const InvoiceList: React.FC<InvoiceListProps> = ({ invoices }) => {
  if (invoices.length === 0) {
    return (
      <Card className="p-6 text-center text-gray-500">
        No invoices yet
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                {new Date(inv.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {inv.period_start && inv.period_end
                  ? `${new Date(inv.period_start).toLocaleDateString()} - ${new Date(inv.period_end).toLocaleDateString()}`
                  : '-'}
              </td>
              <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                ${(inv.amount_cents / 100).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-sm">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  inv.status === 'paid' ? 'bg-green-100 text-green-800'
                  : inv.status === 'open' ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
                }`}>
                  {inv.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-right space-x-2">
                {inv.invoice_url && (
                  <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center text-primary-600 hover:text-primary-800">
                    <FiExternalLink className="h-4 w-4" />
                  </a>
                )}
                {inv.invoice_pdf && (
                  <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center text-primary-600 hover:text-primary-800">
                    <FiDownload className="h-4 w-4" />
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};
