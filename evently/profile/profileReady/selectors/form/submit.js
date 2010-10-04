function() {
  var form = $(this),
    f = form.serializeObject(),
    doc = {
      created_at : new Date(),
      profile : $$("#profile").profile,
      publish : false,
      message : f.message,
      state : f.state,
      type : "task"
  };
  $$(form).app.db.saveDoc(doc, {
    success : function(r) {
      $("[name=message]", form).val("");
      Focus.notifyMsg('New item: </span><a href="#/details/' +
                      r.id + '">'+doc.message+'</a>');
    }
  });
  return false;
};