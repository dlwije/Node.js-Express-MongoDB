const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    // We use below fields like this for PARENT Referencing
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour.'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
  },
  // when we outputted the data as JSON and objects to get the virtual columns data need to specify like this.
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Adding composite key and unique to prevent from duplicate reviews
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

reviewSchema.pre(/^find/, function (next){
  // this.populate({
  //   path: 'tour',
  //   select: 'name',
  // }).populate({
  //   path: 'user',
  //   select: 'name photo',
  // });
  this.populate({
    path: 'user',
    select: 'name photo',
  });
  next();
});

// Static method
reviewSchema.statics.calcAverageRatings = async function (tourId) {
  const stats = await this.aggregate([
    // 1) Select all the reviews which belongs to passed tourId
    {
      $match: { tour: tourId },
    },
    // 2) Calculate statistics it self
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);
  // console.log(stats);

  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

reviewSchema.post('save', function () {
  // Here 'this' points to the current review
  this.constructor.calcAverageRatings(this.tour);
  // We cannot use Review.calcAverageRatings because of it initializes after this middleware.
  // That's why we use constructor
});

// findByIdAndUpdate
// findByIdAndDelete
// Behind above two functions it use the 'findOneAnd' expressions
reviewSchema.pre(/^findOneAnd/, async function (next) {
  // we need to get access to document so we basically run a simple query
  this.r = await this.clone().findOne();
  // console.log(this.r);
  next();
});

reviewSchema.post(/^findOneAnd/, async function () {
  // We did this calculation in here, POST middleware because we cannot do it in PRE,
  // at that moment the DB not yet updated with changes either Delete or Update
  // await this.clone().findOne() does not work here, query has already executed
  await this.r.constructor.calcAverageRatings(this.r.tour);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
