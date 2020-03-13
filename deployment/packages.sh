#!/bin/bash

file=$1

function init(){
  ip="$(cut -d'|' -f1 <<<"$1")"
  user="$(cut -d'|' -f2 <<<"$1")"
  address="$(cut -d'|' -f3 <<<"$1")"
  passphrase="$(cut -d'|' -f4 <<<"$1")"
  ports="$(cut -d'|' -f5 <<<"$1")"
  targetPath="/home/"$user"/IoTPC_Demo"
  echo $ip
}

function installPackages(){
  echo "start install packages for " $ip $passphrase
  local target="$user@$ip"
  echo "install packages in" $targetPath
#  ssh -n $target 'echo "104.16.23.35 registry.npmjs.org" | sudo tee -a /etc/hosts'
  ssh -n $target "cd $targetPath && npm install"
  local path="$targetPath/$file"
  echo "install packages in" $path
#  ssh -n $target "cd $path && npm clean"
#  ssh -n $target "cd $path && npm cache verify"
  ssh -n $target "cd $path && npm install"
  echo "done install packages for " $ip $passphrase
}
while IFS= read -r line
do
  echo "start deploy " $line
  init $line
  installPackages
#  startProcess
done <"$file"
