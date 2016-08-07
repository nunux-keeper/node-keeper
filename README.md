node-keeper
===========

Official <a href="http://keeper.nunux.org" target="_new">Nunux Keeper V2</a>
Node.js client.

Please note that this client is not compatible with Nunux Keeper v1.

Install
-------

Run the following command in the root directory of your Node-RED install

    npm install node-keeper

Usage (with express)
--------------------

```javascript
const express = require('express')
const KeeperClient = require('node-keeper')

// YOUR persitence lib
const CredentialsDAO = require(/*???*/)

const credentials = {
  clientId: /** YOUR CLIENT ID */,
  clientSecret: /** YOUR CLIENT SECRET **/
}
const callback_url = /**YOUR CALLBACK URL **/

const app = express()

// Login entrypoint
app.get('/login', function(req, res) {
  const keeperClient = new KeeperClient(credentials, {debug: true})
  res.redirect(keeperClient.authorizeURL(callback_url)
})

// Callback URL
app.get('/callback', function(req, res) {
  if (req.query.error) {
    return res.send('ERROR: ' + req.query.error + ': ' + req.query.error_description)
  }

  const keeperClient = new KeeperClient(credentials, {debug: true})
  keeperClient.token(callback_url, req.query.code)
  .then((creds) => {
    // Save credentials for further usage...
    CredentialsDAO.save(creds)
    res.send({ message: 'Authenticated \o/' })
  })
  .catch((err) => {
    res.status(502).send({ error: 'something blew up', detail: err })
  })
})

// Get protected resource
app.get('/document/:id', function(req, res) {
  // Retrieve saved credentials
  const creds = CredentialsDAO.get()
  const keeperClient = new KeeperClient(creds, {debug: true}, function (_creds) {
    // Access token has been refreshed.
    // Update credentials for further usage...
    CredentialsDAO.update(_creds)
  })

  const result = keeperClient.api.getDocument(req.params.id)
  result.then((data) => {
    res.send(data)
  }).catch((err) => {
    res.status(502).send({ error: 'something blew up', detail: err })
  })
})


app.listen(8080)

```
