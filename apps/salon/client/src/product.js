// Groom client settings. Nothing secret lives here. Wording is limited to what is true today: this is an invite-only pilot.
export default {
  key: 'salon',
  title: 'Groom',
  accent: '#be185d',
  api: '/api/salon',
  header: 'afra-groom',                // the server refuses writes without this header (blocks cross-site form posts)
  nameField: 'businessName',
  nameLabel: 'Business name',
  meName: 'businessName',
  posBase: null,          // where the shared billing screen lives under /api, or null when this product bills in its own screens
  hasPreset: true,
  hasStrings: false,       // Tamil/Hindi menu names exist in admin/strings.json (needs native review, M-06)
};
