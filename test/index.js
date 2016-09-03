require('should')

const KeeperSDK = require('../lib/keeper-sdk')
const nock = require('nock')

const CLIENT_ID = 'YOUR CLIENT ID'
const CLIENT_SECRET = 'YOUR CLIENT SECRET'

const sdk = new KeeperSDK({debug: true})

const options = {
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET
}

const redirect_uri = 'http://foo.bar/callback'

// Setup Nock...
// API Infos...
const infos = {
  _links: {
    'auth-realm': {
      href: 'https://login.nunux.org/auth/realms/nunux.org'
    }
  },
  name: 'keeper-core-api',
  description: 'Keeper core API',
  version: '2.0.0',
  apiVersion: '2'
}

nock(sdk.options.endpoint)
.get('')
.reply(200, infos)

// Auth Realm...
const realm = {
  realm: 'nunux.org',
  'token-service': 'https://login.nunux.org/auth/realms/nunux.org/protocol/openid-connect'
}
nock('https://login.nunux.org')
.get('/auth/realms/nunux.org')
.reply(200, realm)

// Tokens...
const tokens = {
  access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.Q6CM1qIz2WTgTlhMzpFL8jI8xbu9FFfj5DY_bGVY98Y',
  refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.Q6CM1qIz2WTgTlhMzpFL8jI8xbu9FFfj5DY_bGVY98Y',
  expiresIn: 3600,
  token_type: 'bearer'
}
nock('https://login.nunux.org')
.post('/auth/realms/nunux.org/protocol/openid-connect/token')
.reply(200, tokens)

it('should retrieve authorize URL', function () {
  return sdk.createClient(options)
  .then(function (client) {
    const url = client.getAuthorizeURL(redirect_uri)
    url.should.not.be.null()
    url.should.startWith(realm['token-service'])
    return Promise.resolve()
  })
})

it('should retrieve tokens', function () {
  return sdk.createClient(options)
  .then(function (client) {
    console.log(client.getTokenURL())
    return client.getTokens(redirect_uri, 'some code')
  })
  .then(function (creds) {
    creds.should.not.be.null()
    creds.should.have.properties(['accessToken', 'refreshToken', 'displayName', 'expiresIn'])
    creds.displayName.should.equal('John Doe')
    return Promise.resolve()
  })
})

