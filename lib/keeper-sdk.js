'use strict'

const request = require('request')
const KeeperClient = require('./keeper-client')
const Logger = require('./logger')

/**
 * Nunux Keeper SDK.
 */
class KeeperSDK {
  /**
   * Create instance.
   * @param {object} options SDK options {endpoint, debug}
   */
  constructor (options) {
    this.options = Object.assign({
      endpoint: 'https://api.nunux.org/keeper',
      debug: false
    }, options)
    // Init. logger.
    this.logger = new Logger(this.options.debug ? 'debug' : 'info')
  }

  /**
   * Get API informations from the endpoint.
   * @return {promise} API informations
   */
  getApiInfos () {
    if (this._infos) {
      return Promise.resolve(this._infos)
    }
    this.logger.debug('Getting API informations...', this.options.endpoint)
    return new Promise((resolve, reject) => {
      request.get({
        url: this.options.endpoint,
        json: true
      }, (err, result, data) => {
        if (err) {
          this.logger.error('Unable to get API infos (http error).', err)
          return reject(err)
        }
        if (data.error) {
          this.logger.error('Unable to get API infos.', data)
          return reject(data)
        }
        if (!data['_links'] && !data._links['auth-realm']) {
          return reject('EBADINFOS')
        }
        this._infos = data
        return resolve(this._infos)
      })
    })
  }

  /**
   * Get informations of the authentication realm.
   * @return {promise} Realm informations
   */
  getAuthRealm () {
    if (this._realm) {
      return Promise.resolve(this._realm)
    }
    return this.getApiInfos()
    .then((infos) => {
      const realmUrl = infos._links['auth-realm'].href
      this.logger.debug('Getting Realm informations...', realmUrl)
      return new Promise((resolve, reject) => {
        request.get({
          url: realmUrl,
          json: true
        }, (err, result, data) => {
          if (err) {
            this.logger.error('Unable to get Realm infos (http error).', err)
            return reject(err)
          }
          if (data.error) {
            this.logger.error('Unable to get Realm infos.', data)
            return reject(data)
          }
          if (!data['token-service']) {
            return Promise.reject('EBADREALM')
          }
          this._realm = data
          return resolve(this._realm)
        })
      })
    })
  }

  /**
   * Create new client instance.
   * @param {object} options Options {clientId, clientSecret, offline, onRefreshTokens}
   * @return {promise} Client instance
   */
  createClient (options, creds) {
    return this.getAuthRealm()
    .then((realm) => {
      options.realm = realm
      return Promise.resolve(new KeeperClient(this, options, creds))
    })
  }
}

module.exports = KeeperSDK

