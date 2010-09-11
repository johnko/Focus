function(doc) {
  $('html,body').animate({
    scrollTop: $(this).offset().top
  }, 1000);

  // set textinput size
  var item = $(this), 
    message = $("[name=message]", this), 
    right = $("select", this).position().left, 
    left = message.position().left;
  //message.width(right - left - 12)[0].focus();
  //message.focus();
};