module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  // The whole suite shares one remote gymdesk_test database — running files
  // in parallel workers would let them stomp on each other's data.
  maxWorkers: 1,
};
