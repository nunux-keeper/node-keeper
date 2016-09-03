'use strict'

const request = require('request')
const assert = require('assert')
const url = require('url')
const KeeperApi = require('./api')

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
  /**
   * Create client instance.
   * @param {object} sdk SDK instance
   * @param {object} options Client options {offline, clientId, clientSecret}
   * @param {object} creds initial credentials
   */
  constructor (sdk, options, creds) {
    assert(sdk)
    assert(options)
    assert(options.realm)
    assert(options.clientId)
    assert(options.clientSecret)
    this.sdk = sdk
    this.options = Object.assign({
      offline: true,
      onRefreshTokens: function (creds) {
        this.logger.warn('Tokens refreshed but no callback registered.')
      }.bind(this)
    }, options)
    // Init. logger.
    this.logger = this.sdk.logger
    // Init. credentials.
    this._credentials = creds
    // Init. API.
    this.api = new KeeperApi(this)
  }

  /**
   * Simple method to decode an access token.
   * @param {string} token Token to decode
   * @return {object} decoded token payload
   */
  static decodeAccessToken (token) {
    const segments = token.split('.')
    if (segments.length !== 3) {
      return {email: 'Unknown'}
    }
    const payload = JSON.parse(base64urlDecode(segments[1]))
    return payload
  }

  /**
   * Get authorization URL from the Realm.
   * @param {string} redirect_uri Redirect URI
   * @param {string} OAuth state
   * @return {string} Authorization URL
   */
  getAuthorizeURL (redirect_uri, state) {
    const u = url.parse(this.options.realm['token-service'])
    const q = {
      response_type: 'code',
      client_id: this.options.clientId,
      state: state,
      scope: this.options.offline ? 'offline_access' : 'openid',
      redirect_uri: redirect_uri
    }
    return url.format({
      protocol: u.protocol,
      hostname: u.hostname,
      pathname: u.pathname + '/auth',
      query: q
    })
  }

  /**
   * Get token URL from the Realm.
   * @return {string} Token URL
   */
  getTokenURL () {
    const u = url.parse(this.options.realm['token-service'])
    return url.format({
      protocol: u.protocol,
      hostname: u.hostname,
      pathname: u.pathname + '/token'
    })
  }

  /**
   * Get tokens (Access and Refresh token).
   * @param {string} redirect_uri Redirect URI
   * @param {string} OAuth code
   * @return {pomise} Credentials {accessToken, refreshToken, displayName, expiresIn}
   */
  getTokens (redirect_uri, code) {
    this.logger.debug('Getting token with code', code)
    return new Promise((resolve, reject) => {
      request.post({
        url: this.getTokenURL(),
        json: true,
        form: {
          grant_type: 'authorization_code',
          code: code,
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
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
        const accessToken = data.access_token
        const decoded = KeeperClient.decodeAccessToken(accessToken)
        this._credentials = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
          expireTime: Date.now() + (data.expires_in * 1000),
          tokenType: data.token_type,
          displayName: decoded.email || decoded.name
        }
        return resolve(this._credentials)
      })
    })
  }

  /**
   * Refresh tokens.
   * @param {string} token The refresh token
   * @return {promise} the new tokens
   */
  _refreshTokens () {
    if (!this._credentials.refreshToken) {
      this.logger.error('Unable to refresh. No refresh token.')
      return Promise.reject('ENOREFRESHTOKEN')
    }
    return new Promise((resolve, reject) => {
      this.logger.debug('Refreshing the access token (%s mode) ...', this.options.offline ? 'offline' : 'online')
      request.post({
        url: this.getTokenURL(),
        json: true,
        form: {
          grant_type: 'refresh_token',
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
          refresh_token: this._credentials.refreshToken
        }
      }, (err, result, data) => {
        if (err) {
          this.logger.error('Unable to refresh token (http error).', err)
          return reject(err)
        }
        if (data.error) {
          this.logger.error('Unable to refresh token.', data)
          return reject(data)
        }
        // this.logger.debug('Refresh token response:', data)
        const accessToken = data.access_token
        const decoded = KeeperClient.decodeAccessToken(accessToken)
        this._credentials = Object.assign(this._credentials, {
          accessToken: accessToken,
          expiresIn: data.expires_in,
          expireTime: Date.now() + (data.expires_in * 1000),
          tokenType: data.token_type,
          displayName: decoded.email || decoded.name
        })
        if (data.refresh_token) {
          // Don't update refresh token if offline mode.
          if (!this.options.offline) {
            this.logger.debug('Not offline. Refresh token also updated.')
            this._credentials.refreshToken = data.refresh_token
          }
        }
        this.logger.debug('Access token refreshed.')
        this.options.onRefreshTokens(this._credentials)
        return resolve(this._credentials)
      })
    })
  }

  /**
   * Make a HTTP request using the credentials.
   * @param {object} req Request object
   * @param {integer} retries Nb of retries (for internal use!)
   * @return {promise} HTTP response
   */
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
    req.auth = { bearer: this._credentials.accessToken }

    // Trigger refresh token if access token is expired
    if (!this._credentials.expireTime || this._credentials.expireTime < (new Date().getTime() / 1000)) {
      if (retries === 0) {
        this.logger.error('Too many refresh attempts.')
        return Promise.reject('ETOOMANYREFRESH')
      }
      return this._refreshTokens()
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
          return this._refreshTokens()
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

