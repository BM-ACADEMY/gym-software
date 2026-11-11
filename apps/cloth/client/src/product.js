// Afra Cloth client settings. Nothing secret lives here. Wording is limited to what is true today: this is an invite-only pilot.
export default {
  key: 'cloth',
  title: 'Afra Cloth',
  accent: '#6d28d9',
  api: '/api/cloth',
  header: 'afra-cloth',                // the server refuses writes without this header (blocks cross-site form posts)
  nameField: 'shopName',
  nameLabel: 'Shop name',
  meName: 'shopName',
  posBase: "/pos",          // where the shared billing screen lives under /api, or null when this product bills in its own screens
  hasPreset: false,
  hasStrings: false,       // Tamil/Hindi menu names exist in admin/strings.json (needs native review, M-06)
};
