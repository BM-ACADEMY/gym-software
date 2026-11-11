// Afra Wash client settings. Nothing secret lives here. Wording is limited to what is true today: this is an invite-only pilot.
export default {
  key: 'wash',
  title: 'Afra Wash',
  accent: '#0369a1',
  api: '/api/wash',
  header: 'afra-wash',                // the server refuses writes without this header (blocks cross-site form posts)
  nameField: 'businessName',
  nameLabel: 'Business name',
  meName: 'businessName',
  posBase: "/pos",          // where the shared billing screen lives under /api, or null when this product bills in its own screens
  hasPreset: false,
  hasStrings: false,       // Tamil/Hindi menu names exist in admin/strings.json (needs native review, M-06)
};
