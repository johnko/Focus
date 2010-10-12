// Err a little NIH, some of the regex stuff is from sammy, but I only
// wanted the routing, and the way sammy implemented routing isnt
// great for my cpu (it polls by default even when the hashchange
// is supported)
var Router = (function() {
  
  var PATH_REPLACER = "([^\/]+)",
      PATH_MATCHER  = /:([\w\d]+)/g,
      preRouterFur  = null,
      fun404        = null,
      routes        = {GET: [], POST: []};
    
  // Needs namespaced and decoupled and stuff
  function init() {
    $(window).bind("hashchange", urlChanged).trigger("hashchange");
    $(document).bind("submit", formSubmitted);
  };
  
  function get(path, cb) {
    route("GET", path, cb);
  };
  
  function post(path, cb) {
    route("POST", path, cb);
  };

  function refresh(maintainScroll) {
    urlChanged(maintainScroll);
  };

  function preRouter(fun) {
    preRouterFun = fun;
  };

  function error404(fun) {
    fun404 = fun;
  };
  
  function route(verb, path, cb) {
    
    path = (path.constructor == String)
      ? new RegExp("^"+path.replace(PATH_MATCHER, PATH_REPLACER)+"$")
      : path;
    
    routes[verb].push({
      path     : path,
      callback : cb
    });
  };
    
  function urlChanged(maintainScroll) {
    trigger("GET", window.location.hash.slice(1));
    if (!maintainScroll) { 
      window.scrollTo(0,0);
    }
  };
  
  function formSubmitted(e) {
    
    e.preventDefault();
    var action = e.target.getAttribute("action");
    
    if (action[0] === "#") {
      trigger("POST", action.slice(1), e, serialize(e.target));
    }
  }

  function trigger(verb, url, ctx, data) {
    if (preRouterFun) {
      if (!preRouterFun(verb, url, ctx)) {
        return;
      }
    }
    var match = matchPath(verb, url);
    if (match) {
      var args = match.match.slice(1);
      if (verb === "POST") {
        args.unshift(data);
        args.unshift(ctx);
      }
      match.details.callback.apply(this, args);
    } else {
      if (fun404) {
        fun404(verb, url);
      }
    }
  };

  function matchPath(verb, path) {
    var i, tmp, arr = routes[verb];
    for (i = 0; i < arr.length; i += 1) {
      tmp = path.match(arr[i].path);
      if (tmp) {
        return {"match":tmp, "details":arr[i]};
      }
    }
    return false;
  };
  
  function serialize(obj) {
    var o = {};
    var a = $(obj).serializeArray();
    $.each(a, function() {
      if (o[this.name]) {
        if (!o[this.name].push) {
          o[this.name] = [o[this.name]];
        }
        o[this.name].push(this.value || '');
      } else {
        o[this.name] = this.value || '';
      }
    });
    return o;
  };
    
  return {
    get     : get,
    post    : post,
    init    : init,
    pre     : preRouter,
    refresh : refresh,
    error404 : error404
  };
  
});

function linkUp(body, person_prefix, tag_prefix) {

  //body = Mustache.escape(body);
  person_prefix = person_prefix || "#!/mentions/";
  tag_prefix = tag_prefix || "#!/tags/";
  
  var tmp = body.replace(/((ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?)/gi,function(a) {
    return '<a target="_blank" href="'+a+'">'+a+'</a>';
  });
  
  function transformText(str) {
    return str.replace(/\@([\w\-]+)/g, function(user,name) {
      return '<a href="'+person_prefix+encodeURIComponent(name)+'">'+user+'</a>';
    }).replace(/\#([\w\-\.]+)/g,function(word,tag) {
      return '<a href="'+tag_prefix+encodeURIComponent(tag)+'">'+word+'</a>';
    });
  };
  
  function replaceTags(dom) {
    var i, tmp;
    for (i = 0; i < dom.childNodes.length; i++) {
      tmp = (dom.childNodes[i].nodeType === 3 &&
             $(dom.childNodes[i]).parents("a").length === 0) 
        ? $("<span>"+transformText(dom.childNodes[i].textContent)+"</span>")[0]
        : replaceTags(dom.childNodes[i]);
      
      dom.replaceChild(tmp, dom.childNodes[i]); 
    }
    return dom;
  };
  
  var div = document.createElement("div");
  div.innerHTML = tmp;
  return replaceTags(div).innerHTML;
  
  //return tmp;
}