'use strict'

const request = require('request')
const url = require('url')
const KeeperApi = require('./keeper-api')
const Logger = require('./logger')

function base64urlUnescape (str) {
  str += new Array(5 - str.length % 4).join('=')
  return str.replace(/\-/g, '+').replace(/_/g, '/')
}

function base64urlDecode (str) {
  return new Buffer(base64urlUnescape(str), 'base64').toString()
}

/**
 * Nunux Keeper client.
 */
class KeeperClient {
  constructor (credentials, options, onUpdateCredentials) {
    this.credentials = Object.assign({
      authSite: 'http://login.nunux.org',
      authPath: '/auth/realms/nunux.org/protocol/openid-connect/auth',
      tokenPath: '/auth/realms/nunux.org/protocol/openid-connect/token',
      apiSite: 'http://api.nunux.org/keeper'
    }, credentials)
    this.options = Object.assign({
      offline: true,
      debug: false
    }, options)
    this.onUpdateCredentials = onUpdateCredentials || function (cred) {
      this.logger.warn('Credential updated but no callback registered.')
    }.bind(this)
    // Init. API.
    this.api = new KeeperApi(this)
    // Init. logger.
    this.logger = new Logger(this.options.debug ? 'debug' : 'info')
  }

  static decodeAccessToken (token) {
    const segments = token.split('.')
    if (segments.length !== 3) {
      return {email: 'Unknown'}
    }
    const payload = JSON.parse(base64urlDecode(segments[1]))
    return payload
  }

  authorizeURL (redirect_uri, state) {
    const u = url.parse(this.credentials.authSite)
    const q = {
      response_type: 'code',
      client_id: this.credentials.clientId,
      state: state,
      scope: this.options.offline ? 'offline_access' : 'openid',
      redirect_uri: redirect_uri
    }

    return url.format({
      protocol: u.protocol,
      hostname: u.hostname,
      pathname: this.credentials.authPath,
      query: q
    })
  }

  _tokenURL () {
    const u = url.parse(this.credentials.authSite)
    return url.format({
      protocol: u.protocol,
      hostname: u.hostname,
      pathname: this.credentials.tokenPath
    })
  }

  token (redirect_uri, code) {
    this.logger.debug('Getting token with code', code)
    return new Promise((resolve, reject) => {
      request.post({
        url: this._tokenURL(),
        json: true,
        form: {
          grant_type: 'authorization_code',
          code: code,
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret,
          redirect_uri: redirect_uri
        }
      }, (err, result, data) => {
        if (err) {
          this.logger.error('Unable to get token (http error).', err)
          return reject(err)
        }
        if (data.error) {
          this.logger.error('Unable to get token.', data)
          return reject(data)
        }
        // this.logger.debug('Token response:', data)
        this.credentials.accessToken = data.access_token
        this.credentials.refreshToken = data.refresh_token
        this.credentials.expiresIn = data.expires_in
        this.credentials.expireTime = Date.now() + (data.expires_in * 1000)
        this.credentials.tokenType = data.token_type
        const decoded = KeeperClient.decodeAccessToken(this.credentials.accessToken)
        this.credentials.displayName = decoded.email || decoded.name
        // Notify new credentials
        this.onUpdateCredentials(this.credentials)
        return resolve(this.credentials)
      })
    })
  }

  enableAutoRefreshToken () {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
    }
    // Compute the refresh tiemout one minute before expiration
    const timeout = this.credentials.expireTime - Date.now() - 60000
    // this.logger.debug('Access token expiration time:', this.credentials.expireTime)
    this.logger.debug('Access token will be refreshed in %s s.', Math.floor(timeout / 1000))
    this.refreshTimeout = setTimeout(() => {
      this._refreshToken()
    }, timeout)
  }

  _refreshToken () {
    if (!this.credentials.refreshToken) {
      this.logger.error('Unable to refresh. No refresh token.')
      return Promise.reject('ENOREFRESHTOKEN')
    }
    return new Promise((resolve, reject) => {
      this.logger.debug('Refreshing the access token (%s mode) ...', this.options.offline ? 'offline' : 'online')
      request.post({
        url: this._tokenURL(),
        json: true,
        form: {
          grant_type: 'refresh_token',
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret,
          refresh_token: this.credentials.refreshToken
        }
      }, (err, result, data) => {
        if (err) {
          this.logger.error('Unable to get refresh token (http error).', err)
          return reject(err)
        }
        if (data.error) {
          this.logger.error('Unable to get refresh token.', data)
          return reject(data)
        }
        // this.logger.debug('Refresh token response:', data)
        this.credentials.accessToken = data.access_token
        this.credentials.expiresIn = data.expires_in
        this.credentials.expireTime = Date.now() + (data.expires_in * 1000)
        this.credentials.tokenType = data.token_type
        if (data.refresh_token) {
          // Don't update refresh token if offline mode.
          if (!this.options.offline) {
            this.logger.debug('Not offline. Refresh token also updated.')
            this.credentials.refreshToken = data.refresh_token
          }
          if (this.refreshTimeout) {
            this.enableAutoRefreshToken()
          }
        }
        this.logger.debug('Access token updated.')
        // Notify new credentials
        this.onUpdateCredentials(this.credentials)
        return resolve(this.credentials)
      })
    })
  }

  _request (req, retries) {
    retries = retries || 1
    if (typeof req !== 'object') {
      req = { url: req }
    }
    req.method = req.method || 'GET'
    this.logger.debug('%s %s', req.method, req.url)
    if (!req.hasOwnProperty('json')) {
      req.json = true
    }
    // Set access token
    req.auth = { bearer: this.credentials.accessToken }

    // Trigger refresh token if access token is expired
    if (!this.credentials.expireTime || this.credentials.expireTime < (new Date().getTime() / 1000)) {
      if (retries === 0) {
        this.logger.error('Too many refresh attempts.')
        return Promise.reject('ETOOMANYREFRESH')
      }
      return this._refreshToken()
      .then(() => this._request(req, 0))
    }

    return new Promise((resolve, reject) => {
      request(req, (err, result, data) => {
        if (err) {
          this.logger.error('Request error (http error).', err)
          return reject(err)
        }
        if (result.statusCode === 401 && retries > 0) {
          retries = retries - 1
          this.logger.error('401 received. Trying to refresh the token...')
          return this._refreshToken()
          .then(() => this._request(req, retries))
          .then(resolve)
          .catch(reject)
        }
        if (data.error) {
          this.logger.error('Request error.', data)
          return reject(data)
        }
        if (result.statusCode >= 400) {
          this.logger.error('Request error (bad status code).', data)
          return reject(data)
        }
        return resolve(data)
      })
    })
  }
}

module.exports = KeeperClient

