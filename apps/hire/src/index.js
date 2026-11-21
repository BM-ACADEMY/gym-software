module.exports = {
  ...require('./candidate'), ...require('./parse'), ...require('./rank'),
  pipeline: require('./pipeline'), autopilot: require('./autopilot'), ...require('./offerDrop'), ...require('./fees'), consent: require('./consent'),
  plans: require('./plans'), resumeService: require('./resumeService'), makeModels: require('./models'),
  ...require('./routes'),
};
