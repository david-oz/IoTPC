#!/bin/bash
address=$1
passphrase=$2
ports=$3
vendorAdd=$4
web3provider=$5
encryptedKeyFilePath=$6
configFilePath="../IoT/IoT_config.json"
createConfigFile="../Utils/ConfigCreation.js"
downloads_folder_path="./downloads"

echo "Creating config file " $passphrase
#echo $createConfigFile 'iot' $address $passphrase $vendorAdd $web3provider $ports $encryptedKeyFilePath $configFilePath $downloads_folder_path
node $createConfigFile 'iot' $address $passphrase $vendorAdd $web3provider $ports $encryptedKeyFilePath $configFilePath $downloads_folder_path
echo "config file was created"


