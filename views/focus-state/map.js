function(doc) {
  if (doc.created_at && doc.state) {
    emit([doc.state, (doc.edit_at || doc.state_at || doc.created_at)], doc);
  }
};