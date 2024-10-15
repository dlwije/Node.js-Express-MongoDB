// import jwt from 'jsonwebtoken';
const jwt = require('jsonwebtoken');
// import UserToken from '../models/userTokenModel';
const UserToken = require('../models/userTokenModel');

// https://dev.to/cyberwolves/jwt-authentication-with-access-tokens-refresh-tokens-in-node-js-5aa9

const generateTokens = async (user) => {
  const payload = { _id: user._id, roles: user.roles };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });

  const userToken = await UserToken.findOne({ userId: user._id });
  if (userToken) {
    await userToken.remove();
  }

  await new UserToken({ userId: user._id, token: refreshToken }).save();
  return Promise.resolve({ accessToken, refreshToken });
};

module.exports = generateTokens;
