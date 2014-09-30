var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var request = require('request');
var jwt = require('jwt-simple');
var mongoose = require('mongoose');
var moment = require('moment');

var config = require('./config');

var User = mongoose.model('User', new mongoose.Schema({
  email: { type: String, unique: true, lowercase: true },
  password: { type: String, select: false },
  displayName: String,
  facebook: String,
  foursquare: String,
  google: String,
  github: String,
  linkedin: String,
  twitter: String
}));

mongoose.connect(config.db);

var app = express();

app.set('port', process.env.PORT || 3000);
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

/*
 |--------------------------------------------------------------------------
 | Login Required Middleware
 |--------------------------------------------------------------------------
 */
function ensureAuthenticated(req, res, next) {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'Please make sure your request has an Authorization header' });
  }

  var token = req.headers.authorization.split(' ')[1];
  var payload = jwt.decode(token, config.TOKEN_SECRET);

  if (payload.exp <= moment().unix()) {
    return res.status(401).send({ message: 'Token has expired' });
  }

  req.user = payload.sub;
  next();
}

/*
 |--------------------------------------------------------------------------
 | Generate JSON Web Token
 |--------------------------------------------------------------------------
 */
function createToken(req, user) {
  var payload = {
    iss: req.hostname,
    sub: user._id,
    iat: moment().unix(),
    exp: moment().add(14, 'days').unix()
  };
  return jwt.encode(payload, config.TOKEN_SECRET);
}


/*
 |--------------------------------------------------------------------------
 | Sign in with Instagram
 |--------------------------------------------------------------------------
 */
app.post('/auth/instagram', function(req, res) {
  var accessTokenUrl = 'https://api.instagram.com/oauth/access_token';

  var params = {
    client_id: req.body.clientId,
    redirect_uri: req.body.redirectUri,
    client_secret: config.clientSecret,
    code: req.body.code
  };

  request.get({
    url: accessTokenUrl,
    qs: params,
    json: true
  }, function(err, response, body) {
    var accessToken = body.access_token;
    var userId = body.user.id;
    var username = body.user.username;
    var fullName = body.user.full_name;
    var picture = body.user.profile_picture;

    User.findById(userId, function(err, existingUser) {
      if (existingUser) {
        return res.send({ token: createToken(req, existingUser) });
      }

      var user = new User();
      user.facebook = profile.id;
      user.displayName = profile.name;
      user.save(function(err) {
        res.send({ token: createToken(req, user) });
      });
    });
  });
});

/*
 |--------------------------------------------------------------------------
 | Enable CORS
 |--------------------------------------------------------------------------
 */
app.all('/*', function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With');
  res.header('Access-Control-Allow-Methods', 'GET, POST', 'PUT');
  next();
});


app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});