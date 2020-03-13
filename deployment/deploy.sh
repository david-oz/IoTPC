#!/bin/bash

# TO DO
# in order to be able to copy files without entering password
# generate key pairs on the host (deployment server) - already done on 10.0.0.36 in case it will be used as a deployment server:
# ssh-keygen -t rsa -b 2048
# Generating public/private rsa key pair.
# Enter file in which to save the key (/root/.ssh/id_rsa): # Hit Enter
# Enter passphrase (empty for no passphrase): # Hit Enter
# Enter same passphrase again: # Hit Enter
# Your identification has been saved in /root/.ssh/id_rsa.
# Your public key has been saved in /root/.ssh/id_rsa.pub.
#
# Then copy the public key to the target server
# ssh-copy-id user@server (e.g. user@10.0.0.31-35 - already done on this one)

# Step 1 - cd to devel directory type git clone to update the develop branch
# Step 2 - cd to deployment directory and run bash deploy.sh <target> where <target> is IoT/Distributer/Vendor

BRANCH="develop"
INSTALL="0"
TYPE="iot"
PULL="0"
CONFIG="IoT"
NEW_INSTALL="0"
START="0"
CHECKOUT=""
RESTPORT="8080"

iotAddList=()
ProjectPath=".."
targetPath=""
keyStorePath="../../../KeyStore/keystore/"
createConfigFile="/Utils/ConfigCreation.js"


function newInstall(){
  echo "Start Nodejs install"
  local target="$user@$ip"
  ssh -n $target "sudo apt-get update && sudo apt-get install nodejs-legacy && curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash - && sudo apt-get install -y nodejs install build-essential libgmpxx4ldbl libgmp3-dev npm && npm config set python /usr/bin/python2.7"
}

function init(){
  ip="$(cut -d'|' -f1 <<<"$1")"
  user="$(cut -d'|' -f2 <<<"$1")"
  address="$(cut -d'|' -f3 <<<"$1")"
  passphrase="$(cut -d'|' -f4 <<<"$1")"
  ports="$(cut -d'|' -f5 <<<"$1")"
  targetPath="devel/IoTPC"
  echo $ip
}
function initVendor(){
  line=`head -n 1 'Vendor'`
  vendorIP="$(cut -d'|' -f1 <<<"$line")"
  vendorUser="$(cut -d'|' -f2 <<<"$line")"
  vendorAddress="$(cut -d'|' -f3 <<<"$line")"
  vendorPassphrase="$(cut -d'|' -f4 <<<"$line")"
  vendorPorts="$(cut -d'|' -f5 <<<"$line")"
  web3provider="$(cut -d'|' -f6 <<<"$line")"
  vendorRestPort=$RESTPORT
  echo $vendorAddress $vendorPassphrase $vendorPorts
}
function iotPublicKeys(){
  while IFS= read -r line
  do
    temp_key="$(cut -d'|' -f3 <<<"$line")"
    keys=$keys","$temp_key
  done <"IoT"
  keys="${keys:1}"
  iot_public_keys=$keys
}

function killNode(){
  echo "kill node process"
  local target="$user@$ip"
  ssh -n $target "pkill node"
}

function preperation(){
  echo "preperations"
  local target="$user@$ip"
  ssh -n $target "sudo sed -i \"s/#prepend domain-name-servers 127.0.0.1;/prepend domain-name-servers 8.8.8.8;/g\" /etc/dhcp/dhclient.conf"
  ssh -n $target "sudo service networking restart"
  ssh -n $target 'echo "104.16.23.35 registry.npmjs.org" | sudo tee -a /etc/hosts'
  ssh -n $target "sudo apt-get update"
  ssh -n $target "cd $targetPath && npm clean"
  ssh -n $target "cd $targetPath && npm cache verify"
  ssh -n $target "npm config set strict-ssl=false"
  ssh -n $target "npm config set fetch-retries 10"
  echo "finish preperation"
}

