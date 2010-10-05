function(e) {
  var name = $('input[name=name]', this).val(),
      pass = $('input[name=password]', this).val(),
      elem = $(this);
  $.couch.login({
    name : name,
    password : pass,
    success : function(r) {
      $("#account").trigger("_init",[this]);
    }
  });      
  return false;
}