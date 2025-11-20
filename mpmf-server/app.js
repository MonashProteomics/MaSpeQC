/*!
* MaSpeQC - Quality control software for LC-MS/MS instrumentation
*
* Copyright (C) 2018-2025  Simon Caven
* Copyright (C) 2020-2025  Monash University
* Copyright (C) 2022-2025  University of Applied Sciences Mittweida
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as published
* by the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var db = require('./models/connection');
var indexRouter = require('./routes/index');
var metabRouter = require('./routes/metabRoute');
var proteoRouter = require('./routes/proteoRoute');
var configRouter = require('./routes/config');
var reconfigRouter = require('./routes/reconfig');
var userGuideRouter = require('./routes/user');
var processRouter = require('./routes/process');
var customRouter = require('./routes/custom');


var app = express();

// Run in Dev mode command 
// SET DEBUG= mbpf-server:* & npm run devstart

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/metabolomics', metabRouter);
app.use('/proteomics', proteoRouter);
app.use('/configuration', configRouter);
app.use('/reconfig', reconfigRouter);
app.use('/userguide', userGuideRouter);
app.use('/process', processRouter);
app.use('/custom', customRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
