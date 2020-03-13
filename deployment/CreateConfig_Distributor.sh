#!/bin/bash
address=$1
passphrase=$2
ports=$3
vendorAdd=$4
web3provider=$5
encryptedKeyFilePath=$6
iot_public_keys=$7
configFilePath="../Distributor/Distributor_config.json"
createConfigFile="../Utils/ConfigCreation.js"
downloadFilePath="../Files/DownloadedFiles/"

echo "echo creating config file for ditributor " $passphrase
node $createConfigFile 'distributor' $address $passphrase $vendorAdd $iot_public_keys $web3provider $ports $downloadFilePath $encryptedKeyFilePath $configFilePath
echo "config file was created"