module.exports = ConfigCreation

const fs = require('fs')

function ConfigCreation () {

}

function create_config_file (args) {
    switch (args[2]) {
        case 'vendor':
            iot_pks = args[6].split(',')
            ConfigCreation.vendor_create_config_file(args[3], args[4], parseInt(args[5]), iot_pks, args[7], parseInt(args[8]),
                args[9], args[10])
            break
        case 'distributor':
            permissioned_vendors = args[5].split(',')
            iot_pks = args[6].split(',')
            ConfigCreation.distributor_create_config_file(args[3], args[4], permissioned_vendors, iot_pks, args[7], parseInt(args[8]), args[9], args[10], args[11])
            break
        case 'iot':
            iot_to_distributor_ports = args[7].split(',')
            ConfigCreation.iot_create_config_file_from_json(args[3], args[4], args[5], args[6], args[8], args[9], args[10])
            break
        case 'update_vendor_iot':
            ConfigCreation.update_vendor_iot(args)
            break

    }
}

ConfigCreation.vendor_create_config_file = function vendor_create_config_file (vendor_address, vendor_passphrase, days_till_expiration, iot_public_keys,
  web3_provider,
  encrypted_key_file_path, config_file_path, rest_server_port) {

  let json_to_write = {}
  json_to_write.vendor_address = vendor_address
  json_to_write.vendor_passphrase = vendor_passphrase
  json_to_write.days_till_expiration = days_till_expiration
  json_to_write.iot_public_keys = iot_public_keys
  json_to_write.rest_server_port = rest_server_port
  json_to_write.web3_provider = web3_provider
  json_to_write.contract = ''
  let privKeyjson = JSON.parse(fs.readFileSync(encrypted_key_file_path, 'utf8'))
  json_to_write.enc_priv_key = privKeyjson

  fs.writeFile(config_file_path, JSON.stringify(json_to_write), 'utf8', function (err, res) {
    if (!err) {
      console.log('create_config_file:: written successfully')
    } else {
      console.log(err)
    }
  })
}

ConfigCreation.distributor_create_config_file = function (address, passphrase, permissioned_vendors, iot_public_keys,
  web3_provider, flie_path,
  encrypted_key_file_path, config_file_path) {
  let json_to_write = {}
  json_to_write.distributor_address = address
  json_to_write.passphrase = passphrase
  json_to_write.permissioned_vendors = permissioned_vendors
  json_to_write.iot_public_keys = iot_public_keys
  json_to_write.web3_provider = web3_provider
  json_to_write.contract = ''
  json_to_write.flie_path = flie_path
  let privKeyjson = JSON.parse(fs.readFileSync(encrypted_key_file_path, 'utf8'))
  json_to_write.enc_priv_key = privKeyjson

  fs.writeFile(config_file_path, JSON.stringify(json_to_write), 'utf8', function (err, res) {
    if (!err) {
      console.log('create_config_file:: written successfully')
    } else {
      console.log(err)
    }
  })
}

ConfigCreation.iot_create_config_file = function (iot_address, iot_passphrase, permissioned_vendor, web3_provider,
  encrypted_key_file_path, config_file_path, downloads_folder_path) {
  let json_to_write = {}
  json_to_write.iot_address = iot_address
  json_to_write.iot_passphrase = iot_passphrase
  json_to_write.vendor = permissioned_vendor
  json_to_write.web3_provider = web3_provider
  json_to_write.contract = ''
  json_to_write.downloads_folder_path = downloads_folder_path
  let privKeyjson = JSON.parse(fs.readFileSync(encrypted_key_file_path, 'utf8'))
  json_to_write.enc_priv_key = privKeyjson

  fs.writeFile(config_file_path, JSON.stringify(json_to_write), 'utf8', function (err, res) {
    if (!err) {
      console.log('create_config_file:: written successfully')
    } else {
      console.log(err)
    }
  })
}

ConfigCreation.vendor_create_config_file_from_json = function (vendor_address, vendor_passphrase, days_till_expiration, iot_public_keys,
  web3_provider, rest_server_port, encrypted_key, config_file_path) {
  let json_to_write = {}
  json_to_write.vendor_address = vendor_address
  json_to_write.vendor_passphrase = vendor_passphrase
  json_to_write.days_till_expiration = days_till_expiration
  json_to_write.iot_public_keys = iot_public_keys
  json_to_write.rest_server_port = rest_server_port
  json_to_write.web3_provider = web3_provider
  json_to_write.contract = ''
  json_to_write.enc_priv_key = encrypted_key

  fs.writeFile(config_file_path, JSON.stringify(json_to_write), 'utf8', function (err, res) {
    if (!err) {
      console.log('create_config_file:: written successfully')
    } else {
      console.log(err)
    }
  })
}

