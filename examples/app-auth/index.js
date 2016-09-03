// -----------------------------------------------------------------------------
// Requirements
// -----------------------------------------------------------------------------
const express = require('express')
const exphbs = require('express-handlebars')
const session = require('express-session')
const KeeperSDK = require('node-keeper')

// ------------------------------------------------------------------------------
// Application Parameters - Fill in with your app's values
// ------------------------------------------------------------------------------

const CLIENT_ID = 'YOUR CLIENT ID'
const CLIENT_SECRET = 'YOUR CLIENT SECRET'

// Set up Express
const app = express()

const sdk = new KeeperSDK({debug: true})

const options = {
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  offline: false
}

const redirect_uri = 'http://home:3000/callback'

// Set up the templating engine (Handlebars)
app.engine('hbs', exphbs({
  defaultLayout: 'main',
  extname: '.hbs'
}))
app.set('view engine', 'hbs')

// Set up sessions, so we can log users in and out
app.use(session({
  secret: 'session secret',
  resave: false,
  saveUninitialized: false
}))

// User authentication middleware
app.use(function (req, res, next) {
  if (req.session.credentials) {
    res.locals.credentials = req.session.credentials
  }
  next()
})

app.get('/', function (req, res) {
  // ender the home page
  res.render('home')
})

app.get('/login', function (req, res) {
  sdk.createClient(options)
  .then(function (client) {
    res.redirect(client.getAuthorizeURL(redirect_uri))
  })
})

app.get('/logout', function (req, res) {
  // To log the user out, we can simply destroy their session
  req.session.destroy(function () {
    res.redirect('/')
  })
})

// URL called back from the authetication service
app.get('/callback', function (req, res) {
  if (req.query.error) {
    return res.status(500).render('error', {
      error: req.query.error,
      cause: req.query.error_description
    })
  }

  sdk.createClient(options)
  .then(function (client) {
    client.getTokens(redirect_uri, req.query.code)
    .then((creds) => {
      // Save credentials for further usage...
      req.session.credentials = creds
      return res.redirect('/profile')
    })
    .catch((err) => {
      res.status(502).render('error', {
        error: 'Somethin blew up!',
        cause: err
      })
    })
  })
})

// Get protected resource
app.get('/profile', function (req, res) {
  if (!req.session.credentials) {
    // Return to home page if user is not logged
    return res.redirect('/')
  }

  // Init. client.
  sdk.createClient(Object.assign(options, {
    onRefreshTokens: (creds) => req.session.credentials = creds
  }), req.session.credentials)
  .then(function (client) {
    const result = client.api.profile.get()
    result.then((data) => {
      res.render('profile', {profile: data})
    }).catch((err) => {
      res.status(502).render('error', {
        error: 'Somethin blew up!',
        cause: err
      })
    })
  })
})

app.listen(3000)
console.log('Server started!')
console.log('Visit http://localhost:3000/ to start.')
