const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
// const mongoSanitize = require('dompurify');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const viewRouter = require('./routes/viewRoutes');

const app = express();

app.set('view engine', 'pug');
// We can use 'path.join' to get rid of slash adding or not kind of issues and bugs
app.set('views', path.join(__dirname, 'views'));

// 1) GLOBAL MIDDLEWARES
// Serving static files
app.use(express.static(path.join(__dirname, 'public')));

// Set security HTTP headers
app.use(helmet());

// Development Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit request from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many request from this IP, please try again in an hour!',
});
app.use('/api', limiter);

// Body parser, reading data from body into req.body. And set the size which can pass through body
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Data sanitization against NOSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution EX: sort=duration&sort=price
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  }),
);

// Testing middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// Added for map integration
// Further HELMET configuration for Security Policy (CSP)
// const scriptSrcUrls = ['https://unpkg.com/', 'https://tile.openstreetmap.org'];
// const styleSrcUrls = [
//   'https://unpkg.com/',
//   'https://tile.openstreetmap.org',
//   'https://fonts.googleapis.com/',
// ];
// const connectSrcUrls = ['https://unpkg.com', 'https://tile.openstreetmap.org'];
// const fontSrcUrls = ['fonts.googleapis.com', 'fonts.gstatic.com'];
//
// //set security http headers
// app.use(
//   helmet.contentSecurityPolicy({
//     directives: {
//       defaultSrc: [],
//       connectSrc: ["'self'", ...connectSrcUrls],
//       scriptSrc: ["'self'", ...scriptSrcUrls],
//       styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
//       workerSrc: ["'self'", 'blob:'],
//       objectSrc: [],
//       imgSrc: ["'self'", 'blob:', 'data:', 'https:'],
//       fontSrc: ["'self'", ...fontSrcUrls],
//     },
//   }),
// );

// HTTP Security Headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // ... other directives
        'script-src': [
          "'self'", // allow scripts from your own domain
          "'unsafe-inline'", // allow inline scripts (you may want to remove this depending on your needs)
          'https://api.mapbox.com', // allow scripts from the Mapbox CDN
          'https://cdnjs.cloudflare.com',
        ],
        'worker-src': [
          "'self'", // allow web workers from your own domain
          'http://localhost:8000', // allow web workers from the current host (development environment)
          'https://api.mapbox.com', // allow web workers from the Mapbox CDN
          'blob:', // allow web workers from blob URLs
          'https://cdnjs.cloudflare.com',
        ],
        'connect-src': [
          "'self'", // allow connections to your own domain
          'https://api.mapbox.com', // allow connections to the Mapbox API
          'https://events.mapbox.com', // allow connections to Mapbox events
          'https://cdnjs.cloudflare.com',
        ],
      },
    },
  }),
);

app.use(helmet({ contentSecurityPolicy: false }));

// 3) ROUTES
// Server side front end routes
app.use('/', viewRouter);

// API Routes
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);

// The below route will prevent sending html page for doesn't exist routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
