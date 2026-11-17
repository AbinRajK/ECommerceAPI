const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

// Jest gives every test file its own module registry, so this state is per-file.
let replSet;
let app;

/**
 * Boots an in-memory MongoDB replica set (so transactions are exercised, like
 * in production/docker), connects mongoose and loads the app. Call in beforeAll.
 */
async function startTestEnv() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  // Must be required after mongoose is connected.
  app = require('../../src/app');
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

/** Call in afterAll. Safe to call even if startTestEnv failed part-way. */
async function stopTestEnv() {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
}

const api = () => request(app);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { startTestEnv, stopTestEnv, api, auth };
