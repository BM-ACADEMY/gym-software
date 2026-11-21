// Connects the whole suite to a dedicated `gymdesk_test` database on the same
// cluster the app already uses — never the real `gymdesk` database. No
// mongodb-memory-server binary download needed, and it's dropped after every run.
require('dotenv').config();
const mongoose = require('mongoose');

const connect = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_TEST_URI);
  }
  // The previous suite dropped the database, so unique indexes (idempotency,
  // one-per-day guards) are rebuilt in the background. Wait for them so a
  // test can't run before the constraint it relies on exists.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
};

const clearDatabase = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};

const closeDatabase = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
};

module.exports = { connect, clearDatabase, closeDatabase };
