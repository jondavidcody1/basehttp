//    Title: basehttp.js
//    Author: Jon Cody
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.



'use strict';



var fs = require('fs'),
    path = require('path'),
    http = require('http'),
    https = require('https'),
    url_parse = require('url').parse,
    Cookies = require('cookies'),
    multiparty = require('multiparty'),
    nodeStatic = require('node-static'),
    swig = require('swig');


function typeOf(value) {
    var s = typeof value;

    if (s === 'object') {
        if (value) {
            if (Array.isArray(value)) {
                s = 'array';
            }
        } else {
            s = 'null';
        }
    }
    return s;
}


function createServer(settings, logger) {
    var server,
        routes = [],
        fileServer,
        exists = false;

    if (typeof logger !== 'function') {
        logger = console.log;
    }
    settings = typeOf(settings) === 'object'
        ? settings
        : {};
    settings.static_path = typeof settings.static_path === 'string' && settings.static_path;
    settings.template_path = typeof settings.template_path === 'string' && settings.template_path;
    settings.ssl_options = typeOf(settings.ssl_options) === 'object'
        ? settings.ssl_options
        : {};
    if (settings.static_path) {
        settings.static_path = path.resolve(settings.static_path);
        exists = fs.existsSync(settings.static_path);
        if (exists) {
            fileServer = new nodeStatic.Server(settings.static_path);
        }
    }
    if (settings.template_path) {
        settings.template_path = path.resolve(settings.template_path);
    }

    function doRoute(req, res) {
        var uri = url_parse(req.url),
            pathname = uri.pathname,
            l = routes.length,
            matched,
            body = '',
            route,
            form,
            i;

        function matchRoute(part) {
            return part && global.unescape(part);
        }

        function ondata(chunk) {
            body += chunk;
        }

        function onend() {
            if (route.format === 'json') {
                try {
                    body = JSON.parse(global.unescape(body));
                } catch (ignore) {
                    body = null;
                }
            }
            matched.push(body);
            route.handler.apply(null, matched);
        }

        function parseForm(err, fields, files) {
            if (err) {
                return console.log(err);
            }
            req.fields = fields;
            req.files = files;
            route.handler.apply(null, matched);
        }

        for (i = 0; i < l; i += 1) {
            route = routes[i];
            if (req.method === route.method) {
                matched = pathname.match(route.pattern);
                if (matched && matched[0].length > 0) {
                    matched.shift();
                    matched = matched.map(matchRoute);
                    matched.unshift(res);
                    matched.unshift(req);
                    if (route.format) {
                        req.setEncoding('utf8');
                        req.addListener('data', ondata);
                        req.addListener('end', onend);
                        return;
                    }
                    if (req.method === 'POST') {
                        form = new multiparty.Form();
                        form.parse(req, parseForm);
                    } else {
                        route.handler.apply(null, matched);
                    }
                    return;
                }
            }
        }
        if (fileServer) {
            req.addListener('end', function () {
                fileServer.serve(req, res, function (err) {
                    if (err) {
                        return res.notFound();
                    }
                });
            }).resume();
        }
    }

    function addRoute(method, pattern, handler, format) {
        var route;

        if (typeof pattern === 'string') {
            pattern = new RegExp('^' + pattern + '$');
        }
        route = {
            method: method,
            pattern: pattern,
            handler: handler
        };
        if (format) {
            route.format = format;
        }
        routes.push(route);
    }

    function get(pattern, handler) {
        return addRoute('GET', pattern, handler);
    }

    function post(pattern, handler, format) {
        return addRoute('POST', pattern, handler, format);
    }

    function put(pattern, handler, format) {
        return addRoute('PUT', pattern, handler, format);
    }

    function del(pattern, handler) {
        return addRoute('DELETE', pattern, handler);
    }

    function head(pattern, handler) {
        return addRoute('HEAD', pattern, handler);
    }

    function resourceController(name, data, on_change) {
        data = typeOf(data) === 'array'
            ? data
            : [];
        on_change = typeOf(on_change) === 'function'
            ? on_change
            : null;
        return {
            index: function (req, res) {
                res.send(200, JSON.stringify({
                    content: data,
                    self: '/' + name
                }), 'application/json');
            },
            show: function (req, res, id) {
                var item = data[id];

                if (item) {
                    res.send(200, JSON.stringify({
                        content: item,
                        self: '/' + name + '/' + id
                    }), 'application/json');
                } else {
                    res.notFound();
                }
            },
            create: function (req, res, body) {
                var id,
                    url,
                    item = typeOf(body) === 'object'
                        ? body.content
                        : body;

                if (!item) {
                    res.notFound();
                } else {
                    data.push(item);
                    id = data.length - 1;
                    on_change(id);
                    url = '/' + name + '/' + id;
                    res.send(201, JSON.stringify({
                        content: item,
                        self: url
                    }), 'application/json', {Location: url});
                }
            },
            update: function (req, res, id, body) {
                var item = typeOf(body) === 'object'
                    ? body.content
                    : body;

                if (!item) {
                    res.notFound();
                } else {
                    data[id] = item;
                    if (typeof on_change === 'function') {
                        on_change(id);
                    }
                    res.send(200, JSON.stringify({
                        content: item,
                        self: '/' + name + '/' + id
                    }), 'application/json');
                }
            },
            destroy: function (req, res, id) {
                delete data[id];
                on_change(id);
                res.send(200, '200 Destroyed', 'application/json');
            }
        };
    }

    function resource(name, controller, format) {
        get(new RegExp('^/' + name + '$'), controller.index);
        get(new RegExp('^/' + name + '/([^/]+)$'), controller.show);
        post(new RegExp('^/' + name + '$'), controller.create, format);
        put(new RegExp('^/' + name + '/([^/]+)$'), controller.update, format);
        del(new RegExp('^/' + name + '/([^/]+)$'), controller.destroy);
    }

    function logify(req, res, logger) {
        var end = res.end,
            writeHead = res.writeHead;

        res.end = function () {
            logger((req.socket && req.socket.remoteAddress) + ' - [' +
                    (new Date()).toUTCString() + '] - "' + req.method +
                    ' ' + req.url + ' HTTP/' + req.httpVersionMajor + '.' +
                    req.httpVersionMinor + '" - ' + res.statusCode + ' - "' +
                    (req.headers.referer || '') + '"');
            return end.apply(this, arguments);
        };
        res.writeHead = function (code) {
            res.statusCode = code;
            return writeHead.apply(this, arguments);
        };
    }

    function updateReqRes(req, res) {
        var cookies;

        res.settings = settings;
        req.settings = settings;
        if (settings.cookie_keys) {
            cookies = new Cookies(req, res, settings.cookie_keys);
            res.cookies = cookies;
            req.cookies = cookies;
        }
        res.send = function (code, body, content_type, headers) {
            if (typeof body === 'string' && typeof content_type === 'string') {
                headers = (typeOf(headers) === 'object' && headers) || {};
                headers['Content-Type'] = content_type;
                headers['Content-Length'] = Buffer.byteLength(body, 'utf8');
                res.writeHead(code, headers);
                if (req.method !== 'HEAD') {
                    res.write(body);
                }
                res.end();
            } else {
                body = 'Internal Server Error';
                res.writeHead(500, {
                    'Content-Type': 'text/plain',
                    'Content-Length': Buffer.byteLength(body, 'utf8')
                });
                res.end();
            }
        };
        res.notFound = function (message) {
            message = typeof message === 'string'
                ? message
                : 'Not Found';
            res.send(404, message, 'text/plain');
        };
        res.serverError = function (message) {
            message = typeof message === 'string'
                ? message
                : 'Internal Server Error';
            res.send(500, message, 'text/plain');
        };
        res.redirect = function (location) {
            if (location && typeof location === 'string') {
                res.writeHead(302, {Location: location});
                res.end();
            } else {
                res.serverError('Redirect Error');
            }
        };
        res.innerRedirect = function (location) {
            if (location && typeof location === 'string') {
                logger('Internal Redirect: ' + req.url + ' -> ' + location);
                req.url = location;
                doRoute();
            } else {
                res.serverError('Inner Redirect Error');
            }
        };
        res.render = function (filepath, templateVars) {
            var exist = fs.existsSync(filepath);

            if (!exist) {
                filepath = settings.template_path
                    ? path.join(settings.template_path, filepath)
                    : path.resolve(filepath);
                exist = fs.existsSync(filepath);
            }
            if (exist) {
                swig.renderFile(filepath, typeOf(templateVars) === 'object'
                    ? templateVars
                    : {}, function (err, data) {
                    if (err) {
                        return res.serverError('Swig Error: ' + err);
                    }
                    res.send(200, data, 'text/html');
                });
            } else {
                res.notFound();
            }
        };
    }

    function main(req, res) {
        logify(req, res, logger);
        updateReqRes(req, res);
        doRoute(req, res);
    }

    server = settings.ssl_options.key && settings.ssl_options.cert
        ? https.createServer(settings.ssl_options, main)
        : http.createServer(main);
    server.addRoute = addRoute;
    server.get = get;
    server.post = post;
    server.put = put;
    server.del = del;
    server.head = head;
    server.resource = resource;
    server.resourceController = resourceController;
    return server;
}


exports.createServer = createServer;
