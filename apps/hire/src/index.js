module.exports = {
  ...require('./candidate'), ...require('./parse'), ...require('./rank'),
  pipeline: require('./pipeline'), ...require('./offerDrop'), ...require('./fees'), consent: require('./consent'),
};
