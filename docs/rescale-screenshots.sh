#!/bin/bash

if [ $1 ]
then
   echo Processing file $1;
else
   find ./docs -name "*.png" -print0 | while IFS= read -r -d '' file; do
       echo Processing file "$file";
       sips -Z $(($(sips -g pixelWidth "$file" | cut -s -d ':' -f 2 | cut -c 2-) / 2)) "$file" --out "$file" &> /dev/null
   done
fi