function(doc) {
    //if (doc.publish) { 
  emit([doc.profile.name, doc.state, (doc.created_at)], doc);
    //f}
};