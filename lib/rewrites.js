/**
 * Rewrite settings to be exported from the design doc
 */

/*
 * In order!
 */

module.exports = [{
    "from": "/static/*",
    "to": "static/*"
}, {
    "from": "/vendor/*",
    "to": "vendor/*"
}, {
    "from": "/kanso-topbar/*",
    "to": "kanso-topbar/*"
}, {
    "description": "Access to this database",
    "from": "_db",
    "to": "../.."
}, {
    "from": "_db/*",
    "to": "../../*"
}, {
    "description": "Access to the _design prefix",
    "from": "_design/*",
    "to": "../../_design/*"
}, {
    "description": "Access to this design document",
    "from": "_ddoc",
    "to": ""
}, {
    "from": "_ddoc/*",
    "to": "*"
}, {
    "description": "Access to the main CouchDB API; requires _config/httpd/secure_rewrites = false",
    "from": "_couchdb",
    "to": "../../.."
}, {
    "from": "_couchdb/*",
    "to": "../../../*"
}, {
    "description": "Session handler",
    "from": "_session",
    "to": "../../../_session"
}, {
    "description": "Users handler",
    "from": "_users/*",
    "to": "../../../_users/*"
}, {
    "description": "Home page",
    "from": "/",
    "to": "static/index.html"
}, {
    "description": "404 not found",
    "from": "*",
    "to": "_show/not_found"
}]
