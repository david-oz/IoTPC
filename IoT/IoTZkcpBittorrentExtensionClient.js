'use strict'

const bencode = require('bencode')
const EventEmitter = require('events').EventEmitter
const inherits = require('inherits')
const ethereumjsUtil = require('ethereumjs-util')
const MerkleTree = require('merkle-tree-solidity')
const Utils = require('../Utils/Utils')
const debug = Utils.createDebug('iotpc:iot-zkcp')
const toBuffer = Utils.toBuffer
const IoTZkcpVerifier = require('./IoTZkcpVerifier')

// Prints: the calculated signature

module.exports = function (privateKey, packageMetadata) {
  inherits(wwZkcp, EventEmitter)

  privateKey = toBuffer(privateKey)
  let address = ethereumjsUtil.privateToAddress(privateKey)
  let infoHash = toBuffer(packageMetadata.infoHash)
  let iotAddressesMerkleRoot = toBuffer(packageMetadata.iotAddressesMerkleRoot)
  let vendorAddress = toBuffer(packageMetadata.vendorAddress)
  const zkcpVerifier = new IoTZkcpVerifier()

  function wwZkcp (wire) {
    EventEmitter.call(this)

    this._wire = wire
  }

  // Name of the bittorrent-protocol extension
  wwZkcp.prototype.name = 'ww_zkcp'

  wwZkcp.prototype.onExtendedHandshake = function (handshake) {
    debug('onExtendedHandshake: handshake = %j', handshake)
    if (!handshake.m || !handshake.m.ww_zkcp) {
      this.emit('warning', new Error('Peer does not support ww_zkcp, stopping interaction'))
    }
  }

  wwZkcp.prototype.onMessage = function (buf) {
    var dict
    try {
      dict = bencode.decode(buf)
      debug('onMessage: dict = %j', dict)
    } catch (err) {
      // drop invalid messages
      debug('received error %s', err)
      return
    }

    debug('onMessage: dict = %s', dict)

    switch (dict.msg_type) {
      case 0:
        this._onChallenge(dict.challenge)
        break
      case 2:
        this._onFile(dict.enc_file, dict.s, dict.zk_proof, dict.file_sha256, dict.vk, dict.vendor_signature, dict.distributor_address, dict.merkle_proof)
        break
      case 4:
        this._onReject(dict.reason)
        break
      default:
        this.emit('warning', new Error('Received unsupported message type: ' + dict.msg_type))
        break
    }
  }

  wwZkcp.prototype._onChallenge = function (challenge) {
    debug('_onChallenge: challenge %h', challenge)
    this._challengeSignature(challenge)
  }

  wwZkcp.prototype._onFile = async function (encFile, s, zkProof, fileSha256, vk, vendorSignature, distributorAddress, merkleProof) {
    /*
          1. verify merkleProof (this proof indeed indicates IoT address is a member of the set represented by merkle root)
          2. verify vendorSignature on (infoHash, fileSha256, vk)
          3. verify zkSNARKs on (vk, (encFile, s), zkProof)
        */
    debug('_onFile: encFile = %h, s = %h, zkProof = %h, fileSha256 = %h, vk = %h, vendorSignature = %j, distributorAddress = %h, merkleProof = %j',
      encFile, s, zkProof, vk, vendorSignature, distributorAddress, merkleProof)
    let validProof = MerkleTree.checkProof(merkleProof, iotAddressesMerkleRoot, ethereumjsUtil.sha3(address))
    if (!validProof) {
      return this._reject('Invalid Merkle proof')
    }

    debug('infoHash = ', infoHash)
    debug('fileSha256 = ', fileSha256)
    debug('vk = ', vk)
    let msgHash = ethereumjsUtil.sha3(Buffer.concat([infoHash, fileSha256, vk]))
    debug('msgHash = ', msgHash)
    debug('vendorSignature.r #1 =', vendorSignature.r)
    debug('vendorSignature.s #1 =', vendorSignature.s)
    vendorSignature.r = toBuffer(vendorSignature.r)
    vendorSignature.s = toBuffer(vendorSignature.s)
    debug('vendorSignature.r #2 =', vendorSignature.r)
    debug('vendorSignature.s #2 =', vendorSignature.s)
    let recoveredPublicKey = ethereumjsUtil.ecrecover(msgHash, vendorSignature.v, vendorSignature.r, vendorSignature.s)
    let recoveredAddress = ethereumjsUtil.publicToAddress(recoveredPublicKey)
    debug('recoveredAddress = %h', recoveredAddress)
    if (!recoveredAddress.equals(vendorAddress)) {
      return this._reject('Invalid vendor signature')
    }

    /* verify zkSNARKs */
    let isZkProofValid = await zkcpVerifier.verify(vk, encFile, s, fileSha256, zkProof)
    if (!isZkProofValid) {
      return this._reject('Invalid ZK-proof')
    }

    this._proofOfDistribution(s, distributorAddress)
    this.emit('encryptedFile', encFile, s)
  }

  wwZkcp.prototype._onReject = function (reason) {
    this.emit('warning', new Error('Peer rejected the communication. Reason: ' + reason))
  }

  wwZkcp.prototype._send = function (dict) {
    debug('_send: dict = %j', dict)
    var buf = bencode.encode(dict)
    this._wire.extended('ww_zkcp', buf)
  }

  wwZkcp.prototype._reject = function (reason) {
    this._send({ msg_type: 4, reason })
  }

  wwZkcp.prototype._challengeSignature = function (challenge) {
    let challengeHash = ethereumjsUtil.sha3(challenge)
    debug('_challengeSignature: challengeHash %h', challengeHash)
    let signature = ethereumjsUtil.ecsign(challengeHash, privateKey)
    debug('_challengeSignature: signature %j', signature)
    let dict = { msg_type: 1, iot_address: address, signature }
    this._send(dict)
  }

  wwZkcp.prototype._proofOfDistribution = function (s, pkd) {
    debug('_proofOfDistribution: infoHash = %s', infoHash)
    let hashToSign = ethereumjsUtil.sha3(Buffer.concat([infoHash, s, pkd]))
    debug('_proofOfDistribution: hashToSign = %s', hashToSign.toString('hex'))
    let signature = ethereumjsUtil.ecsign(hashToSign, privateKey)
    this._send({ msg_type: 3, signature })
  }

  return wwZkcp
}
