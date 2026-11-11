// Afra Mart client settings. Nothing secret lives here. Wording is limited to what is true today: this is an invite-only pilot.
export default {
  key: 'mart',
  title: 'Afra Mart',
  accent: '#15803d',
  api: '/api/mart',
  header: 'afra-mart',                // the server refuses writes without this header (blocks cross-site form posts)
  nameField: 'shopName',
  nameLabel: 'Shop name',
  meName: 'shopName',
  posBase: "/mart/pos",          // where the shared billing screen lives under /api, or null when this product bills in its own screens
  hasPreset: false,
  hasStrings: true,       // Tamil/Hindi menu names exist in admin/strings.json (needs native review, M-06)
};
