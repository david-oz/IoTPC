const WebTorrent = require('webtorrent')
const crypto = require('crypto')
const EventEmitter = require('events').EventEmitter
const inherits = require('inherits')
const Utils = require('../Utils/Utils.js')
const EthereumClient = require('./IoTEthereumClient')
const wwZkcp = require('./IoTZkcpBittorrentExtensionClient')
const iotConfigFilePath = '../IoT/IoT_config.json'
const debug = require('debug')('iotpc:iot')
const fs = require('fs')
const util = require('util')
const path = require('path')
const colors = require('colors')
const HASH_BYTES = 32
const DHT_ROTATE_INTERVAL = 5 * 1000 // 5 seconds

function IoT () {
  this.webtorrentClient = new WebTorrent({dht: {rotateInterval: DHT_ROTATE_INTERVAL}, enableNatTraversal: false})
  this.ethereumClient = new EthereumClient(iotConfigFilePath)
  this.downloadsFolderPath = Utils.get_json_attribute(iotConfigFilePath, 'downloads_folder_path')
  if (!fs.existsSync(this.downloadsFolderPath)) {
    fs.mkdirSync(this.downloadsFolderPath)
  }
  let passphrase = Utils.get_json_attribute(iotConfigFilePath, 'passphrase')
  this.privateKey = Utils.get_private_key(iotConfigFilePath, passphrase)
  this.keysHashes = {}
}

inherits(IoT, EventEmitter)

IoT.prototype.init = function () {
  let self = this
  this.ethereumClient.subscribeToContractPublished()
  self.ethereumClient.on('newUpdate', (infoHash, iotAddressesMerkleRoot) => self._onNewUpdate(infoHash, iotAddressesMerkleRoot))
  self.ethereumClient.on('rReady', (r) => self._onKeyRevealed(r)) // TODO: make event coupled with specific IoT address
}

IoT.prototype._onNewUpdate = function (infoHash, iotAddressesMerkleRoot) {
  let self = this
  debug(`_onNewUpdate: infoHash = ${infoHash}, iotAddressesMerkleRoot = ${iotAddressesMerkleRoot}`)
  infoHash = Utils.trim0x(infoHash)
  let vendorAddress = Utils.get_json_attribute(iotConfigFilePath, 'vendor').toLowerCase()
  let torrent = self.webtorrentClient.add(infoHash, {discoveryIntervalMs: DHT_ROTATE_INTERVAL})
  torrent.on('wire', (wire) => self._onWire(wire, torrent, {infoHash, iotAddressesMerkleRoot, vendorAddress}))
}

IoT.prototype._onWire = function (wire, torrent, metadata) {
  let self = this
  debug('_onWire: got update! metadata =', metadata)
  wire.use(wwZkcp(this.privateKey, metadata))
  wire.ww_zkcp.on('encryptedFile', _onEncryptedFile)

  async function _onEncryptedFile (encFile, s) {
    torrent.destroy()

    if (Buffer.isBuffer(s)) {
      s = s.toString('hex')
    }

    try {
      let encFilePath = path.join(self.downloadsFolderPath, s) // save file under the specific hash value s
      let writeFileAsync = util.promisify(fs.writeFile)
      await writeFileAsync(encFilePath, encFile)
      self.keysHashes[s] = true
      console.log(colors.green('Received encrypted update file'))
    } catch (err) {
      return console.error('_onEncryptedFile: err = ', err)
    }
  }
}

IoT.prototype._onKeyRevealed = async function (r) {
  if (!Buffer.isBuffer(r)) {
    r = Buffer.from(r, 'hex')
  }
  let s = crypto.createHash('sha256').update(r).digest('hex')
  if (!this.keysHashes[s]) {
    return debug('_onKeyRevealed: s value (' + s + ') was not saved by this IoT')
  }
  try {
    let encFilePath = path.join(this.downloadsFolderPath, s) // save file under the specific hash value s
    let readFileAsync = util.promisify(fs.readFile)
    let encFile = await readFileAsync(encFilePath)
    let file = this._decrypt(Buffer.from(encFile), r)
    let filePath = path.join(this.downloadsFolderPath, s + '-plaintext')
    let writeFileAsync = util.promisify(fs.writeFile)
    await writeFileAsync(filePath, file.toString())
    console.log(colors.green('Key revealed: successfully decrypted update!'))
  } catch (err) {
    console.error(err)
  }
}

IoT.prototype._decrypt = function (encrypted_update, key) {

    const decrypted_update = Buffer.alloc(encrypted_update.length)
    key = Buffer.from(key)
    for (i = 0; i <= (encrypted_update.length + 1) / HASH_BYTES; i++) {
        key[key.length - 1] = i
        let key_partial = crypto.createHash('sha256').update(key).digest()
        for (j = 0; j < HASH_BYTES; j++) {
            decrypted_update[(i * HASH_BYTES) + j] = encrypted_update[(i * HASH_BYTES) + j] ^ key_partial[j]
        }
    }
    return decrypted_update
}


module.exports = IoT
