// Opens the printable bill page for a saved bill (C-02). The page needs the sign-in header, so it is fetched
// with the app's signed-in client and shown from a local blob (nothing is loaded from outside). Then Print > Save as PDF.
// api: axios-like client. Returns true if the page opened (a blob page we made ourselves, so no noopener), false if the browser blocked the window.
export const openBillPage = async (api, id, { basePath = '/pos', size = 'A5', lang = 'en', win } = {}) => {
  const r = await api.get(`${basePath}/bills/${encodeURIComponent(id)}/print`, { params: { size, lang }, responseType: 'text', transformResponse: (d) => d });
  const url = URL.createObjectURL(new Blob([r.data], { type: 'text/html' }));
  const w = (win || window).open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return !!w;
};
