// Downloads a file the server streams back (PDF/CSV) through an authenticated
// axios request — a plain <a href> can't carry the Bearer token, so this
// fetches as a blob and triggers the browser save itself.
export const downloadFile = async (apiClient, url, filename) => {
  const res = await apiClient.get(url, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
};
