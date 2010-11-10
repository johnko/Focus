var Focus = (function () {

  var dbName     = "focus",
      mobilePass = "couch!db",
      adminParty = null,
      urlPrefix  = "/",
      isMobile   = isMobile(),
      router     = new Router(),
      userDoc    = null,
      avatars    = {},
      profiles   = [],
      showNav    = false,
      db         = $.couch.db(dbName);
      
  var xhrCache = {},
      docCache = {};

  var selected = "selected='selected'";
  
  router.pre(urlChange);
  router.error404(function (verb, url) {
    if (verb === "GET") { 
      render("#error404", {url:url});
    } else {
      console.error(verb, url);
    }
  });
  
  router.get(/edit\/([a-z0-9]+)$/, createEdit);

  router.get(/^(!)?$/, function () {
    showUser(/^(!)?$/, "", userDoc.name);
  });
  
  router.get("!/logout", function (id) {
    $.couch.logout({
      success : function() {
        document.location.href = "";
      }
    });
  });  

  router.get("!/sync", function () {
    var details = getSyncDetails();
    $.couch.activeTasks({
      success : function (data) {
        if (data.length >= 2) {
          // Check the replications are for this instance (if possible)
          details.cssClass = "running";
        } else {
          details.cssClass = "paused";
        }
        details.workgroup = details.workgroup || "focus";
        renderIfUrl("!/sync", "#sync_tpl", details);
      },
      error : function () {
        renderIfUrl("!/sync", "#sync_denied");
      }
    });
  });
  
  router.get("!/team/:name", function (name) {
    showUser("!/team/:name", "/team/" + name, name);
  });

  router.get("!/signup", function () {
    if (userDoc !== null) {
      router.go("#!");
    } else {
      showNav = false;
      renderSignup();
    }
  });
  router.get("!/login", function () {
    if (userDoc !== null) {
      router.go("#!");
    } else {
      showNav = false;
      render("#login_tpl", {});
    }
  });

  router.get("!/team", function () {
    renderIfUrl("!/team", "#users_tpl", {users:profiles});
  });

  router.get("!/focus", function () {
    fetch("focus-time", {descending:true, limit:25}, function(data) {
      renderIfUrl("!/focus", "#items_tpl", {
        title     : "Focus View",
        items     : viewToList(data),
        urlPrefix : "/focus"
      });
    });
  });
  
  router.get("!/(tags|mentions)/:tag", function (type, val) {
    showTagsOrMentions(type, val);
  });

  router.get("!/tags", function () {
    fetch("mentions", {group_level:1}, function(mentions) {
      fetch("tags", {group_level:1}, function(tags) {
        renderIfUrl("!/tags", "#tags_tpl", {
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
    doc.edit_by = userDoc.name;
    db.saveDoc(doc, {
      success : function(r) {
        router.go(getRedirectUrl());
        notifyMsg("Updated");
      }
    });
  });
  
  router.post("create", function(e) {
    var doc = {
      created_by : userDoc.name,
      created_at : new Date(),
      profile    : userDoc["couch.app.profile"],
      publish    : true,
      message    : $("#message").val(),
      state      : "now",
      type       : "task"
    };

    if (avatars[doc.profile.email]) { 
      doc.profile.gravatar_url = "../../" + doc.profile.email +
        "_gravatar/avatar.png";
    }

    doc.profile.name = userDoc.name;
    db.saveDoc(doc, {
     success : function(r) {
       $("#message").val("");
       notifyMsg("Added new item");
     }
    });
  });

  router.post("select_workgroup", function (e, data) {
    var users = $.couch.db("_users");
    users.saveDoc(setWorkGroup(userDoc,"focus-" + data.workgroup), {
      success: function() {
        window.location.reload(true);
      }
    });
  });  
  
  router.post("sync", function (e, data) {
    if (!userDoc.focus) {
      userDoc.focus = {};
    }
    userDoc.focus.syncDetails = {
      name      : data.name,
      password  : data.password,
      server    : data.server,
      workgroup : data.workgroup
    };
    $.couch.db("_users").saveDoc(userDoc);

    var $button = $("#syncbtns button[data-action="+data.action+"]");
    $button.addClass("working");

    if (data.action === "pull") {
      replicate(remoteSyncUrl(), data.workgroup, false, function () {
        $button.removeClass("working");
        notifyMsg("Replication Complete");
      });
    } else if (data.action === "push") {
      replicate(data.workgroup, remoteSyncUrl(), false, function () {
        $button.removeClass("working");
        notifyMsg("Replication Complete");
      });      
    } else if (data.action === "sync") {
      replicate(data.workgroup, remoteSyncUrl(), true, function () {
        window.location.reload(true);
      });
    }
  });
  
  router.post("delete", function (e, data) {
    db.removeDoc({_id: data._id, _rev: data._rev}, {
      success: function() {
        notifyMsg("deleted");
        router.go(getRedirectUrl());
      }
    });  
  });

  router.post("save_profile", function (e, data) {
    userDoc["couch.app.profile"] = makeCouchAppProfile(data.name, data.email);
    $.couch.db("_users").saveDoc(userDoc, {
      success: function() { window.location.reload(true); }
    });
  });
  
  router.post("signup", function (e, data) {

    data.password = isMobile ? mobilePass : data.password;
    
    var workgroup = "focus",
        user = {
          name : data.email,
          "couch.app.profile" : makeCouchAppProfile(data.name, data.email)
        };
    
    var signUp = function() {
      $.couch.signup(user, data.password, {
        success: function() {
          $.couch.login({
            name     : data.email,
            password : data.password,
            success  : function() { window.location.reload(true); }
          }); 
        }
      });
    };
    
    if (adminParty) { 
      $.ajax({
        type        : "PUT",
        url         : urlPrefix + "_config/admins/" + data.email,
        contentType : "application/json",
        data        : '"' + data.password + '"',
        success     : function(data) { signUp(); }
      });
    } else {
      signUp();
    }
  });

  function replicate(source, target, continous, callback) {
    
    var opts = (continous ? {continous:true} : {});
    
    $.couch.replicate(source, target, opts, {
      create_target : true,
      error: function() {
        console.log(arguments);
      },
      success: function (data) {
        if (continous) {
          db.replicate(target, source, opts, callback);
        } else {
          callback(data);
        }
      }
    });
  };
  
  function makeCouchAppProfile(name, email) {
    return {
      rand         : Math.random().toString(),
      email        : email,
      nickname     : name,
      gravatar_url : 'http://www.gravatar.com/avatar/' +
        hex_md5(email) + '.jpg?s=40&d=identicon'
    };
  };
  
  function remoteSyncUrl() {
    var x = getSyncDetails();
    return "http://" + x.name + ":" + x.password + "@"
      + x.server + "/" + x.workgroup;
  };
  
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
  
  function getSyncDetails() {
    return userDoc.focus && userDoc.focus.syncDetails || {};
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
      render("#edit_tpl", data);
    });
  };

  function getProfile(name) {
    for (var tmp = [], i = 0; i < profiles.length; i += 1) {
      if (name === profiles[i].profile.name) {
        return profiles[i].profile; 
      } 
      return false;
    }
  }; 
  
  function showUser(urlCheck, prefix, name) {
    fetchList("done", name, function(done) {
      fetchList("now", name, function(now) {
        fetchList("later", name, function(later) {      
          var isSelf    = name === userDoc.name,
              tmpRender = function(view) {
                return Mustache.to_html($("#items_tpl").html(), {
                  urlPrefix : prefix,
                  items     : viewToList(view, isSelf)
                });
              };
          
          renderIfUrl(urlCheck, "#overview_tpl", {
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
      if(obj.hasOwnProperty(prop)) { 
        return false;
      }
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
      render("#items_tpl", {
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

  function anonAccess(url) {
    return url === "!/signup" || url === "!/login";
  };
  
  function urlChange(verb, url, args) {

    if (verb === "GET") {

      $("body").removeClass("editing");
      
      // nasty way of figuring out what nav should be highlighted
      // can do a nicer way
      var selected = (url === "!" || url === "") ? "navmine" :
        (url.indexOf("focus") !== -1) ? "navall" : 
        (url.indexOf("team") !== -1)  ? "navteam" : 
        (url.indexOf("sync") !== -1)  ? "navshare" : 
        (url.indexOf("tags") !== -1)  ? "navtags" : false;
      
      $(".selected").removeClass("selected");
      if (selected) {
        $("." + selected).addClass("selected");
      }
      
      if(!ensureLoggedIn(verb, url, args)) {
        return false;
      } else if (userDoc && userDoc["couch.app.profile"] === undefined) {
        render("#edit_profile");
        return false;
      }
      showNav = true;
      return true;
    } else {
      return ensureLoggedIn(verb, url, args);
    }
  };
  
  function ensureLoggedIn(verb, url, args) {
    if (verb === 'GET' && userDoc === null && !anonAccess(url)) {
      renderSignup();
      return false;
    }
    return true;
  };

  function renderSignup() {
    render("#signup", (!isMobile ? {} : {
      display_pass : "style='display:none'",
      password     : mobilePass
    }));
  };

  function renderIfUrl(url, tpl, data) {
    if (router.matchesCurrent(url)) { 
      render(tpl, data);
    }
  };
  
  function render(tpl, data) {
    if (showNav) {
      $("header, #footer").show();        
    } else {
      $("header, #footer").hide();
    }
    $("#content").html(Mustache.to_html($(tpl).html(), data));
    $("#contentwrapper").removeClass("loading");
  };
  
  function cloneObj(obj) {
    return jQuery.extend(true, {}, obj);
  };

  function isAdminParty(obj) {
    return obj.userCtx.name === null &&
      obj.userCtx.roles.indexOf("_admin") !== -1;
  };

  function loadGravatar(path, callback) {
    $.get('http://seivadnosaj.appspot.com/proxy', {url: path}, function(data) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement("canvas"),
            ctx = canvas.getContext("2d"), 
            w = img.width,
            h = img.height;
        $(canvas).attr('width', w).attr('height', h);
        ctx.width = w;
        ctx.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        var dataURL = canvas.toDataURL("image/png");
        callback(dataURL.replace(/^data:image\/(png|jpg);base64,/, ""));
      };
      img.src = data;
    }, 'jsonp');
  };
  
  function loadUser(name) {
    $.couch.db("_users").openDoc("org.couchdb.user:" + name, {
      success: function (userObj) {
        userDoc = userObj;
        loadUsers(router.init);
        initComet();
      }
    });
  };

  // Mobile users are automatically logged in
  function autoLogin() {
    $.couch.db("_users").allDocs({          
      include_docs: true,
      success: function (data) {
        if (data.rows.length > 1) {
          $.couch.login({
            name     : data.rows[1].doc.name,
            password : mobilePass,
            success  : function () {}
          });
        } else {
          router.init();
        }
      }
    });
  };
  
  function checkSession() {
    $.couch.session({
      success : function (data) {
        adminParty = isAdminParty(data);
        if (data.userCtx.name !== null) {
          loadUser(data.userCtx.name);
        } else if (isMobile) {
          autoLogin();
        } else {
          router.init();
        }
      }
    });
  };
  
  function loadUsers(callback) {
    fetch("gravatars", {include_doc:true}, function(data) {
      for (var i = 0; i < data.rows.length; i += 1) {
        avatars[data.rows[i].value.email] = data.rows[i].value;
      }
      var profile = userDoc["couch.app.profile"];
      if (profile && !avatars[profile.email]) {
        loadGravatar(profile.gravatar_url, function (img) {
          var obj = {
            type  : "gravatar",
            _id   : profile.email + "_gravatar",
            email : profile.email,
            _attachments : {
              "avatar.png" : { 
                data         : img,
                content_type : "image\/png"
              }
            }
          };
          db.saveDoc(obj);
        });
      }
    });

    fetch("user-created", {group:true}, function(users) {
      for (var keys = [], i = 0; i < users.rows.length; i += 1) {
        keys.push(users.rows[i].value);
      }

      db.allDocs({
        keys         : keys,
        include_docs : true,
        success      : function (data) {
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
          var hash = window.location.hash;
          // Bit of a hack, dont refresh the form while people are editing
          if (hash.indexOf("/edit/") === -1 || hash.indexOf("/sync") === -1) {
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
        badComet(data.update_seq);
      }
    });
  };

  function isMobile() {
    return navigator.userAgent.toLowerCase()
      .match(/(android|iphone|ipod|ipad)/) !== null;
  };
    
  // I dont like these global events, they are bound to the page permanently
  // so may cause conflicts
  function bindDomEvents() {
    
    $(document).bind("mousedown", function (e) {
      
      var $obj = $(e.target),
          item = $obj.is("div.item") ? $obj : $obj.parents("div.item");
      
      if ($obj.not("a") && item.length !== 0) {
        router.go(document.location.hash + "/edit/" + item.attr("data-id"));
      } else if ($obj.is("input[name=delete]")) {
        $("#deleteform").submit();
      } else if ($obj.is("button.syncbtn")) {
        $("#syncaction").val($obj.attr("data-action"));
      }
    });
    
    $(document).bind("change", function(e) {
      if ($(e.target).attr("data-gravatar")) {
        $("#avapreview")
          .attr("src", getProfile($(e.target).val()).gravatar_url);
      }
    });
    
    $("input").live("blur", function (e) {
      var $name = $("#signup_name"), $obj = $(e.target);
      if ($obj.attr("id") === "signup_email") {
        $("#gravatar_preview")
          .attr("src", 'http://www.gravatar.com/avatar/'
                + hex_md5($obj.val()) + '.jpg?s=40&d=identicon');
        if ($name.val() === "") {
          $name.val($obj.val().split("@")[0]);
        }
      } 
    });
  };
  
  bindDomEvents();

  // TODO: Test for being inside webkit with browser chrome visible
  // (gets rid of loading bar)
  if (false) {
    window.onload = function () { setTimeout(checkSession, 500); };
  } else { 
    checkSession();
  }
  
})();