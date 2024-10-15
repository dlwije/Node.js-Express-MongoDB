const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const UserToken = require('../models/userTokenModel');
const AppError = require('./appError');
const catchAsync = require('./catchAsync');

// https://dev.to/cyberwolves/jwt-authentication-with-access-tokens-refresh-tokens-in-node-js-5aa9

const verifyRefreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;
  const refreshSecretKey = process.env.JWT_REFRESH_SECRET;

  const userToken = await UserToken.findOne({ token: refreshToken });

  if (!userToken) {
    return next(new AppError('Invalid refresh token', 400));
  }

  const decoded = await promisify(jwt.verify)(refreshToken, refreshSecretKey);

  // Below how it was in tutorial
  /*return new Promise((resolve, reject) => {
    UserToken.findOne({ token: refreshToken }, (err, doc) => {
      if (!doc)
        return reject({ error: true, message: "Invalid refresh token" });

      jwt.verify(refreshToken, privateKey, (err, tokenDetails) => {
        if (err)
          return reject({ error: true, message: "Invalid refresh token" });
        resolve({
          tokenDetails,
          error: false,
          message: "Valid refresh token",
        });
      });
    });
  });*/
});

module.exports = verifyRefreshToken;