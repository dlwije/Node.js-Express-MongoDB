module.exports = (fn) => {
  return (req, res, next) => {
    // console.log('catchAsync', fn);
    fn(req, res, next).catch(next);
  };
};
