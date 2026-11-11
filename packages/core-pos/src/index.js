module.exports = {
  bill: require('./bill'), loyalty: require('./loyalty'), stock: require('./stock'), returns: require('./returns'), receipt: require('./receipt'), billHtml: require('./billHtml'),
  models: require('./models'), discountPolicy: require('./discountPolicy'), makeDiscountHook: require('./discountHook').makeDiscountHook, createPosRouter: require('./routes'), csvImport: require('./csvImport'),
};
