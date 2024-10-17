exports.getOverview = (req, res) => {
  // This 'render' will check the file by going to the place we defined pug and the view folder assigned there
  res.status(200).render('overview', {
    title: 'All Tours',
  });
};

exports.getTour = (req, res) => {
  res.status(200).render('tour', {
    title: 'The Forest Hiker Tour',
  });
};
