// C-05: one tenant has one businessType; menus, presets and report packs come from a per-product config.
// A product registers its presets once. Everything here is data plus small checks, no database.
// Assumption: report pack and menu keys follow the scope files; names are working names until the screens exist.
// Not set here on purpose (Tier 3, need a CA): GST rate and SAC code defaults. The preset leaves gst as null.

const REGISTRY = {};

const registerProduct = (product, config) => {
  if (!product || !config || !config.presets || !Object.keys(config.presets).length) throw new Error(`Product ${product} needs at least one preset`);
  if (!config.presets[config.defaultPreset]) throw new Error(`Product ${product} defaultPreset is not one of its presets`);
  for (const [k, p] of Object.entries(config.presets)) {
    if (!p.label || !Array.isArray(p.menu) || !Array.isArray(p.reportPacks)) throw new Error(`Preset ${product}/${k} needs label, menu[] and reportPacks[]`);
  }
  REGISTRY[product] = config;
};

const businessTypesFor = (product) => (REGISTRY[product] ? Object.keys(REGISTRY[product].presets) : []);

// Returns the preset for a tenant. An unknown or missing type falls back to the product default (never throws on bad stored data).
const resolvePreset = (product, businessType) => {
  const cfg = REGISTRY[product];
  if (!cfg) return null;
  const key = cfg.presets[businessType] ? businessType : cfg.defaultPreset;
  return { product, businessType: key, usedDefault: key !== businessType, ...cfg.presets[key] };
};

// Sign-up check: only a listed type is accepted.
const isValidBusinessType = (product, businessType) => businessTypesFor(product).includes(businessType);

const BASE_MENU = ['dashboard', 'customers', 'billing', 'reports', 'staff', 'settings', 'help'];

registerProduct('gym', { defaultPreset: 'gym', presets: { gym: { label: 'Gym', menu: ['dashboard', 'members', 'attendance', 'payments', 'reports', 'settings', 'help'], reportPacks: ['collections', 'renewals', 'attendance'], gst: null } } });

registerProduct('salon', {
  defaultPreset: 'salon',
  presets: {
    salon: { label: 'Salon (hair, skin, nails)', menu: [...BASE_MENU, 'appointments', 'services', 'packages'], reportPacks: ['daily-sales', 'staff-commission', 'win-back'], defaultMode: 'appointment', gst: null },
    spa: { label: 'Spa', menu: [...BASE_MENU, 'appointments', 'services', 'packages', 'rooms'], reportPacks: ['daily-sales', 'staff-commission', 'win-back', 'room-use'], defaultMode: 'appointment', gst: null },
    barber: { label: 'Barber / Grooming', menu: [...BASE_MENU, 'queue', 'services'], reportPacks: ['daily-sales', 'staff-commission', 'win-back'], defaultMode: 'queue', gst: null },
  },
});

registerProduct('mart', { defaultPreset: 'kirana', presets: { kirana: { label: 'Mini mart / kirana', menu: [...BASE_MENU, 'items', 'stock', 'udhaar', 'suppliers'], reportPacks: ['daily-sales', 'low-stock', 'expiry', 'udhaar-due'], gst: null } } });

registerProduct('dine', {
  defaultPreset: 'restaurant',
  presets: {
    restaurant: { label: 'Restaurant', menu: [...BASE_MENU, 'tables', 'kitchen', 'menu-items', 'recipes', 'stock'], reportPacks: ['daily-sales', 'food-cost', 'best-worst-dish'], pubMode: false, gst: null },
    cafe: { label: 'Cafe', menu: [...BASE_MENU, 'tables', 'kitchen', 'menu-items', 'recipes', 'stock'], reportPacks: ['daily-sales', 'food-cost', 'best-worst-dish'], pubMode: false, gst: null },
    pub: { label: 'Pub / Bar', menu: [...BASE_MENU, 'tables', 'bar', 'kitchen', 'menu-items', 'recipes', 'bottle-stock'], reportPacks: ['daily-sales', 'bottle-variance', 'bartender-sales'], pubMode: true, gst: null },
  },
});

registerProduct('cloth', { defaultPreset: 'garment', presets: { garment: { label: 'Garment retail', menu: [...BASE_MENU, 'items', 'stock', 'suppliers'], reportPacks: ['daily-sales', 'stock-ageing', 'supplier-dues'], gst: null }, textile: { label: 'Textile (cloth by the metre)', menu: [...BASE_MENU, 'items', 'stock', 'suppliers'], reportPacks: ['daily-sales', 'stock-ageing', 'supplier-dues'], gst: null } } });

registerProduct('wash', { defaultPreset: 'carwash', presets: { carwash: { label: 'Car wash', menu: [...BASE_MENU, 'job-cards', 'packages'], reportPacks: ['daily-sales', 'wash-due'], gst: null }, detailing: { label: 'Detailing', menu: [...BASE_MENU, 'job-cards', 'packages'], reportPacks: ['daily-sales', 'wash-due'], gst: null } } });

registerProduct('hire', { defaultPreset: 'agency', presets: { agency: { label: 'Recruitment agency', menu: ['today', 'pipeline', 'candidates', 'jobs', 'clients', 'fees', 'reports', 'settings', 'help'], reportPacks: ['weekly-report', 'fees'], gst: null } } });

module.exports = { registerProduct, businessTypesFor, resolvePreset, isValidBusinessType, REGISTRY };
