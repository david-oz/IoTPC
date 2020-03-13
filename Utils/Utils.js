const fs = require('fs')
const Web3 = require('web3')
const web3 = new Web3()
const isHex = require('is-hex')
const createDebug = require('debug')
createDebug.formatters.h = (v) => {
  return typeof v === 'undefined' ? 'undefined' : v.toString('hex')
}
const debug = createDebug('iotpc:utils')

function Utils () {

}

Utils.get_contract_abi = function () {
  let data = fs.readFileSync(Utils.global_config_file_path, 'utf8')
  if (!data) {
    debug('Utils::get_contract_address::error while reading iotpc_contract_abi data from ' + Utils.global_config_file_path)
  } else {
    let json_obj = JSON.parse(data)
    let iotpc_contract_abi = json_obj.iotpc_abi
    return (iotpc_contract_abi)
  }
}

Utils.get_factory_contract_abi = function () {
  let data = fs.readFileSync(Utils.global_config_file_path, 'utf8')
  if (!data) {
    debug('Utils::get_factory_contract_address::error while reading factory_contract_abi data from ' + Utils.global_config_file_path)
  } else {
    let json_obj = JSON.parse(data)
    let iotpc_factory_abi = json_obj.iotpc_factory_abi
    return (iotpc_factory_abi)
  }
}

Utils.get_factory_contract_address = function () {
  let data = fs.readFileSync(Utils.global_config_file_path, 'utf8')
  if (!data) {
    debug('Utils::get_factory_contract_address::error while reading factory_contract_address data from ' + Utils.global_config_file_path)
  } else {
    let json_obj = JSON.parse(data)
    let factory_contract_address = json_obj.factory_contract_address
    return (factory_contract_address)
  }
}

Utils.get_json_attribute = function (config_file_path, attribute_name) {
  let json = JSON.parse(fs.readFileSync(config_file_path, 'utf8'))
  return json[attribute_name]
}

Utils.set_json_attribute = function (config_file_path, attribute_name, attribute_value, log_value) {
  let json_to_edit = JSON.parse(fs.readFileSync(config_file_path, 'utf8'))
  json_to_edit[attribute_name] = attribute_value
  if (json_to_edit) {
    fs.writeFileSync(config_file_path, JSON.stringify(json_to_edit), 'utf8')
    debug('Utils::set_json_attribute:: ' + log_value + ' was written successfully')
  } else {
    debug('Utils::set_json_attribute:: could not read configuration file properly ')
  }
}

Utils.add_contract_address = function (config_file_path, contract_address) {
  let json_to_edit = JSON.parse(fs.readFileSync(config_file_path, 'utf8'))
  json_to_edit['contracts'].push(contract_address)
  if (json_to_edit) {
    fs.writeFileSync(config_file_path, JSON.stringify(json_to_edit), 'utf8')
  } else {
    debug('Utils::add_contract_address:: could not read configuration file properly ')
  }
}

Utils.get_private_key = function (config_file_path, passphrase) {
  let stringData = fs.readFileSync(config_file_path, 'utf8')
  let json = JSON.parse(stringData)
  let wallet = web3.eth.accounts.wallet.decrypt([json.enc_priv_key], passphrase)
  let privateKey = wallet[0].privateKey
  return privateKey
}

Utils.create_config_file = function (config_file_path, json_to_write) {
  fs.writeFile(config_file_path, JSON.stringify(json_to_write), 'utf8', function (err, res) {
    if (!err) {
      debug('Utils::create_config_file:: written successfully')
    } else {
      debug(err)
    }
  })
}

Utils.trim0x = function (hexString) {
  return hexString.startsWith('0x') ? hexString.substring(2, hexString.length) : hexString
}

Utils.createDebug = createDebug

Utils.toBuffer = function (v) {
  if (Buffer.isBuffer(v)) {
    return v
  }
  if (typeof v === 'object' && v.type === 'Buffer') {
    return Buffer.from(v)
  }
  let _isHex = isHex(v)
  if (!_isHex) {
    v = Utils.trim0x(v)
    _isHex = isHex(v)
  }
  return _isHex ? Buffer.from(v, 'hex') : v
}

Utils.global_config_file_path = '../Files/global_config.json'



module.exports = Utils
