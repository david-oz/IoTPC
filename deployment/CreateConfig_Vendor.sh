#!/bin/bash
address=$1
passphrase=$2
ports=$3
vendorAdd=$4
web3provider=$5
encryptedKeyFilePath=$6
iot_public_keys=$7
resPort=$8
configFilePath="../Vendor/Vendor_config.json"
createConfigFile="../Utils/ConfigCreation.js"

echo "echo creating config file for vendor " $passphrase
echo $iot_public_keys
node $createConfigFile 'vendor' $address $passphrase 4 $iot_public_keys $web3provider $encryptedKeyFilePath $configFilePath $resPort
echo "config file was created"