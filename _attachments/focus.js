var Focus = (function () {

  var dbName    = null,
      urlPrefix = "/",
      router    = new Router(),
      user      = null,
      userDoc   = null,
      profiles  = [],
      db        = null;
  
  var xhrCache = {},
      docCache = {};

  var selected = "selected='selected'";
  
  router.pre(urlChange);
  router.error404(function (verb, url) {
    if (verb === "GET") { 
      render("#content", "#error404", {url:url});
    } else {
      console.error(verb, url);
    }
  });
  
  // I can combine these all into the same clause, I just hate regex
  router.get("!/team/:name/edit/:id", function (name, id) {
    createEdit(id);
  });
  router.get("!/tags/:tag/edit/:id", function (tag, id) {
    createEdit(id);
  });
  router.get("!/mentions/:tag/edit/:id", function (tag, id) {
    createEdit(id);
  });
  router.get("!/focus/edit/:id", function (id) {
    createEdit(id);
  });
  router.get("!/edit/:id", function (id) {
    createEdit(id);
  });

  router.get("!/logout", function (id) {
    $.couch.logout({
      success : function() {
        document.location.href = "";
      }
    });
  });
    
  router.get("", function () {
    router.go("#!");
  });
  router.get("!", function () {
    showUser("", user.userCtx.name);
  });

  router.get("!/sync", function () {
    
    var details = getSyncDetails();
    if (isEmpty(details)) {
      render("#content", "#sync_tpl", {
        disabled : "disabled='disabled'",
        action   : "#restartsync",
        status   : "Not Configured",
        user     : {}
      });
    } else {
      $.couch.activeTasks({
        success : function (data) {
          if (data.length !== 0) {
            // Check the replications are for this instance
            details.action = "#pausesync";
            details.cssClass = "running";
            details.status = "Running, Press to pause";
          } else {
            details.action = "#restartsync";
            details.cssClass = "paused";
            details.status = "Paused, Press to restart";
          }
          render("#content", "#sync_tpl", details);
        }
      });
    }
  });
  
  router.get("!/team/:name", function (name) {
    showUser("/team/"+name, name);
  });

  router.get("!/signup", function () {
    render("#content", "#signup");
  });
  router.get("!/login", function () {
    render("#content", "#login_tpl");
  });

  router.get("!/team", function () {
    render("#content", "#users_tpl", {users:profiles});
  });

  router.get("!/focus", function () {
    fetch("focus-time", {descending:true, limit:25}, function(data) {
      render("#content", "#items_tpl", {
        title     : "Focus View",
        items     : viewToList(data),
        urlPrefix : "/focus"
      });
    });
  });

  router.get("!/mentions/:mention", function (mention) {
    showTagsOrMentions("mentions", mention);
  });

  router.get("!/tags/:tag", function (tag) {
    showTagsOrMentions("tags", tag);
  });

  router.get("!/tags", function () {
    fetch("mentions", {group_level:1}, function(mentions) {
      fetch("tags", {group_level:1}, function(tags) {
        render("#content", "#tags_tpl", {
          tags :     sizeUp(tags.rows),
          mentions : sizeUp(mentions.rows)
        });
      });      
    });
  });
  
  router.post("login", function (e, data) {
    $.couch.login({
      name     : data.email,
      password : data.password,
      success  : function() { window.location.reload(true); },
      error    : function() { notifyMsg("Invalid Login Credentials"); }
    });
  });
  
  router.post("edit", function(e, data) {
    var doc = docCache[data._id];
    doc.message = data.message;
    doc.state   = data.state;
    doc.profile = getProfile(data.assigned);
    doc.blocked = data.blocked == "on";
    doc.publish = data.publish == "on";
    doc.edit_at = new Date();
    doc.edit_by = user.userCtx.name;
    db.saveDoc(doc, {
      success : function(r) {
        router.go(getRedirectUrl());
        notifyMsg("Updated");
      }
    });
  });
  
  router.post("create", function(e) {
    var doc = {
      created_by : user.userCtx.name,
      created_at : new Date(),
      profile    : userDoc["couch.app.profile"],
      publish    : true,
      message    : $("#message").val(),
      state      : "now",
      type       : "task"
    };
    doc.profile.name = user.userCtx.name;
    db.saveDoc(doc, {
      success : function(r) {
        $("#message").val("");
        notifyMsg("Added new item");
      }
    });
  });


  router.post("select_workgroup", function (e, data) {
    var users = $.couch.db("_users");
    users.saveDoc(setWorkGroup(userDoc, "focus-"+ data.workgroup), {
      success: function() {
        window.location.reload(true);
      }
    });
  });
  
  router.post("restartsync", function () {
    $(".syncstatus").addClass("working").val("Starting ...");
    var u   = getSyncDetails().user,
        rem = "http://" + u.name + ":" + u.password + "@" + u.server + "/" + u.workgroup;
    
    postSync({source:rem, target:u.workgroup, continuous:true}, function(d1) {
      postSync({source:u.workgroup, target:rem, continuous:true}, function(d2) {
        router.refresh();
      });
    });

  });

  router.post("pausesync", function() {
    $(".syncstatus").addClass("working").val("Pausing ...");
    var u   = getSyncDetails().user,
        rem = "http://" + u.name + ":" + u.password + "@" + u.server + "/" + u.workgroup;
    postSync({source:rem, target:u.workgroup, continuous:true, cancel:true}, function(d1) {
      postSync({source:u.workgroup, target:rem, continuous:true, cancel:true}, function(d2) {
        router.refresh();
      });
    });
  });
  
  router.post("sync", function (e, data) {
    var details = {"user":data};
    localStorage.syncDetails = JSON.stringify(details);
  });
  
  router.post("delete", function (e, data) {
    db.removeDoc({_id: data._id, _rev: data._rev}, {
      success:function() {
        notifyMsg("deleted");
        router.go(getRedirectUrl());
      }
    });  
  });

  router.post("signup", function (e, data) {

    var user = {
      name:data.email,
      "couch.app.profile" : {
        rand         : Math.random().toString(),
        email        : data.email,
        nickname     : data.name,
        gravatar_url : 'http://www.gravatar.com/avatar/' +
          hex_md5(data.email) + '.jpg?s=40&d=identicon'
      }
    };

    user = setWorkGroup(user, "focus-"+ data.workgroup);
    
    $.couch.signup(user, data.password, {
      success: function() {
        window.location.reload(true);
      }
    });
  });          
  
  function setWorkGroup(obj, workgroup) {
    obj.apps = obj.apps || {};
    obj.apps.focus = obj.apps.focus || {
      workGroups        : [],
      selectedWorkGroup : null
    };
    
    obj.apps.focus.selectedWorkGroup = workgroup;
    obj.apps.focus.workGroups.push(workgroup);

    return obj;
  };
  
  function syncStatus(details, data) {
    
  };
  
  function postSync(obj, callback) { 
    $.ajax({
      type        : "POST",
      url         : urlPrefix + "_replicate",
      contentType : "application/json",
      dataType    : "json",
      data        : JSON.stringify(obj),
      success     : function(data) {
        callback(data);
      }
    });
  };
  
  function getSyncDetails() {
    return JSON.parse(localStorage && localStorage.syncDetails || "{}");
  };
  
  function getRedirectUrl() {
    var arr = window.location.hash.split("/");
    arr.pop();
    arr.pop();
    return arr.join("/");
  };
  
  function notifyMsg(msg) {
    $("#notify").html('<span/>').html(msg).show();
    setTimeout(function() { $("#notify").fadeOut(); }, 500);    
  };
  
  function createEdit(id) {
    $("body").addClass("editing");
    fetchId(id, function(data) {
      data.edited     = !!data.edit_at;
      data.created    = !!data.created_at;
      data.created_at = prettyDate(new Date(data.created_at));
      data.edit_at    = data.edit_at && prettyDate(new Date(data.edit_at))||"";
      data.users      = selectUsers(data.profile.name);
      data.states     = states(data.state);
      render("#content", "#edit_tpl", data);
      $("textarea[name=message]")[0].focus();
    });
  };

  function getProfile(name) {
    for (var tmp = [], i = 0; i < profiles.length; i += 1) {
      if (name === profiles[i].profile.name) {
        return profiles[i].profile;
      }
    }
    return false;
  }; 
  
  function showUser(prefix, name) {
    fetchList("done", name, function(done) {
      fetchList("now", name, function(now) {
        fetchList("later", name, function(later) {
          
          var isSelf    = name === user.userCtx.name,
              tmpRender = function(view) {
                return Mustache.to_html($("#items_tpl").html(), {
                  urlPrefix : prefix,
                  items     : viewToList(view, isSelf)
                });
              };
          
          render("#content", "#overview_tpl", {
            profile : isSelf ? false : getProfile(name),
            done    : tmpRender(done),
            now     : tmpRender(now),
            later   : tmpRender(later)
          });
        });
      });
    });
  }
  
  function fetchList(list, name, cb) {
    var args = (list === "done") ?
      { descending : true,
        startkey   : JSON.stringify([name, list, {}]),
        endkey     : JSON.stringify([name, list, daysAgo(7)])
      } : {
        descending : true,
        endkey     : JSON.stringify([name, list]),
        startkey   : JSON.stringify([name, list, {}]) };

    fetch("focus-user-state-created", args, cb);
  };

  function isEmpty(obj) {
    for(var prop in obj) {
      if(obj.hasOwnProperty(prop))
        return false;
    }
    
    return true;
  };
  
  function daysAgo(days) {
    var d = new Date();
    return new Date(
      new Date((d.getMonth()+1) + "/" + d.getDate() + "/" + d.getFullYear())
               - (24 * 60 * 60 * days * 1000));
  };
  
  function viewToList(data, isSelf) {
    for (var obj, tmp = [], i = 0; i < data.rows.length; i += 1) {
      obj = data.rows[i].value;
      docCache[obj._id] = cloneObj(obj);
      obj.states    = states(obj.state);
      obj.message   = linkUp(obj.message);
      obj.published = obj.publish ? "published" : "unpublished";
      obj.blocked   = obj.blocked ? "blocked" : "";
      obj.isSelf    = isSelf ? "isSelf" : "isNotSelf";
      
      if (isSelf || (!isSelf && obj.publish)) {
        tmp.push(obj);
      }
    }
    return tmp;
  };
      
  function showTagsOrMentions(view, key) {

    var pre  = (view === "tags") ? "#" : "@",
        args = {
          descending : true,
          reduce     : false,
          endkey     : JSON.stringify([key]),
          startkey   : JSON.stringify([key, {}])
        };
    
    fetch(view, args, function(data) {
      render("#content", "#items_tpl", {
        title     : "Viewing '" + pre + key + "'",
        items     : viewToList(data),
        urlPrefix : "/" + view + "/" + key
      });
    });
  };
  
  function selectUsers(name) {
    for (var tmp = [], i = 0; i < profiles.length; i += 1) {
      tmp.push({
        selected : (name === profiles[i].profile.name) ? selected : "",
        profile  : profiles[i].profile,
        name     : profiles[i].profile.name
      });
    }
    return tmp;
  };
  
  function states(current) {
    var states = ["done", "now", "later"];
    for (var arr = [], i = 0; i < states.length; i += 1) {
      arr.push({
        state    : states[i],
        selected : (states[i] === current) ? selected : ""
      });
    }
    return arr;
  };
  
  function sizeUp(arr) {
    for (var size, tmp = [], i = 0; i < arr.length; i += 1) {
        size = arr[i].value;
        tmp.push({
            name : arr[i].key,
            size : (size * 4) + 10 > 150 ? 150 : (size * 4) + 10
        });
    }
    return tmp;
  };

  function fetchId(id, callback) {
    if (typeof docCache[id] === "undefined") {
      $.getJSON(urlPrefix + dbName + "/" + id, function (data) {
        docCache[id] = data;
        callback(cloneObj(docCache[id]));
      });
    } else {
      callback(cloneObj(docCache[id]));
    }
  };
  
  function fetch(view, opts, callback) {

    var id = view + JSON.stringify(opts),
        url = urlPrefix + dbName + "/_design/focus/_view/" + view;
    
    if (typeof xhrCache[id] === "undefined") {
      opts.random = new Date().getTime();
      $.get(url, opts, function (data) {
        xhrCache[id] = data;
        callback(cloneObj(xhrCache[id]));
      }, "json");
    } else {
      callback(cloneObj(xhrCache[id]));
    }
  };

  function urlChange(verb, url, args) {

    if (verb === "GET") {

      $("body").removeClass("editing");
      $("#content").addClass("loading");
        
      // nasty way of figuring out what nav should be highlighted
      // can do a nicer way
      var selected = (url === "!/")   ? "navmine" :
        (url.indexOf("focus") !== -1) ? "navall" : 
        (url.indexOf("team") !== -1)  ? "navteam" : 
        (url.indexOf("tags") !== -1)  ? "navtags" : "navmine";
      
      $(".selected").removeClass("selected");
      if (selected) {
        $("." + selected).addClass("selected");
      }

      if(!ensureLoggedIn(verb, url, args)) {
        return false;
      } else { 
        if (url !== "!/signup" && dbName === null) {
          render("#content", "#select_workgroup");
          return false;
        }
      }
      return true;
    } else {
      return ensureLoggedIn(verb, url, args);
    }
  };
  
  function ensureLoggedIn(verb, url, args) {
    if (verb === 'GET' && user === null && url !== "!/signup") {
      render("#content", "#login_tpl");
      return false;
    }
    return true;
  };
  
  function render(dom, tpl, data) {
    $("#content").removeClass("loading");
    $(dom).html(Mustache.to_html($(tpl).html(), data));
  };
  
  function cloneObj(obj) {
    return jQuery.extend(true, {}, obj);
  };
  
  function loadUser() {
    $.getJSON(urlPrefix + "_session/", function (data) {

      if (data && data.userCtx && data.userCtx.name !== null) {
        
        user = data;
        var users = $.couch.db("_users");
        $("header, #footer").show();
        
        users.openDoc("org.couchdb.user:" + user.userCtx.name, {
          success: function (userObj) {

            userDoc = userObj;
            
            if (userObj.apps && userObj.apps.focus) {
              dbName = userObj.apps.focus.selectedWorkGroup;
              db = $.couch.db(dbName);
              loadUsers(router.init);
              initComet();
            } else {
              router.init();
            }
          }
        });
      } else {
        router.init();
      }
    });
  };
  
  function loadUsers(callback) {
    fetch("user-created", {group:true}, function(users) {
      for (var keys = [], i = 0; i < users.rows.length; i += 1) {
        keys.push(users.rows[i].value);
      }
      
      $.ajax({
        type        : "POST",
        url         : urlPrefix + dbName + "/_all_docs?include_docs=true",
        contentType : "application/json",
        dataType    : "json",
        data        : JSON.stringify({keys:keys}),
        success     : function(data) {
          for (i = 0; i < data.rows.length; i += 1) {
            profiles.push(data.rows[i].doc);
          }
          callback();
        }
      });      
    });
  };  
  
  function badComet(seq) {
    $.ajax({
      url      : urlPrefix + dbName + "/_changes",
      data     : {heartbeat: 10000, feed:"longpoll", since: seq},
      method   : "GET",
      dataType : "json",
      success  : function(data) {
        if (data) { 
          xhrCache = {};
          docCache = {};
          // Bit of a hack, dont refresh the form while people are editing
          if (window.location.hash.indexOf("/edit/") === -1) {
            router.refresh(true);
          }
          badComet(data.last_seq);
        }
      }
    });
  };

  function initComet() { 
    db.info({
      "success": function (data) {
        setTimeout(function () { badComet(data.update_seq); }, 100);
      }
    });
  };

  // I dont like these global events, they are bound to the page permanently
  // so may cause conflicts
  function bindEvents() {
    
    $(document).bind("mousedown", function (e) {
      var item = $(e.target).is("div.item")
        ? $(e.target)
        : $(e.target).parents("div.item");
      if (e.target.nodeName !== "A" && item.length !== 0) {
        router.go(document.location.hash + "/edit/" + item.attr("data-id"));
      } else if ($(e.target).is("input[name=delete]")) {
        $("#deleteform").submit();
      }
    });

    $(document).bind("change", function(e) {
      $("#avapreview").attr("src", getProfile($(e.target).val()).gravatar_url);
    });

    $("input").live("blur", function (e) {
      if ($(e.target).attr("id") === "gravatar_entry") {
        $("#gravatar_preview")
          .attr("src", 'http://www.gravatar.com/avatar/'
                + hex_md5($(e.target).val()) + '.jpg?s=40&d=identicon');
      }
    });

  };
  
  window.onload = function () {
    setTimeout(loadUser, 500);
  };
    
  bindEvents();

})();