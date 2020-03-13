const Utils = require('../Utils/Utils.js')
const WebtorrentClient = require('./VendorWebtorrentClient')
const VendorEthereumClient = require('./VendorEthereumClient')
const VendorZkcpGenerator = require('./VendorZkcpGenerator')
const debug = require('debug')('iotpc:vendor')
const fs = require('fs')
const util = require('util')
const colors = require('colors')

const EXPECTED_GAS_COMMIT = 120000
const EXPECTED_GAS_REVEAL = 64117
const EXPECTED_GAS_PRICE_WEI = 1000000000
const REWARD_FACTOR = 2

function Vendor (configFilePath) {
  this.webtorrentClient = new WebtorrentClient(configFilePath)
  this.ethereumClient = new VendorEthereumClient(configFilePath)
  this.zkcpGenerator = new VendorZkcpGenerator()
  this.iotAddresses = Utils.get_json_attribute(configFilePath, 'iot_addresses')
  this.daysTillExpiration = Utils.get_json_attribute(configFilePath, 'daysTillExpiration')
  this.configFilePath = configFilePath
}

Vendor.prototype.uploadFile = async function (file) {
  let self = this
  debug('uploadFile')
  let filePath = file // '../Files/Updates/Update1_1.txt' // TODO - should be determined dynamically
  let buf
  try {
    const readFile = util.promisify(fs.readFile)
    buf = await readFile(filePath)
    debug('buf = %s', buf)
  } catch (err) {
    return console.error(err)
  }
  let keyPair = await this.zkcpGenerator.gen(buf.length)
  let vk = keyPair['verification_key']
  let pk = keyPair['prove_key']
  debug('uploadFile: vk.length = %s, pk.length = %s', vk.length, pk.length)
  console.log(colors.green('Uploading file'))
  // TODO: support receiving buffer instead of filePath to avoid reading the file twice
  self.webtorrentClient.uploadUpdate(filePath, vk, pk, self.iotAddresses)
  self.webtorrentClient.webtorrentEvents.on('infoHashReady', function (packageHash, fileHash) {
    debug('uploadFile: infoHashReady - packageHash = %s, fileHash = %s', packageHash, fileHash)
    let iotAddresses = Utils.get_json_attribute(self.configFilePath, 'iot_addresses')
    let daysTillExpiration = Utils.get_json_attribute(self.configFilePath, 'days_till_expiration')
    let contractValue = iotAddresses.length * REWARD_FACTOR * EXPECTED_GAS_PRICE_WEI * (EXPECTED_GAS_COMMIT + EXPECTED_GAS_REVEAL)
    let deltaToReveal = 200000
    console.log(colors.green('Deploying smart contract'))
    self.ethereumClient.deployContract(iotAddresses, '0x' + packageHash, '0x' + fileHash, daysTillExpiration, contractValue, deltaToReveal)
  })
}

module.exports = Vendor
