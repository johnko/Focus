function(e, r) {
  setTimeout( function () {
    $.pathbinder.begin("/items/" + r.userCtx.name);
    //Focus.hashChanged(r.userCtx.name);
  }, 0);
  return { me :  r.userCtx.name };
};
