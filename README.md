[![Build Status](https://travis-ci.org/ncarlier/node-keeper.svg?branch=master)](https://travis-ci.org/ncarlier/node-keeper)

node-keeper
===========

Official <a href="http://keeper.nunux.org" target="_new">Nunux Keeper V2</a>
Node.js client.

Please note that this client is not compatible with Nunux Keeper v1.

Install
-------

Run the following command in the root directory of your project

```
npm install --save node-keeper
```

Basic Usage
-----------

>> See a complete working example in the `examples` directory.

```javascript
const express = require('express')
const KeeperSDK = require('node-keeper')

// YOUR persitence lib
const CredentialsDAO = require(/*???*/)

const sdk = new KeeperSDK({debug: true})

const options = {
  clientId: /** YOUR CLIENT ID */,
  clientSecret: /** YOUR CLIENT SECRET **/
}
const callback_url = /**YOUR CALLBACK URL **/

const app = express()

// Login entrypoint
app.get('/login', function(req, res) {
  sdk.createClient(options)
  .then((client) => {
    res.redirect(client.getAuthorizeURL(callback_url))
  })
})

// Callback URL
app.get('/callback', function(req, res) {
  if (req.query.error) {
    return res.send('ERROR: ' + req.query.error + ': ' + req.query.error_description)
  }

  sdk.createClient(options)
  .then((client) => {
    client.getTokens(callback_url, req.query.code)
    .then((creds) => {
      // Save credentials for further usage...
      CredentialsDAO.save(creds)
      res.send({ message: 'Authenticated :)' })
    })
    .catch((err) => {
      res.status(502).send({ error: 'something blew up', detail: err })
    })
  })
})

// Get protected resource
app.get('/document/:id', function(req, res) {
  // Init. client.
  sdk.createClient(Object.assign(options, {
    onRefreshTokens: (creds) => {
      // Save credentials for further usage...
      CredentialsDAO.save(creds)
    }
  }), CredentialsDAO.get())
  .then(function (client) {
    const result = client.api.getDocument(req.params.id)
    result.then((data) => {
      res.send(data)
    }).catch((err) => {
      res.status(502).send({ error: 'something blew up', detail: err })
    })
  })
})


app.listen(3000)
```

Copyright and License
---------------------

Copyright 2016 Nunux, Org. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
