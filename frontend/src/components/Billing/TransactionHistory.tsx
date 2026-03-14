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
      <Card className="p-6 text-center text-gray-500">
        No credit transactions yet
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {transactions.map((txn) => (
            <tr key={txn.id}>
              <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                {new Date(txn.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-sm">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  txn.amount > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {typeLabels[txn.type] || txn.type}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                {txn.description || '-'}
              </td>
              <td className={`px-4 py-3 text-sm text-right font-medium ${
                txn.amount > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {txn.amount > 0 ? '+' : ''}{txn.amount}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-500">
                {txn.balance_after}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};
