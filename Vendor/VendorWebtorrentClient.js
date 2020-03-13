module.exports = VendorWebtorrentClient
const fs = require('fs')
const createTorrent = require('create-torrent')
const parseTorrent = require('parse-torrent')
const crypto = require('crypto')
const ethereumjsUtil = require('ethereumjs-util')
const debug = require('debug')('iotpc:vendor-webtorrent-client')

let WebTorrent = require('webtorrent')
let events = require('events')
let Utils = require('../Utils/Utils.js')
let myEvents = new events.EventEmitter()
let self

/**
 * @constructor
 */
function VendorWebtorrentClient (configFilePath) {
  this.configFilePath = configFilePath
  this.vendor_address = Utils.get_json_attribute(this.configFilePath, 'vendor_address')
  this.vendor_passphrase = Utils.get_json_attribute(this.configFilePath, 'vendor_passphrase')
  this.client = new WebTorrent()
  self = this
}
VendorWebtorrentClient.prototype.webtorrentEvents = myEvents

VendorWebtorrentClient.prototype.uploadUpdate = async function (updateFilePath, verificationKey, provingKey, iotAddresses) {
  let file = fs.readFileSync(updateFilePath, 'utf8')
  let onlyPath = require('path').dirname(updateFilePath)
  let fileHashSHA256 = crypto.createHash('sha256').update(file).digest('hex')

  // we use the SHA256 as the name to have the info hash determinstic, and consistent across all devices
  createTorrent(updateFilePath, {name: fileHashSHA256}, function (err, torrent) {
    if (!err) {
      let fileHash = parseTorrent(torrent).infoHash
      debug('fileHash = ', fileHash)
      debug('fileHashSHA256 = ', fileHashSHA256)
      debug('verificationKey = ', verificationKey)
      let msgToHash = Buffer.concat([Buffer.from(fileHash, 'hex'), Buffer.from(fileHashSHA256, 'hex'), Buffer.from(verificationKey, 'hex')])
      debug('msgToHash =', msgToHash)
      let msgHash = ethereumjsUtil.sha3(msgToHash)
      debug('msgHash =', msgHash)
      let privateKey = Utils.get_private_key(self.configFilePath, self.vendor_passphrase)
      debug('vendorAddress =', ethereumjsUtil.privateToAddress(privateKey))
      privateKey = privateKey.substr(2, privateKey.length)
      let vendorSignature = ethereumjsUtil.ecsign(msgHash, Buffer.from(privateKey, 'hex'))
      let jsonToWrite = {
        file: file.toString(),
        verificationKey: verificationKey.toString(),
        provingKey: provingKey.toString(),
        vendorSignature: vendorSignature,
        iotAddresses: iotAddresses
      }
      fs.writeFileSync(onlyPath + '/wrappingPackage.json', JSON.stringify(jsonToWrite), 'utf8')
      self.client.seed(onlyPath + '/wrappingPackage.json', function (torrent) {
        debug('uploadUpdate: start seeding file on : ' + torrent.infoHash)
        let wrappingPackageHash = torrent.infoHash
        myEvents.emit('infoHashReady', wrappingPackageHash, fileHash)
      })
    }
  })
}