function cloneFromGit(){
    echo "Start clone from git in " $ip $passphrase
    local target="$user@$ip"
    ssh -n $target "rm -r devel/ && git clone -b $BRANCH https://alexey:aY320988@git.tlabs.bgu.ac.il/IoT/devel.git && cd devel/ && git config user.name alexey && git config user.password yA320988"

}

function pullFromGit(){
    echo "Start Pull from git in " $ip $passphrase
    local target="$user@$ip"
    ssh -n $target "cd devel/ && git reset --hard && git pull && cd IoTPC/IoT/ && chmod a+x verify && cd ../Distributor/ && chmod a+x prove"
}

function checkoutFromGit(){
    echo "Start checkout from git in " $ip $passphrase
    local target="$user@$ip"
    ssh -n $target "cd devel/ && git reset --hard  && git checkout $CHECKOUT && cd IoTPC/IoT/ && chmod a+x verify && cd ../Distributor/ && chmod a+x prove"
}

function installIoTPC(){
  echo "Start install IoTPC " $ip $passphrase
  local target="$user@$ip"
  ssh -n $target "cd $targetPath && npm install"
}

function installIoT(){
  echo "Start install IoT " $ip $passphrase
  local target="$user@$ip"
  ssh -n $target "cd $targetPath/IoT/ && npm install && chmod a+x verify"
}

function installVendor(){
  echo "Start install Vendor" $ip $passphrase
  local target="$user@$ip"
  ssh -n $target "cd $targetPath/Vendor/ && npm install"
}

function installDistributor(){
  echo "Start install Distributor" $ip $passphrase
  local target="$user@$ip"
  ssh -n $target "cd $targetPath/Distributor/ && npm install && chmod a+x prove"
}


function createConfig(){
  local target="$user@$ip:$targetPath/$CONFIG"
  local source="../$CONFIG/IoT_config.json"
  local script="CreateConfig_$CONFIG.sh"
# remove the first 2 characters from the address
  tmpAdd=${address:2}
  echo "Create config file from script:" "$script"
  echo "Address " $address
  echo "tmpAdd " $tmpAdd
# choose the right file from the keystore based on the address
  filename=$(ls $keyStorePath | egrep $tmpAdd)
  echo "File name " $CONFIG
  encryptedFilePath=$keyStorePath$filename
  echo "encrypted file path " $encryptedFilePath
  bash $script $address $passphrase $ports $vendorAddress $web3provider $encryptedFilePath $iot_public_keys $vendorRestPort
  #ssh -n $target "cd $targetPath/deployment && bash $script $address $passphrase $ports $vendorAddress $web3provider $encryptedFilePath $iot_public_keys $vendorRestPort"
  echo "Start copy file from $source to $target"
  scp -r $source $target
  echo "Done copy file"
  if [ "$TYPE" = "iot" ]; then
    iotAddList+=("$address")
  fi
}

function createVendorConfig(){
   echo "start copy vendor config file "
    local target=$vendorUser"@"$vendorIP":"$targetPath"/Vendor/"
    local source=$ProjectPath"/Vendor/Vendor_config.json"
    node ../$createConfigFile 'update_vendor_iot' ${iotAddList[@]}
    scp -r $source $target
    echo "done copy vendor "$vendorIP" config file"
}

function copyDistributorConfig(){
   echo "start copy Distributor config file "
    local target="$user"@$ip":"$targetPath"/Distributor/"
    local distTarget="$user@$ip"
    local source=$ProjectPath"/deployment/Distributor_config_files/dist_"$passphrase".json"
    scp -r $source $target
    ssh -n $distTarget "cd $targetPath/Distributor/ && mv dist_$passphrase.json Distributor_config.json"
    echo "done copy Distributor "$ip" config file"
}

