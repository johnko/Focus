exports.create = {
    map: function(doc) {
        if (doc.publish && doc.created_at) {
            emit((doc.edit_at || doc.state_at || doc.created_at), doc);
        }
    }
};

exports["focus-state"] = {
    map: function(doc) {
        if (doc.created_at && doc.state) {
            emit([doc.state, (doc.edit_at || doc.state_at || doc.created_at)], doc);
        }
    }
};

exports["focus-time"] = {
    map: function(doc) {
        if (doc.publish && doc.created_at) {
            emit((doc.edit_at || doc.state_at || doc.created_at), doc);
        }
    }
};

exports["focus-user-state-created"] = {
    map: function(doc) {
        // Order now / later items consistently so they dont jump around the ui
        // done items are ordered by last edit to the last week view makes sense
        if (doc.type && doc.type === "task") {
            if (doc.state === "now" || doc.state === "later") {
                emit([doc.profile.name, doc.state, (doc.created_at)], doc);
            } else {
                emit([doc.profile.name, doc.state, (doc.edit_at || doc.created_at)], doc);
            }
        }
    }
};

exports.gravatars = {
    map: function(doc) {
        if (doc.type === "gravatar") {
            emit([doc.email], doc);
        }
    }
};

exports["item-comments"] = {
    map: function(doc) {
        if (doc.comment) {
            emit([doc.item_id, doc.created_at], doc);
        }
    }
};

exports.mentions = {
    map: function(doc) {
        if (doc.message && doc.created_at &&
            (doc.state === "now" || doc.state === "later")) {
            var words = {};
            doc.message.replace(/\@([\w\-]+)/g, function(tag, word) {
                words[word.toLowerCase()] = true;
            });
            for (var w in words) {
                emit([w, (doc.edit_at || doc.state_at || doc.created_at)], doc);
            }
        }
    },
    reduce: "_count"
};

exports.tags = {
    map: function(doc) {
        if (doc.message && doc.created_at &&
            (doc.state === "now" || doc.state === "later")) {
            var words = {};
            doc.message.replace(/\#([\w\-\.]*[\w]+[\w\-\.]*)/g, function(tag, word) {
                words[word.toLowerCase()] = true;
            });
            for (var w in words) {
                emit([w, (doc.edit_at || doc.state_at || doc.created_at)], doc);
            }
        }
    },
    reduce: "_count"
};

exports["user-created"] = {
    map: function(doc) {
        emit([doc.profile.name], doc._id);
    },
    reduce: function(keys, values) {
        return values[0];
    }
};

exports["user-state-created"] = {
    map: function(doc) {
        emit([doc.profile.name, doc.state, (doc.edit_at || doc.state_at || doc.created_at)], doc);
    }
};

exports["user-tagcloud"] = {
    map: function(doc) {
        if (doc.message) {
            var words = {};
            doc.message.replace(/\#([\S\-\.]*[\w]+[\S\-\.]*)/g, function(tag, word) {
                words[word.toLowerCase()] = true;
            });
            for (var w in words) {
                emit([doc.profile.name, w, (doc.edit_at || doc.state_at || doc.created_at)], doc);
            }
        }
    },
    reduce: "_count"
};
