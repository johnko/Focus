var Focus = (function () {
  
  function hashChanged(name) {
    
    var hash     = window.location.hash.slice(1),
        selected = (hash === "/focus/" + name) ? "mine" // Ugly, tmp
      : (hash === "/focus") ? "all"
      : (hash === "/tags") ? "tags"
      : (hash.indexOf("/team") !== -1) ? "team"
      : (hash.indexOf("/focus/") !== -1) ? "team" : false;
    
    $(".selected").removeClass("selected");
    if (selected) { 
      $("."+selected).addClass("selected");
    }
  };

  function notifyMsg(msg) {
    $("#profile .saved").html('<span/>').html(msg).show();
    setTimeout(function() { 
      $("#profile .saved").fadeOut();
    }, 3000);    
  };
  
  return {
    hashChanged : hashChanged,
    notifyMsg : notifyMsg
  };
})();

$.evently.changesOpts.include_docs = true;
$.evently.log = true;

setTimeout(function() {
    
  $.couch.app(function(app) {


    Focus.linkUp = app.require("vendor/couchapp/lib/linkup");
      
    $("#account").evently("account", app);
    $("#profile").evently("profile", app);
    $("#nav").evently("nav", app);
    $("#items").evently("items", app);
    
    $.evently.connect("#account","#profile", ["loggedIn","loggedOut"]);
    $.evently.connect("#account","#nav", ["loggedIn","loggedOut"]);
    
    $("#account").bind("loggedIn", function() {
      $("body").trigger("evently-changes-"+app.db.name);
    });
    
    $("#account").bind("loggedOut", function() {
      $("body").trigger("evently-changes-"+app.db.name);
    });
    
    $.pathbinder.onChange(function (){
      Focus.hashChanged($$("#account").userCtx &&
                        $$("#account").userCtx.name || "");
    });
    
    //$.pathbinder.begin("/focus");
    
    // Scroll past the url bar
    setTimeout(function () {
      $('html, body').animate({scrollTop: 1});
    }, 200);
  });
  
  // wish there was a better way to keep the URL bar from showing 
  // loading forever on Android
}, 100); 
