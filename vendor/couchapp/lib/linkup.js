// this code makes http://example.com into a link, 
// and also handles @name and #hashtag

// todo add [[wiki_links]]

var mustache = require("vendor/couchapp/lib/mustache");

exports.encode = function(body, person_prefix, tag_prefix) {
  body = mustache.escape(body);
  person_prefix = person_prefix || "http://twitter.com/";
  tag_prefix = tag_prefix || "http://delicious.com/tag/";
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
      tmp = (dom.childNodes[i].nodeType === 3) 
        ? document.createTextNode(transformText(dom.childNodes[i].textContent))
        : replaceTags(dom.childNodes[i]);
      dom.replaceChild(tmp, dom.childNodes[i]); 
    }
    return dom;
  };

  //var div = document.createElement("div");
  //div.innerHTML = tmp;
  //return replaceTags(tmp).innerHTML;

  return tmp;
};
