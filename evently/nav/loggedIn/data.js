function(e, r) {
  setTimeout( function () { 
    Focus.hashChanged(r.userCtx.name);
  }, 0);
  return { me :  r.userCtx.name };
};
