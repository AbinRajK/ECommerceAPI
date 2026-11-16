const mongoose = require('mongoose');
const env = require('./env');

const connectDB = async () => {
  await mongoose.connect(env.mongoUri);
  console.log(`MongoDB connected (${mongoose.connection.host})`);
};

module.exports = connectDB;
