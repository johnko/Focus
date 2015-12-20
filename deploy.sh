#!/bin/sh

if [ "x" = "x$1" ]; then
    HOST=localhost
else
    HOST=$1
fi

DBNAME=focus
DBURL=http://${HOST}:5984/${DBNAME}

kanso install

kanso push ${DBURL}
