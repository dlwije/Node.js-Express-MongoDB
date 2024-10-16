const mongoose = require('mongoose');
const slugify = require('slugify');
// const validator = require('validator');
// const User = require('./userModel');

const locationSchema = new mongoose.Schema({
  type: {
    type: String,
    default: 'Point',
    enum: ['Point'],
  },
  coordinates: [Number],
  address: String,
  description: String,
  day: Number,
});
const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxLength: [40, 'A tour name must have less or equal then 40 characters'],
      minLength: [10, 'A tour name must have more or equal then 10 characters'],
      // validate: [validator.isAlpha, 'Tour name must only contain characters'],
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a max group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      // We use set here to round the value when we save or update
      set: (val) => Math.round(val * 10) / 10, // 4.666666, 46.6666, 47, 4.7
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          // here 'this.price' will only point to current doc on NEW DOCUMENT creation. not for update.
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) should be below the regular price',
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a description'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
    },
    startLocation: {
      // GeoJSON
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [locationSchema],
    guides: [
      // This kind of field we use when we need to use CHILD Referencing, here is user
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
    // guides: Array, This field for EMBEDDING User document
  },
  // when we outputted the data as JSON and objects to get the virtual columns data need to specify like this.
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// -1 is for descending order and 1 for ascending order price and this is
// Single field index
/* tourSchema.index({ price: 1 }); */
//  Composite or Compound field index
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
// We add here '2dsphere' because this is real points on the earth like sphere or 2dindex for fictional points
tourSchema.index({ startLocation: '2dsphere' });

// This column will be available virtually only when we get the Data. column is not defined in the DB.
// Here we use normal function instead of array function because we cannot access 'this' keyword inside array function.
// We cannot use virtual columns in queries
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7;
});

// Instead of doing child referencing to keep reviews ids on tour we implemented below way for it.
// Virtually populating the reviews of current tour
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});

// DOCUMENT MIDDLEWARE: runs before .save() and .create() only. not work with insertMany or One.
// This is a pre middleware and this will run before and actual event. At this time the event is 'save' event
// We can have multiple pre and post middlewares or hooks here

tourSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  // Like we do on Express middleware we need to add next() expression after finishing our function to
  // move to next middleware if there are more than onw middleware
  next();
});

// EMBEDDING USER DOCUMENT TO TOUR COLLECTION
// This function is async because we use Promise.all to get guidesPromises promises data
/*tourSchema.pre('save', async function (next) {
  // We wanna use async inside map because we are using wait to get user data
  const guidesPromises = this.guides.map(async (id) => await User.findById(id));

  this.guides = await Promise.all(guidesPromises);
  next();
});*/

// Here in post middleware we don't have access to this keyword
/* tourSchema.post('save', function (doc, next) {
  console.log(doc);
  next();
}); */

// QUERY MIDDLEWARE: different here make this QUERY middleware is we use 'find' keyword here
// inside here 'this' keyword has access to current query instead current document.
// We use here regular expression for 'find', because this doesn't affect for findOne, findById etc.
// '^' in regular means not only for find start with find as well
tourSchema.pre(/^find/, function (next) {
  this.find({ secretTour: { $ne: true } });

  this.start = Date.now();
  next();
});

tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });
  next();
});

tourSchema.post(/^find/, function (docs, next) {
  console.log(`Query took ${Date.now() - this.start} milliseconds!`);
  next();
});

// AGGREGATION MIDDLEWARE
// To add an element beginning of the array we use 'unshift()'
// tourSchema.pre('aggregate', function (next) {
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });
//   console.log(this);
//   next();
// });

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;

// Mongo document middleware called as pre and post hooks as well. Because we can run before and after some events
// Ex: saving the document to the Database
// 4 types of middleware in mongoose
// 1. Doocument 2. Query 3. aggregate 4. model middleware
