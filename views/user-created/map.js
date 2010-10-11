function(doc) {
  emit([doc.profile.name], doc._id);
};
