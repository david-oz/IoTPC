function createConfig () {
  const argv = require('yargs').argv
  let vendorAddress = argv.vendorAddress
  let vendorIp = argv.vendorIp
  if (!vendorIp || vendorIp === '') {
    return
  }
  const Web3 = require('web3')
  const web3 = new Web3()
  const configCreation = require('../Utils/ConfigCreation.js')
  let web3Provider = 'wss://ropsten.infura.io/ws'
  let iotAccountJson = web3.eth.accounts.create()
  let iotPrivateKey = iotAccountJson.privateKey.toString()
  let iotAddress = iotAccountJson.address.toString().toLowerCase()
  let iotEncryptedKey = (web3.eth.accounts.encrypt(iotPrivateKey, 'myiot'))
  console.log('Iot Address = ' + iotAddress)
  configCreation.iot_create_config_file_from_json(iotAddress, 'myiot', vendorAddress, web3Provider, iotEncryptedKey, 'IoT_config.json', './downloads')
  let request = require('request')
  var options = {
    uri: 'http://' + vendorIp + ':8080/sendIotAddress',
    method: 'POST',
    json: {
      iotAddress: iotAddress
    }
  }

  request(options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log(body) // Print the shortened url.
    }
  })
}

createConfig()
