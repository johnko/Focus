function(doc) {
  if (doc.type === "gravatar") { 
    emit([doc.email], doc);
  }
}
