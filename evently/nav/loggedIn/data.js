function(e, r) {
  setTimeout( function () {
    $.pathbinder.begin("/focus/" + r.userCtx.name);
  }, 0);
  return { me :  r.userCtx.name };
};
