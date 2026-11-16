const mongoose = require('mongoose');
const env = require('../config/env');

/**
 * Runs `work(session)` inside a MongoDB transaction when USE_TRANSACTIONS=true.
 * Without a replica set (plain standalone mongod) `session` is null and callers
 * must rely on atomic single-document operations + compensating actions.
 */
const runInTransaction = async (work) => {
  if (!env.useTransactions) return work(null);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = { runInTransaction };
