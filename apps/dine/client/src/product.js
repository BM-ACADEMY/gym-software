// Afra Dine client settings. Nothing secret lives here. Wording is limited to what is true today: this is an invite-only pilot.
export default {
  key: 'dine',
  title: 'Afra Dine',
  accent: '#c2410c',
  api: '/api/dine',
  header: 'afra-dine',                // the server refuses writes without this header (blocks cross-site form posts)
  nameField: 'venueName',
  nameLabel: 'Restaurant or cafe name',
  meName: 'venueName',
  posBase: null,          // where the shared billing screen lives under /api, or null when this product bills in its own screens
  hasPreset: false,
  hasStrings: false,       // Tamil/Hindi menu names exist in admin/strings.json (needs native review, M-06)
};