ConfigCreation.distributor_create_config_file_from_json = function (address, passphrase, permissioned_vendors,
  web3_provider, flie_path,
  encrypted_key, config_file_path) {
  let json_to_write = {}
  json_to_write.address = address
  json_to_write.passphrase = passphrase
  json_to_write.permissioned_vendors = permissioned_vendors
  json_to_write.web3_provider = web3_provider
  json_to_write.contract = ''
  json_to_write.flie_path = flie_path
  json_to_write.enc_priv_key = encrypted_key

  fs.writeFile(config_file_path, JSON.stringify(json_to_write), 'utf8', function (err, res) {
    if (!err) {
      console.log('create_config_file:: written successfully')
    } else {
      console.log(err)
    }
  })
}

ConfigCreation.iot_create_config_file_from_json = function (iot_address, iot_passphrase, permissioned_vendor, web3_provider,
                                                            encrypted_key_file_path, config_file_path, downloads_folder_path) {
  let json_to_write = {}
  json_to_write.address = iot_address
  json_to_write.passphrase = iot_passphrase
  json_to_write.vendor = permissioned_vendor
  json_to_write.web3_provider = web3_provider
  json_to_write.contract = ''
  json_to_write.downloads_folder_path = downloads_folder_path
  json_to_write.enc_priv_key = JSON.parse(fs.readFileSync(encrypted_key_file_path, 'utf8'))

  fs.writeFile(config_file_path, JSON.stringify(json_to_write), 'utf8', function (err, res) {
    if (!err) {
      console.log('create_config_file:: written successfully')
    } else {
      console.log(err)
    }
  })
}

ConfigCreation.update_vendor_iot = function (args) {
    fs.readFile('/home/user/devel/IoTPC/Vendor/Vendor_config.json', 'utf8', function read(err, data){
        if (err) {
            throw err
        }
        let content = JSON.parse(data)
        content['iot_addresses'] = []
        for (var i=3; i<args.length; i++) {
            content['iot_addresses'].push(args[i])
        }

        console.log(content.iot_addresses)

        fs.writeFile('/home/user/devel/IoTPC/Vendor/Vendor_config.json', JSON.stringify(content), 'utf8', function (err, res) {
            if (!err) {
                console.log('create_config_file:: written successfully')
            } else {
                console.log(err)
            }
        })
    })
}




// run examples :

// vendor :
// node ConfigCreation.js vendor 0xf0b64e16698e8f3841bff20c7750c4f4398505a2 myvendor1 4 0x9de9608e266c35db674f19499f5b7cffb324fbba,0x610adea7d99a9efd6414e22dd0a602ec6d0fe19c,0x1b633374598a5b4a33e1298b1dd77132b8e70747,0x8339b9e99e3dd57b1a7befe372ac85d2a063da07 127.0.0.1:8547 5000 /home/user/keystore/f0b64e16698e8f3841bff20c7750c4f4398505a2 /home/user/Vendor_config.json

// distributor :
// node ConfigCreation.js distributor 0x32ac1edab9dea9a81af2325c390c8f8263e7c26d mydist1 0xf0b64e16698e8f3841bff20c7750c4f4398505a2 0x9de9608e266c35db674f19499f5b7cffb324fbba,0x610adea7d99a9efd6414e22dd0a602ec6d0fe19c,0x1b633374598a5b4a33e1298b1dd77132b8e70747,0x8339b9e99e3dd57b1a7befe372ac85d2a063da07 127.0.0.1:8547 6000 ../Files/DownloadedFiles/ /home/user/keystore/32ac1edab9dea9a81af2325c390c8f8263e7c26d /home/user/Distributor_config.json

// iot :
// node ConfigCreation.js iot 0x9de9608e266c35db674f19499f5b7cffb324fbba myiot1 0xf0b64e16698e8f3841bff20c7750c4f4398505a2 127.0.0.1:8547 8020,8030,8070,8080,8090 /home/user/keystore/9de9608e266c35db674f19499f5b7cffb324fbba /home/user/IoT_config.json

create_config_file(process.argv)
