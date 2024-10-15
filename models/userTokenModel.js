// import mongoose from 'mongoose';
const mongoose = require('mongoose');

// https://dev.to/cyberwolves/jwt-authentication-with-access-tokens-refresh-tokens-in-node-js-5aa9

const userTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 30 * 86400,
  },
});

const UserToken = mongoose.model('UserToken', userTokenSchema);

module.exports = UserToken;
// export default UserToken;
