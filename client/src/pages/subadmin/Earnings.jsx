import { useEffect, useState } from 'react';
import { Banknote, Dumbbell, IndianRupee, PiggyBank, Wallet2 } from 'lucide-react';
import { Card, CardTitle, Page, PageHeader, Stat } from './ui';
import apiClient from '../../api/client';

const monthDefault = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) };
};

const Earnings = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/subadmin/earnings', { params: monthDefault() })
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load earnings'));
  }, []);

  const mine = data?.byTrainer?.[0];

  return (
    <Page>
      <PageHeader title="My earnings" description="Your revenue and PT commission for this month." />
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!data ? (
        <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Total revenue" value={`₹${data.total.toLocaleString()}`} icon={IndianRupee} />
            <Stat label="Membership" value={`₹${data.byCategory.membership.toLocaleString()}`} icon={Wallet2} />
            <Stat label="PT Sessions" value={`₹${data.byCategory.pt_session.toLocaleString()}`} icon={Dumbbell} tone="blue" />
            <Stat label="Other" value={`₹${data.byCategory.other.toLocaleString()}`} icon={PiggyBank} tone="violet" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle title="My PT commission" description={mine ? `${mine.commissionPercent}% of ₹${mine.ptRevenue.toLocaleString()} PT revenue` : 'No PT commission % set yet — ask your gym owner.'} />
              <div className="p-6 text-center">
                <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-teal-50">
                  <div><p className="text-3xl font-bold text-teal-700">₹{(mine?.commissionPayout || 0).toLocaleString()}</p><p className="text-xs text-gray-500">this month</p></div>
                </div>
              </div>
            </Card>

            <Card>
              <CardTitle title="My salary breakdown" description="Base salary plus this month's PT commission." />
              <div className="divide-y divide-gray-100 p-5">
                <div className="flex items-center justify-between py-3">
                  <span className="flex items-center gap-2 text-sm text-gray-600"><Banknote className="h-4 w-4 text-gray-400" />Base salary</span>
                  <span className="font-semibold text-gray-900">{mine?.baseSalary != null ? `₹${mine.baseSalary.toLocaleString()}` : 'Not set'}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="flex items-center gap-2 text-sm text-gray-600"><Dumbbell className="h-4 w-4 text-gray-400" />PT commission</span>
                  <span className="font-semibold text-gray-900">₹{(mine?.commissionPayout || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm font-semibold text-gray-900">Total this month</span>
                  <span className="text-lg font-bold text-teal-700">₹{((mine?.baseSalary || 0) + (mine?.commissionPayout || 0)).toLocaleString()}</span>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </Page>
  );
};
export default Earnings;
