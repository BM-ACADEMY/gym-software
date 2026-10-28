module.exports = {
  ...require('./candidate'), ...require('./parse'), ...require('./rank'),
  pipeline: require('./pipeline'), autopilot: require('./autopilot'), ...require('./offerDrop'), ...require('./fees'), consent: require('./consent'),
};
