const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');

exports.getOverview = catchAsync(async (req, res) => {
  // 1) Get tour data from collection
  const tours = await Tour.find();

  // 2) Build template
  // 3) Render that template using tour data from 1)
  // This 'render' will check the file by going to the place we defined pug and the view folder assigned there
  res.status(200).render('overview', {
    title: 'All Tours',
    tours,
  });
});

exports.getTour = (req, res) => {
  res.status(200).render('tour', {
    title: 'The Forest Hiker Tour',
  });
};
