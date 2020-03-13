const WebTorrent = require('webtorrent')
const crypto = require('crypto')
const util = require('util')
const MerkleTree = require('merkle-tree-solidity')
const sha3 = require('ethereumjs-util').sha3
const Utils = require('../Utils/Utils.js')
const EthereumClient = require('./DistributorEthereumClient')
const wwZkcp = require('./DistributorZkcpBittorrentExtensionClient')
const distributorConfigFilePath = '../Distributor/Distributor_config.json'
const debug = Utils.createDebug('iotpc:distributor')
const colors = require('colors')

function Distributor () {
  this.webtorrentClient = new WebTorrent()
  this.ethereumClient = new EthereumClient(distributorConfigFilePath)
  let passphrase = Utils.get_json_attribute(distributorConfigFilePath, 'passphrase')
  this.privateKey = Utils.get_private_key(distributorConfigFilePath, passphrase)
  this.downloadsFolderPath = Utils.get_json_attribute(distributorConfigFilePath, 'flie_path')
}

Distributor.prototype.init = function () {
  let self = this
  self.ethereumClient.subscribeToContractPublished()
  self.ethereumClient.on('newContract', _onNewContract)

  function _onNewContract (wrappingPackageInfoHash, iotAddressesMerkleRoot, numOfIoTDevices) {
    debug(`_onNewContract: got new contract: wrappingPackageInfoHash = ${wrappingPackageInfoHash}, iotAddressesMerkleRoot = ${iotAddressesMerkleRoot}, numOfIoTDevices = ${numOfIoTDevices}`)
    wrappingPackageInfoHash = Utils.trim0x(wrappingPackageInfoHash)
    self.webtorrentClient.add(wrappingPackageInfoHash, {path: self.downloadsFolderPath}, (torrent) => {
      torrent.on('done', () => self._onWrappingPackageTorrentDone(torrent, iotAddressesMerkleRoot, numOfIoTDevices))
    })
  }
}

Distributor.prototype._onWrappingPackageTorrentDone = async function (torrent, iotAddressesMerkleRoot, numOfIoTDevices) {
  let self = this
  debug('_onWrappingPackageTorrentDone: torrent finished downloading!')
  let wrappingPackage = await self._decodeWrappingPackage(torrent.files[0])
  wrappingPackage.fileSha256 = crypto.createHash('sha256').update(wrappingPackage.file).digest('hex') // TODO: check fileSha256 against vendorSignature
  debug('_onWrappingPackageTorrentDone: wrappingPackage.fileSha256 =', wrappingPackage.fileSha256)
  let iotAddresses = wrappingPackage.iotAddresses
  if (iotAddresses.length !== numOfIoTDevices) {
    return console.error('Number of IoT devices from contract does not match addresses array in wrapping package')
  }
  let iotAddressesHashes = iotAddresses.map(e => sha3(e))
  let iotAddressesMerkleTree = MerkleTree.default(iotAddressesHashes, false)
  iotAddressesMerkleRoot = Utils.toBuffer(iotAddressesMerkleRoot)
  if (!iotAddressesMerkleTree.getRoot().equals(iotAddressesMerkleRoot)) {
    return console.error('Invalid Merkle root')
  }
  wrappingPackage.iotAddressesMerkleTree = iotAddressesMerkleTree
  self.webtorrentClient.seed(Buffer.from(wrappingPackage.file, 'utf8'), {name: wrappingPackage.fileSha256}, (torrent) => self._onSeedUpdateFile(torrent, wrappingPackage))
}

Distributor.prototype._onSeedUpdateFile = function (torrent, wrappingPackage) {
  debug('_onSeedUpdateFile')
  debug('_onSeedUpdateFile: torrent.infoHash =', torrent.infoHash)
  let self = this
  torrent.on('wire', (wire, addr) => {
    debug('onSeedUpdateFile -> _onWire')
    self._onWire(wire, addr, Object.assign({infoHash: torrent.infoHash}, wrappingPackage))
  })
}

Distributor.prototype._onWire = function (wire, addr, wrappingPackage) {
  debug('_onWire: addr = ', addr)
  let self = this
  wire.unchoke = function () {} // important for distributor NOT to transfer the file outside of ZKCP protocol.
  wire.use(wwZkcp(this.privateKey, wrappingPackage))
  wire.ww_zkcp.on('proofOfDistribution', _onProofOfDistribution)

  // iotAddress, infoHash, r, s, given as buffers
  function _onProofOfDistribution (iotAddress, iotSignature, infoHash, r, s) {
    debug('_onProofOfDistribution: iotAddress = %h, infoHash = %h, r = %h, s = %h', iotAddress, infoHash, r, s)
    debug('_onProofOfDistribution: iotSignature =', iotSignature)
    console.log(colors.green("Got proof-of-distribution, now sends 'commit'" + ' [0x' + iotAddress.toString('hex').substring(0, 3) + ']'))
    self.ethereumClient.commit(iotAddress, wrappingPackage.iotAddresses, s, iotSignature, (err) => {
      if (err) {
        debug('_onProofOfDistribution: failed to commit. err =', err)
        return console.error(colors.red("'commit' has failed" + ' [' + iotAddress.substring(0, 5) + ']'))
      }
      // TODO: check commit has succeeded with *this* specific distributor
      console.log(colors.green("'commit' transaction confirmed, now sends 'reveal'" + ' [0x' + iotAddress.toString('hex').substring(0, 3) + ']'))
      self.ethereumClient.reveal(r, iotAddress)
      // will emit KeyRevealed
    })
  }
}

Distributor.prototype._decodeWrappingPackage = async function (file) {
  let wrappingPackage
  file.getBufferAsync = util.promisify(file.getBuffer)
  try {
    let buffer = await file.getBufferAsync()
    debug('_decodeWrappingPackage: buffer =', buffer)
    wrappingPackage = JSON.parse(buffer.toString('utf8'))
    wrappingPackage['file'] = Buffer.from(wrappingPackage['file'])
    wrappingPackage['verificationKey'] = Buffer.from(wrappingPackage['verificationKey'])
    wrappingPackage['provingKey'] = Buffer.from(wrappingPackage['provingKey'])
    debug('wrappingPackage = ', wrappingPackage)
  } catch (err) {
    return console.error(err)
  }
  return wrappingPackage
}

// TODO
Distributor.prototype._isWrappingPackageValid = function (p) {
  // TODO: check signature on sha3(Buffer.concat([fileInfoHash, vk, fileSha256])) against vendor's public key
  // TODO: check createTorrent(p.file).infoHash === infoHash in contract
}

module.exports = Distributor
