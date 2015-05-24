/**
 * Show functions to be exported from the design doc.
 */

/*
var fields = require('couchtypes/fields'),
    templates = require('duality/templates');
*/

exports.index = function(doc, req) {
    return {};
};

exports.not_found = function(doc, req) {
    return {
        title: '404 - Not Found',
        content: '{error:"not_found",reason:"missing"}' //templates.render('404.html', req, {})
    };
};
