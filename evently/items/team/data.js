function(resp) {
    var users = [];
    for (var i=0; i < resp.rows.length; i++) {
        users.push({
            gravatar_url : "",
            name:resp.rows[i].key[0]
        });
    };
    
    return {
        users : users
    };
};