function startProcess(){
  echo "Start process"
  local target="$user@$ip"
  local pathToExeution=$targetPath"/"$CONFIG
  ssh -n $target "cd $pathToExeution ; nohup npm start >> file.log 2>&1 &"
}


POSITIONAL=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --install) INSTALL="1"; shift 1;;
    --pull) PULL="1"; shift 1;;
    --new) NEW_INSTALL="1"; shift 1;;
    --start) START="1"; shift 1;;

    --checkout=*) CHECKOUT="${1#*=}"; shift 1;;
    --branch=*) BRANCH="${1#*=}"; shift 1;;
    --type=*) TYPE="${1#*=}"; shift 1;;
    --config=*) CONFIG="${1#*=}"; shift 1;;


    -*) echo "unknown option: $1" >&2; exit 1;;
    *) handle_argument "$1"; shift 1;;
  esac
done

echo BRANCH = "$BRANCH"
echo TYPE = "$TYPE"
echo CONFIG = "$CONFIG"
echo PULL = "$PULL"
echo INSTALL = "$INSTALL"
echo NEW_INSTALL = "$NEW_INSTALL"
echo Start = "$START"

if [ "$TYPE" = "iot" ]; then

    if [ "$NEW_INSTALL" = "1" ]; then
      echo "New install"
      echo "Start bash"
      while IFS= read -r line
      do
        echo "start deploy " $line
        init $line
        iotPublicKeys
        initVendor
        preperation
        newInstall
        cloneFromGit
        installIoTPC
        installIoT
        createConfig
      done <"$CONFIG"
      createVendorConfig
    elif [ "$PULL" = "1" ] && [ "$INSTALL" = "1" ]; then
     echo "Pull and install"
     echo "Start bash"
     while IFS= read -r line
     do
       echo "start deploy " $line
       init $line
       iotPublicKeys
       initVendor
       killNode
       pullFromGit
       preperation
       installIoTPC
       installIoT
       createConfig
     done <"$CONFIG"
     createVendorConfig
    elif [ "$PULL" = "1" ] && [ "$INSTALL" = "0" ]; then
     echo "Pull"
     echo "Start bash"
     while IFS= read -r line
     do
       echo "start deploy " $line
       init $line
       iotPublicKeys
       initVendor
       killNode
       pullFromGit
       createConfig
     done <"$CONFIG"
     createVendorConfig
    elif [ ! -z "$CHECKOUT" ] && [ "$INSTALL" = "0" ]; then
     echo "Checkout and install"
     echo "Start bash"
     while IFS= read -r line
     do
       echo "start deploy " $line
       init $line
       iotPublicKeys
       initVendor
       checkoutFromGit
       killNode
       createConfig
     done <"$CONFIG"
     createVendorConfig
    elif [ ! -z "$CHECKOUT" ] && [ "$INSTALL" = "1" ]; then
     echo "Checkout and install"
     echo "Start bash"
     while IFS= read -r line
     do
       echo "start deploy " $line
       init $line
       iotPublicKeys
       initVendor
       checkoutFromGit
       preperation
       installIoTPC
       installIoT
       killNode
       createConfig
     done <"$CONFIG"
     createVendorConfig
    elif [ "$START" = "1" ] ; then
     echo "Start IoT's"
     echo "Start bash"
     while IFS= read -r line
     do
       echo "start deploy " $line
       init $line
       killNode
       startProcess
     done <"$CONFIG"
    fi

