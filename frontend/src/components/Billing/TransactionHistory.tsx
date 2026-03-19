import React from 'react';
import { Card } from '../common/Card';

interface Transaction {
  id: string;
  amount: number;
  balance_after: number;
  type: string;
  description: string | null;
  created_at: string;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
}

const typeLabels: Record<string, string> = {
  subscription_refill: 'Refill',
  purchase: 'Purchase',
  usage: 'Usage',
  refund: 'Refund',
  admin_grant: 'Granted',
  admin_revoke: 'Revoked',
  rollover: 'Rollover',
  expiry: 'Expired',
};

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ transactions }) => {
  if (transactions.length === 0) {
    return (
      <Card className="p-6 text-center text-slate-400">
        No credit transactions yet
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <table className="min-w-full divide-y divide-slate-700">
        <thead className="bg-slate-900">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Description</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Amount</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Balance</th>
          </tr>
        </thead>
        <tbody className="bg-slate-800 divide-y divide-slate-700">
          {transactions.map((txn) => (
            <tr key={txn.id}>
              <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                {new Date(txn.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-sm">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  txn.amount > 0 ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                }`}>
                  {typeLabels[txn.type] || txn.type}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-slate-200 max-w-xs truncate">
                {txn.description || '-'}
              </td>
              <td className={`px-4 py-3 text-sm text-right font-medium ${
                txn.amount > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {txn.amount > 0 ? '+' : ''}{txn.amount}
              </td>
              <td className="px-4 py-3 text-sm text-right text-slate-400">
                {txn.balance_after}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};
