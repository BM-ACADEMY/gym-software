import { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import { useT } from '../../i18n';

const Poster = () => {
  const { t } = useT();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.get('/admin/poster').then((r) => setData(r.data.data)).catch((e) => setError(e.response?.data?.message || 'Could not load the poster'));
  }, []);

  if (error) return <p className="p-8 text-sm text-red-600">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-gray-500">{t('Loading...')}</p>;

  return (
    <div className="p-6 sm:p-8">
      <style>{`@media print { body * { visibility: hidden; } #poster, #poster * { visibility: visible; } #poster { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; border: none; } }`}</style>
      <div className="mb-5 flex flex-wrap items-center gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('Entrance Poster')}</h1>
          <p className="mt-1 text-gray-500">{t('Print this and stick it at your entrance. Members scan it, sign in and tap Check in.')}</p>
        </div>
        <button onClick={() => window.print()} className="ml-auto rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">{t('Print poster')}</button>
      </div>
      <div id="poster" className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <h2 className="text-4xl font-extrabold text-gray-900">{data.gymName}</h2>
        <p className="mt-3 text-2xl font-semibold text-teal-700">{t('Scan to check in')}</p>
        <img src={data.qr} alt="QR code" className="mx-auto mt-6 h-80 w-80" />
        <ol className="mx-auto mt-6 max-w-sm space-y-1 text-left text-lg text-gray-800">
          <li>1. {t('Scan the code with your phone camera')}</li>
          <li>2. {t('Sign in with your phone number')}</li>
          <li>3. {t('Tap Check in')}</li>
        </ol>
        <p className="mt-6 break-all text-xs text-gray-500">{data.url}</p>
      </div>
    </div>
  );
};

export default Poster;
