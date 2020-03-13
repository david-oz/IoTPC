#!/bin/bash
while IFS= read -r line
do
  echo "start deploy " $line
  ip="$(cut -d'|' -f1 <<<"$line")"
  target="pi@"$ip
  echo $ip 
  echo $target
#  ssh-copy-id $target
  ssh -n $target "sudo apt-get update && sudo apt-get install nodejs-legacy && curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash - && sudo apt-get install -y nodejs && sudo apt-get install npm && npm config set python /usr/bin/python2.7 && sudo apt-get install build-essential"
done <"IoT"