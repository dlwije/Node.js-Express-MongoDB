const Review = require('../models/reviewModel');
const factory = require('./handlerFactory');
const catchAsync = require('../utils/catchAsync');

exports.setTourUserIds = (req, res, next) => {
  // console.log(req.body, req.params);
  // Allow nested routes
  if (!req.body.tour) req.body.tour = req.params.tourId;
  if (!req.body.user) req.body.user = req.user.id; // Here we take user id from authenticate route
  next();
};

exports.getAllReviews = factory.getAll(Review);
exports.getReview = factory.getOne(Review);
exports.createReview = factory.createOne(Review);
exports.updateReview = factory.updateOne(Review);
exports.deleteReview = factory.deleteOne(Review);

// Dev by me to just find the duplicate reviews with same tour and user
exports.getDuplicateReviews = catchAsync(async (req, res, next) => {
  const dupReviews = await Review.aggregate([
    {
      $group: {
        _id: { tour: '$tour', user: '$user' },
        numReviews: { $sum: 1 },
      },
    },
    {
      $match: { numReviews: { $gt: 1 } },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      dupReviews,
    },
  });
});
