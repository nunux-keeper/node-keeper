'use strict'

/**
 * Keeper API class.
 * Expose Nunux Keeper API.
 */
class KeeperApi {
  constructor (client) {
    this.client = client
  }

  /**
   * Post a new document.
   * @param {Object} doc - Document to create
   * @return {Promise} Creation result
   */
  postDocument (doc) {
    return this.client._request({
      method: 'POST',
      url: this.client.credentials.apiSite + '/v2/document',
      json: true,
      body: doc
    })
  }

  /**
   * Get a document with its ID.
   * @param {String} docid - Document ID
   * @return {Promise} Document
   */
  getDocument (docid) {
    return this.client._request({
      method: 'GET',
      url: this.client.credentials.apiSite + '/v2/document/' + docid,
      json: true
    })
  }

  /**
   * cwUpdate a existing document.
   * @param {Object} doc - Document to update
   * @param {Object} update - Update to apply
   * @return {Promise} Update result
   */
  updateDocument (doc, update) {
    return this.client._request({
      method: 'PUT',
      url: this.client.credentials.apiSite + '/v2/document/' + doc.id,
      json: true,
      body: update
    })
  }

  /**
   * Remove a document.
   * @param {Object} doc - Document to remove
   * @return {Promise} Remove result
   */
  removeDocument (doc) {
    return this.client._request({
      method: 'DELETE',
      url: this.client.credentials.apiSite + '/v2/document/' + doc.id,
      json: true
    })
  }
}

module.exports = KeeperApi
