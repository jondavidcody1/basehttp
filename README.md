basehttp
========

A basic node.js HTTP server library.

### Config / Settings
- **template_path** _string_ - sets the path to templates
- **static_path** _string_ - sets the path to static files
- **cookie_keys** _array_ - sets the [secret cookie keys](https://github.com/crypto-utils/keygrip#keys--keygripkeylist)
- **ssl_options** _object_ - sets the [key and cert files](https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener)

### Server Methods
In addition to the [default HTTP server](https://nodejs.org/api/http.html#http_class_http_server) methods:
- **server.addRoute(method, pattern, handler, format)** - add a route handler for a requested path matching pattern
- **server.get(pattern, handler)** - shorthand for server.addRoute('GET', pattern, handler)
- **server.post(pattern, handler, format)** - shorthand for server.addRoute('POST', pattern, handler, format)
- **server.put(pattern, handler, format)** - shorthand for server.addRoute('PUT', pattern, handler, format)
- **server.del(pattern, handler)** - shorthand for server.addRoute('DELETE', pattern, handler)
- **server.head(pattern, handler)** - shorthand for server.addRoute('HEAD', pattern, handler)
- **server.resource(name, controller, format)** - creates a REST resource with common mappings
- **server.resourceController(name, data, on_change)** - returns a resource controller with the following methods:
  - index(req, res)
  - show(req, res, id)
  - create(req, res, body)
  - update(req, res, id, body)
  - destroy(req, res, id)

### Response Methods
In addition to the [default HTTP response](https://nodejs.org/api/http.html#http_class_http_serverresponse) methods:
- **res.send(code, body, content_type, headers)** - send an HTTP response code, a message, body, the content type, and additional headers
- **res.notFound(message)** - send a 404 response code with an optional message
- **res.serverError(message)** - send a 500 response code with an optional message
- **res.redirect(location)** - send a 302 response code with a location
- **res.innerRedirect(location)** - perform an internal redirect
- **res.render(filepath, templateVars)** - render a template with optional variables; if the template path is set on the config/settings object for this server instance, this directory will be checked first, then the resolved path

### Request and Response Properties
- **(req|res).settings** - a copy of the config/settings object passed to this server instance
- **(req|res).cookies** - a [cookies](https://www.npmjs.com/package/cookies#api) object if the cookie keys are set on the config/settings object for this server instance

### Example
```js
var config = {
        template_path: './templates',
        static_path: './static',
        cookie_keys: ['SEKRIT2', 'SEKRIT1']
    },
    server = require('basehttp').createServer(config);

server.get('/', function (req, res) {
    res.cookies.set('basehttp-cookie-name', 'basehttp-cookie-value', {signed: true});
    res.render('index.html');
});
server.listen(8080);
```
