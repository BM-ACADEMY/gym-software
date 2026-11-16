'use strict';
// @afra/core-whatsapp: Afra's owner templates (B2B), draft customer templates per product (B2C) and the one shared sender.
const afra = require('./afraTemplates');
const { createSender, normalizePhone, maskPhone, inQuietHours } = require('./sender');
module.exports = { ...afra, afraTemplates: afra.TEMPLATES, productTemplates: require('./productTemplates').TEMPLATES, createSender, normalizePhone, maskPhone, inQuietHours };
