'use strict'

/**
 * Profile API.
 */
class ProfileApi {
  constructor (client) {
    this.client = client
    this.endpoint = this.client.sdk.options.endpoint + '/v2/profile'
  }

  /**
   * Get current user profile.
   * @return {Promise} Profile
   */
  get () {
    return this.client._request({
      method: 'GET',
      url: this.endpoint,
      json: true
    })
  }
}

module.exports = ProfileApi
