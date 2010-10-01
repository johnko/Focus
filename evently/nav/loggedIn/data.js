function(e, r) {
  var data = { me : r.userCtx.name },
      hash = window.location.hash.slice(1);
  
  var selected = (hash === "/items/" + r.userCtx) ? "mine"
    : (hash === "/focus") ? "all"
    : (hash === "/tags") ? "tags"
    : (hash.indexOf("/team") !== -1) ? "team" : "";

  console.log(selected);
  data[selected] = "class='selected'";
  
  return data;
};
