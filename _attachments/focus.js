var Focus = (function () {

  var dbName = "focus",
      router = new Router(),
      user   = null,
      profile = null,
      profiles = [],
      users = null,
      db     = $.couch.db(dbName);

  var xhrCache = {},
      docCache = {};
  
  router.pre(urlChange);

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
        user = null;
        document.location.href = "";
      }
    });
  });
    
  // should also combine these
  router.get("", function () {
    window.location.hash = "#!";
  });
  router.get("!", function () {
    showUser("", user.userCtx.name);
  });

  router.get("!/team/:name", function (name) {
    showUser("/team/"+name, name);
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
  
  router.post("login", function (e) {
    $.couch.login({
      name     : $(e.target).find("[name='name']").val(),
      password : $(e.target).find("[name='password']").val(),
      success  : function() {
        window.location.reload(true);
      },
      error    : function() {
        notifyMsg("Invalid Login Credentials");
      }
    });
  });

  router.post("edit", function(e, data) {
    var doc = docCache[data._id];
    doc.message = data.message;
    doc.state = data.state;
    doc.profile = getProfile(data.assigned);
    doc.blocked = data.blocked == "on";
    doc.publish = data.publish == "on";
    doc.edit_at = new Date();
    doc.edit_by = user.userCtx.name;
    db.saveDoc(doc, {
      success : function(r) {
        window.location.hash = getRedirectUrl();
        notifyMsg("Updated: "+doc.message);
      }
    });
  });
  
  router.post("create", function(e) {
    var doc = {
      created_at : new Date(),
      profile : getProfile(user.userCtx.name),
      publish : false,
      message : $("#message").val(),
      state : "now",
      type : "task"
    };
    doc.profile.name = user.userCtx.name;
    db.saveDoc(doc, {
      success : function(r) {
        $("#message").val("");
        notifyMsg('New item: </span>'+doc.message);
      }
    });
  });
  
  router.post("delete", function (e) {
    var doc = {
      _id  : $(e.target).find("[name='_id']").val(),
      _rev : $(e.target).find("[name='_rev']").val()
    };
    db.removeDoc(doc, {
      success:function() {
        notifyMsg("deleted");
        window.location.hash = getRedirectUrl();
      }
    });  
  });

  function getRedirectUrl() {
    var arr = window.location.hash.split("/");
    arr.pop();
    arr.pop();
    return arr.join("/");
  };
  
  function notifyMsg(msg) {
    $("#notify").html('<span/>').html(msg).show();
    setTimeout(function() { 
      $("#notify").fadeOut();
    }, 3000);    
  };
  
  function createEdit(id) { 
    fetchId(id, function(data) {
      fetchUsers(data.profile.name, function(users) {
        data.users = users;
        data.states = makeState(data.state);
        render("#content", "#edit_tpl", data);
        $("textarea[name=message]")[0].focus();
      });
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
          var tpl = $("#items_tpl").html();
          var isSelf = name === user.userCtx.name;
          render("#content", "#overview_tpl", {
            profile : isSelf ? false : getProfile(name),
            done  : Mustache.to_html(tpl, {urlPrefix:prefix,
                                           items:viewToList(done, isSelf)}),
            now   : Mustache.to_html(tpl, {urlPrefix:prefix,
                                           items:viewToList(now, isSelf)}),
            later : Mustache.to_html(tpl, {urlPrefix:prefix,
                                           items:viewToList(later, isSelf)})
          });
        });
      });
    });
  }
  
  function fetchList(list, name, cb) {
    var args = (list === "done") ?
      { descending:true,
        startkey:JSON.stringify([name, list, {}]),
        endkey:JSON.stringify([name, list, daysAgo(7)])
      } : {
        descending:true,
        endkey:JSON.stringify([name, list]),
        startkey:JSON.stringify([name, list, {}]) };

    fetch("focus-user-state-created", args, cb);
  };

  function daysAgo(days) {
    return new Date(new Date() - (24 * 60 * 60 * days * 1000));
  };
  
  function viewToList(data, isSelf) {
    for (var obj, tmp = [], i = 0; i < data.rows.length; i += 1) {
      obj = data.rows[i].value;
      docCache[obj._id] = cloneObj(obj);
      obj.states = makeState(obj.state);
      obj.message = linkUp(obj.message);
      obj.published = obj.publish ? "published" : "unpublished";
      obj.isSelf = isSelf ? "isSelf" : "isNotSelf";
      if (isSelf || (!isSelf && obj.publish)) {
        tmp.push(obj);
      }
    }
    return tmp;
  };
      
  function showTagsOrMentions(view, key) {

    var args = {
      descending : true,
      reduce     : false,
      endkey     : JSON.stringify([key]),
      startkey   : JSON.stringify([key, {}])
    };
    
    fetch(view, args, function(data) {
      render("#content", "#items_tpl", {
        title     : "Viewing \"" + ((view === "tags") ? "#" : "@") + key + "\"",
        items     : viewToList(data),
        urlPrefix : "/" + view + "/" + key
      });
    });
  };
  
  function fetchUsers(name, callback) {
    for (var tmp = [], i = 0; i < profiles.length; i += 1) {
      tmp.push({
        selected: (name === profiles[i].profile.name)
          ? 'selected="selected"' : "",
        profile:profiles[i].profile,
        name:profiles[i].profile.name
      });
    }
    callback(tmp);
  };
  
  function loadUsers(callback) {
    
    // Alternative version based on users table, fixes the "you have to have
    // created a ticket to be assigned" bug, but doesnt replicate nicely
    //   var f = function(users) {
    //     for (var i = 0; i < users.length; i++) {
    //       if (users[i].name === "name") {
    //         users[i].selected = "selected='selected'";
    //       }
    //     }
    //     callback(users);
    //   };
    
    //   if (users) {
    //     f(users.slice(0));
    //   } else {
    //     $.getJSON("/_users/_all_docs", {include_docs:true}, function(data) {
    //       for (var arr = [], i = 0; i < data.rows.length; i++) {
    //         if (data.rows[i].doc && data.rows[i].doc.type === "user") { 
    //           arr.push(data.rows[i].doc);
    //         }
    //       }
    //       users = arr;
    //       f(users.slice(0));
    //     });
    //   }
    // };
    
    // fetch("user-created", {group_level:1}, function(users) {
    //   for (var tmp = [], i = 0; i < users.rows.length; i += 1) {
    //     tmp.push({
    //       selected: (name === users.rows[i].key[0]) ? 'selected="selected"' : "",
    //       profile:users.rows[i].value.profile,
    //       name:users.rows[i].key[0]
    //     });
    //   }
    //   callback(tmp);
    // });
    
    fetch("user-created", {group:true}, function(users) {
      for (var tmp = [], i = 0; i < users.rows.length; i += 1) {
        tmp.push(users.rows[i].value);
      }
      
      $.post("/" + dbName + "/_all_docs?include_docs=true", JSON.stringify({keys:tmp}), function(data) {
        for (i = 0; i < data.rows.length; i += 1) {
          profiles.push(data.rows[i].doc);
        }
        callback();
      }, "json");
    });
  };
  
  
  function makeState(current) {
    var states = ["done", "now", "later"];
    for (var arr = [], i = 0; i < states.length; i += 1) {
      arr.push({
        state:states[i],
        selected: (states[i] === current) ? 'selected="selected"' : ""
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
      $.getJSON("/"+dbName+"/"+id, function (data) {
        docCache[id] = data;
        callback(cloneObj(docCache[id]));
      });
    } else {
      callback(cloneObj(docCache[id]));
    }
  };
  
  function fetch(view, opts, callback) {

    var id = view + JSON.stringify(opts),
        url = "/" + dbName + "/_design/" + dbName + "/_view/" + view;
    
    if (typeof xhrCache[id] === "undefined") {
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

      $("#content").addClass("loading");
      
      var selected = (url === "!/") ? "navmine" :
        (url.indexOf("focus") !== -1) ? "navall" : 
        (url.indexOf("team") !== -1) ? "navteam" : 
        (url.indexOf("tags") !== -1) ? "navtags" : "navmine"; 
      
      $(".selected").removeClass("selected");
      if (selected) {
        $("." + selected).addClass("selected");
      }
    }
    return ensureLoggedIn(verb, url, args);
  };
  
  function ensureLoggedIn(verb, url, args) {
    if (verb === 'GET' && user === null) {
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
    $.getJSON("/_session/", function (data) {
      if(data && data.userCtx && data.userCtx.name !== null) {
        user = data;
        loadUsers(function () {
          router.init();
        });
      } else { 
        router.init();
      }
    });
  };
  
  // this must be a nasty way of invalidating views, cant really
  // see if incremental view updates are possible
  function badComet(seq) {
    var url = "/" + dbName + "/_changes?heartbeat=10000&" +
      "&feed=longpoll&since=" + seq;
    $.ajax({
      url      : url,
      method   : "GET",
      dataType : "json",
      error    : function() { },
      success  : function(data) {
        if (data) { 
          xhrCache = {};
          docCache = {};
          // Bit of a hack
          if (window.location.hash.indexOf("/edit/") === -1) {
            router.refresh();
          }
          badComet(data.last_seq);
        }
      }
    });
  };

  function initComet() { 
    db.info({
      "success": function(data) {
        setTimeout(function() { 
          badComet(data.update_seq);
        }, 100);
      }
    });
  };

  function bindEvents() {
    
    $(document).bind("mousedown", function (e) {
      // can get rid of this now that items dont have embedded forms
      var item = $(e.target).is("div.item")
        ? $(e.target) : $(e.target).parents("div.item");
      if (e.target.nodeName !== "A" && item.length !== 0) {
        document.location.hash =
          document.location.hash + "/edit/" + item.attr("data-id");
      } else if ($(e.target).is("input[name=delete]")) {
        $("#deleteform").submit();
      }
    });

    $(document).bind("change", function(e) {
      $("#avapreview").attr("src", getProfile($(e.target).val()).gravatar_url);
    });
  };
  
  loadUser();
  setTimeout(initComet, 500);
  bindEvents();

  // Scroll past the url bar
  setTimeout(function () {
    $('html, body').animate({scrollTop: 1});
  }, 200);
  
})();