const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const req = require('express/lib/request');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const refreshJWTToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    secure: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  const refreshToken = refreshJWTToken(user._id);

  // Remove the password from the output
  user.password = undefined;
  res.status(statusCode).json({
    status: 'success',
    token,
    refreshToken,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    role: req.body.role,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
  });

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }
  // 2) Check if user exist and password is correct
  // Below user variable is a user document
  const user = await User.findOne({ email }).select('+password');

  // We don't assign correct password to a variable because if we didn't find user but if we tring to take
  // password it gives error. So, if we check it in inside if it won't go to second statement if first is false
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 3) If everything is ok send token to client
  createSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401),
    );
  }

  // 2) Verification token
  // We use 'promisify' to take the response as a promise
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exist
  const freshUser = await User.findById(decoded.id);
  if (!freshUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist!',
        401,
      ),
    );
  }

  // 4) Check if user changed the password after token issued
  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401),
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = freshUser;
  next();
});

// Only for rendered pages, no errors!
exports.isLoggedIn = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it there
  if (req.cookies.jwt) {
    // 2) Verification token
    // We use 'promisify' to take the response as a promise
    const decoded = await promisify(jwt.verify)(req.cookies.jwt, process.env.JWT_SECRET);

    // 3) Check if user still exist
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next();
    }

    // 4) Check if user changed the password after token issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next();
    }

    // There is a Logged-in user
    res.locals.user = currentUser;
    return next();
  }
  next();
});

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    // Here will get a roles array by doing the above parameter with spread operator
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }

    next();
  };

exports.refreshToken = catchAsync(async (req, res, next) => {});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user email based on Posted email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with this email address.', 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password and password confirm to: ${resetURL}.
  \nIf you didn't forgot your password, Please ignore this email!`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (Valid for 10 minutes)',
      message,
    });

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    console.log(err);
    return next(
      new AppError('There was an error sending the email. Try again later!'),
      500,
    );
  }
  // next();
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('The token is invalid or has expired.', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 3) Update changePasswordAt property for the user

  // 4) Log the user in, send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  console.log(req.user, req.body);
  const user = await User.findById(req.user.id).select('+password');

  if (!user) {
    return next(new AppError('There is no user with this ID.', 404));
  }
  // 2) Check if POSTed current passwword is correct
  if (
    !user ||
    !(await user.correctPassword(req.body.currentPassword, user.password))
  ) {
    return next(
      new AppError(
        'Incorrect current password! Please enter it correctly',
        401,
      ),
    );
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  // user.passwordChangedAt = Date.now();
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended! because, this won't trigger Pre and Post QUERY middlewares

  // 4) Log user in, send JWT
  createSendToken(user, 200, res);
});
