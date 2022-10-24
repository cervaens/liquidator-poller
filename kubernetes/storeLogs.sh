#!/bin/bash

cd /var/log/pods/
for i in *
do
  if [[ "$i" == *"default_liquidator-deployment"* ]]; then
    echo "$i"
    sudo tar -czvf /var/log/pods-history/$i.tar.gz $i
  fi
done