elif [ "$TYPE" = "vendor" ]; then
    echo "Start Vendor"
    CONFIG="Vendor"
    if [ "$NEW_INSTALL" = "1" ]; then
       echo "New install"
        echo "Start bash"
        while IFS= read -r line
        do
          echo "start deploy " $line
          init $line
          iotPublicKeys
          initVendor
          preperation
          newInstall
          cloneFromGit
          installIoTPC
          installVendor
        done <"$CONFIG"
      elif [ "$PULL" = "1" ] && [ "$INSTALL" = "1" ]; then
       echo "Pull and install"
       echo "Start bash"
       while IFS= read -r line
       do
         echo "start deploy " $line
         init $line
         iotPublicKeys
         initVendor
         killNode
         pullFromGit
         preperation
         installIoTPC
         installVendor
       done <"$CONFIG"
      elif [ "$PULL" = "1" ] && [ "$INSTALL" = "0" ]; then
       echo "Pull"
       echo "Start bash"
       while IFS= read -r line
       do
         echo "start deploy " $line
         init $line
         iotPublicKeys
         initVendor
         killNode
         pullFromGit
       done <"$CONFIG"
      elif [ ! -z "$CHECKOUT" ] && [ "$INSTALL" = "0" ]; then
       echo "Checkout and install"
       echo "Start bash"
       while IFS= read -r line
       do
         echo "start deploy " $line
         init $line
         iotPublicKeys
         initVendor
         checkoutFromGit
         killNode
       done <"$CONFIG"
      elif [ ! -z "$CHECKOUT" ] && [ "$INSTALL" = "1" ]; then
       echo "Checkout and install"
       echo "Start bash"
       while IFS= read -r line
       do
         echo "start deploy " $line
         init $line
         iotPublicKeys
         initVendor
         checkoutFromGit
         preperation
         installIoTPC
         installVendor
         killNode
       done <"$CONFIG"
      elif [ "$START" = "1" ] ; then
       echo "Start Vendor's"
       echo "Start bash"
       while IFS= read -r line
       do
         echo "start deploy " $line
         init $line
         killNode
         startProcess
       done <"$CONFIG"
      fi
elif [ "$TYPE" = "distributor" ]; then
    echo "Start distributor"
    CONFIG="Distributor"
    if [ "$NEW_INSTALL" = "1" ]; then
       echo "New install"
        echo "Start bash"
        while IFS= read -r line
        do
          echo "start deploy " $line
          init $line
          iotPublicKeys
          initVendor
          preperation
          newInstall
          cloneFromGit
          installIoTPC
          installDistributor
          copyDistributorConfig
        done <"$CONFIG"
      elif [ "$PULL" = "1" ] && [ "$INSTALL" = "1" ]; then
       echo "Pull and install"
       echo "Start bash"
       while IFS= read -r line
       do
         echo "start deploy " $line
         init $line
         iotPublicKeys
         initVendor
         killNode
         pullFromGit
         preperation
         installIoTPC
         installDistributor
         copyDistributorConfig
       done <"$CONFIG"
      elif [ "$PULL" = "1" ] && [ "$INSTALL" = "0" ]; then
       echo "Pull"
       echo "Start bash"
       while IFS= read -r line
       do
         echo "start deploy " $line
         init $line
         iotPublicKeys
         initVendor
         killNode
         pullFromGit
         copyDistributorConfig
       done <"$CONFIG"
      elif [ ! -z "$CHECKOUT" ] && [ "$INSTALL" = "0" ]; then
       echo "Checkout and install"
       echo "Start bash"
       while IFS= read -r line
       do
         echo "start deploy " $line
         init $line
         iotPublicKeys
         initVendor
         checkoutFromGit
         killNode
         copyDistributorConfig
       done <"$CONFIG"
      elif [ ! -z "$CHECKOUT" ] && [ "$INSTALL" = "1" ]; then
       echo "Checkout and install"
       echo "Start bash"
       while IFS= read -r line
       do
         echo "start deploy " $line
         init $line
         iotPublicKeys
         initVendor
         checkoutFromGit
         preperation
         installIoTPC
         installDistributor
         killNode
         copyDistributorConfig
       done <"$CONFIG"

      elif [ "$START" = "1" ] ; then
       echo "Start Distributor's"
       echo "Start bash"
       while IFS= read -r line
       do
         echo "start deploy " $line
         init $line
         killNode
         startProcess
       done <"$CONFIG"
      fi
fi
