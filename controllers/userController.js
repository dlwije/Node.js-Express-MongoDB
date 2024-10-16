const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

exports.getUsersWithNoReviews = catchAsync(async (req, res, next) => {
  const noReviewUsers = await User.aggregate([
    {
      // Perform left join from 'users' to 'reviews' collection
      $lookup: {
        from: 'reviews', // The name of the review collection
        localField: '_id', // The field from users to match
        foreignField: 'user', // The field from reviews to match
        as: 'user_reviews', // The name of the new Array field for the joined reviews
      },
    },
    {
      // Filter users who have an empty 'user_review' array (no reviews made)
      $match: {
        user_reviews: { $size: 0 },
      },
    },
    {
      // Project only the user information, excluding the joined reviews
      $project: {
        _id: 1,
        name: 1,
        email: 1,
        role: 1,
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      noReviewUsers,
    },
  });
});

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getMe = (req, res, next) => {
  // This functions should be access only after logged in
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword',
        400,
      ),
    );
  }

  // 2) Filtered out unwanted fields names that are not allowed to be update
  const filteredBody = filterObj(req.body, 'name', 'email');

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidation: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// We use Sign Up function to create users
exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined. Please use /signup route instead!',
  });
};

exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);

// Do not update passwords with this!
exports.updateUser = factory.updateOne(User);

exports.deleteUser = factory.deleteOne(User);
