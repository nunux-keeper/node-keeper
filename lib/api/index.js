'use strict'

const fs = require('fs')
const path = require('path')

/**
 * Keeper API class.
 * Expose Nunux Keeper API.
 */
class KeeperApi {
  constructor (client) {
    this.client = client
    // Dynamic loading API...
    fs.readdirSync(__dirname).forEach((file) => {
      if (/^[a-z]+\.api\.js$/.test(file)) {
        const name = path.basename(file, '.api.js')
        // this.client.logger.debug('Loading %s API...', name)
        const Api = require(path.join(__dirname, file))
        this[name] = new Api(this.client)
      }
    })
  }
}

module.exports = KeeperApi
