function(doc) {
  if (doc.created_at) {
    emit((doc.edit_at || doc.state_at || doc.created_at), doc);
  }
};