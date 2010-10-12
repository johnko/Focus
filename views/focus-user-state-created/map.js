function(doc) {
  // Order now / later items consistently so they dont jump around the ui
  // done items are ordered by last edit to the last week view makes sense
  if (doc.type && doc.type === "task") {
    if (doc.state === "now" || doc.state === "later") { 
      emit([doc.profile.name, doc.state, (doc.created_at)], doc);
    } else {
      emit([doc.profile.name, doc.state, (doc.edit_at || doc.created_at)], doc);
    }
  }
};