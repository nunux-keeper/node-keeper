'use strict'

/**
 * Document API.
 */
class DocumentApi {
  constructor (client) {
    this.client = client
    this.endpoint = this.client.sdk.options.endpoint + '/v2/document'
  }

  /**
   * Post a new document.
   * @param {Object} doc - Document to create
   * @return {Promise} Creation result
   */
  post (doc) {
    return this.client._request({
      method: 'POST',
      url: this.endpoint,
      json: true,
      body: doc
    })
  }

  /**
   * Get a document with its ID.
   * @param {String} docid - Document ID
   * @return {Promise} Document
   */
  get (docid) {
    return this.client._request({
      method: 'GET',
      url: this.endpoint + '/' + docid,
      json: true
    })
  }

  /**
   * Update a existing document.
   * @param {Object} doc - Document to update
   * @param {Object} update - Update to apply
   * @return {Promise} Update result
   */
  update (doc, update) {
    return this.client._request({
      method: 'PUT',
      url: this.endpoint + '/' + doc.id,
      json: true,
      body: update
    })
  }

  /**
   * Remove a document.
   * @param {Object} doc - Document to remove
   * @return {Promise} Remove result
   */
  remove (doc) {
    return this.client._request({
      method: 'DELETE',
      url: this.endpoint + '/' + doc.id,
      json: true
    })
  }
}

module.exports = DocumentApi
