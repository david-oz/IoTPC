'use strict'

const bencode = require('bencode')
const EventEmitter = require('events').EventEmitter
const inherits = require('inherits')
const crypto = require('crypto')
const ethereumjsUtil = require('ethereumjs-util')
const Utils = require('../Utils/Utils')
const debug = Utils.createDebug('iotpc:distributor-zkcp')
const toBuffer = Utils.toBuffer
const DistributorZkcpProver = require('./DistributorZkcpProver')
const iotAddressesHistory = {} // set of IoT devices that a handshake has already coducted with

module.exports = function (privateKey, wrappingPackage) {
    inherits(wwZkcp, EventEmitter)

    privateKey = toBuffer(privateKey)
    let address = ethereumjsUtil.privateToAddress(privateKey)
    let vk = toBuffer(wrappingPackage.verificationKey) // zk-SNARKs verification key
    let pk = toBuffer(wrappingPackage.provingKey)
    let vendorSignature = wrappingPackage.vendorSignature
    vendorSignature.r = toBuffer(vendorSignature.r)
    vendorSignature.s = toBuffer(vendorSignature.s)
    let infoHash = toBuffer(wrappingPackage.infoHash)
    let file = Buffer.from(wrappingPackage.file, 'utf8')
    let fileSha256 = toBuffer(wrappingPackage.fileSha256)
    let iotAddresses = wrappingPackage.iotAddresses.map(toBuffer)
    let iotAddressesMerkleTree = wrappingPackage.iotAddressesMerkleTree
    const zkcpProver = new DistributorZkcpProver()
    debug('wrappingPackage =', wrappingPackage)

    function wwZkcp (wire) {
        EventEmitter.call(this)

        this._wire = wire
        this.challenge = null
        this.r = null
        this.s = null
        this.iotAddress = null
    }

    // Name of the bittorrent-protocol extension
    wwZkcp.prototype.name = 'ww_zkcp'

    wwZkcp.prototype.onExtendedHandshake = function (handshake) {
        debug('onExtendedHandshake: handshake %j', handshake)
        if (!handshake.m || !handshake.m.ww_zkcp) {
            return this.emit('warning', new Error('Peer does not support ww_zkcp, stopping interaction'))
        }

        this._sendChallenge()
    }

    wwZkcp.prototype.onMessage = function (buf) {
        debug('onMessage #1: buf = %s', buf)
        var dict
        try {
            dict = bencode.decode(buf)
            debug('onMessage: dict = %j', dict)
        } catch (err) {
            // drop invalid messages
            debug('received error %s', err)
            return
        }

        switch (dict.msg_type) {
            case 1:
                this._onChallengeSignature(dict.iot_address, dict.signature)
                break
            case 3:
                this._onProofOfDistribution(dict.signature)
                break
            case 4:
                this._onReject(dict.reason)
                break
            default:
                this.emit('warning', new Error('Received unsupported message type: ' + dict.msg_type))
                break
        }
    }

    wwZkcp.prototype._onChallengeSignature = function (iotAddress, signature) {
        let self = this
        debug('_onChallengeSignature: iotAddress = %h, signature = %j', iotAddress, signature)
        if (iotAddressesHistory[iotAddress]) {
            return self._reject('Already performed handshake with IoT address ' + iotAddress)
        }
        let challengeHash = ethereumjsUtil.sha3(this.challenge)
        let recoveredPublicKey = ethereumjsUtil.ecrecover(challengeHash, signature.v, signature.r, signature.s)
        let recoveredAddress = ethereumjsUtil.publicToAddress(recoveredPublicKey)
        if (!recoveredAddress.equals(iotAddress)) {
            return self._reject('Invalid challenge signature')
        }
        self.iotAddress = iotAddress
        debug('_onChallengeSignature: iotAddresses = ',iotAddresses)
        let iotAddressIndex = iotAddresses.findIndex(element => element.equals(iotAddress))
        if (iotAddressIndex === -1) {
            return self._reject('Not a member of set of expected IoT devices')
        }
        iotAddressesHistory[iotAddress] = true

        async function _sendFile () {
            self.r = crypto.randomBytes(32)
            //self.r = Utils.toBuffer("0x8F9F33005D3298F992172FC3B50D11D70DC5E11042884FD2413ABC109521C4C5")
            self.s = crypto.createHash('sha256').update(self.r).digest()
            let proofObj = await zkcpProver.prove(pk, self.r, file)
            let zkProof = proofObj.proof
            let encFile = proofObj.encrypted_update_data

            let iotAddressHash = ethereumjsUtil.sha3(iotAddress)
            let merkleProof = iotAddressesMerkleTree.getProof(iotAddressHash)

            debug('_sendFile: enc_file = %h, s = %h, zk_proof = %h, file_sha256 = %h, vk = %h, vendor_signature = %j, distributor_address = %h, merkle_proof = %j',
                encFile, self.s, zkProof, fileSha256, vk, vendorSignature, address, merkleProof)

            self._send({
                msg_type: 2,
                enc_file: encFile,
                s: self.s,
                zk_proof: zkProof,
                file_sha256: fileSha256,
                vk: vk,
                vendor_signature: vendorSignature,
                distributor_address: address,
                merkle_proof: merkleProof
            })
        }

        _sendFile()
    }

    wwZkcp.prototype._send = function (dict) {
        var buf = bencode.encode(dict)
        this._wire.extended('ww_zkcp', buf)
    }

    wwZkcp.prototype._sendChallenge = function () {
        this.challenge = crypto.randomBytes(32)
        debug('_sendChallenge: this.challenge = %h', this.challenge)
        this._send({ msg_type: 0, challenge: this.challenge })
    }

    wwZkcp.prototype._reject = function (reason) {
        debug('_reject: reason = %s', reason)
        this._send({ msg_type: 4, reason: reason })
    }

    wwZkcp.prototype._onReject = function (reason) {
        debug('_onReject: reason = %s', reason)
        this.emit('warning', new Error('Peer rejected the communication. Reason: ', reason))
    }

    wwZkcp.prototype._onProofOfDistribution = function (signature) {
        debug('_onProofOfDistribution: signature = %j', signature)
        let messageHash = ethereumjsUtil.sha3(Buffer.concat([infoHash, this.s, address]))
        let recoveredPublicKey = ethereumjsUtil.ecrecover(messageHash, signature.v, signature.r, signature.s)
        let recoveredAddress = ethereumjsUtil.publicToAddress(recoveredPublicKey)
        if (!recoveredAddress.equals(this.iotAddress)) {
            return this._reject('Invalid proof-of-distribution')
        }
        debug('successfully verified proof-of-distribution')
        this.emit('proofOfDistribution', this.iotAddress, signature, infoHash, this.r, this.s)
    }

    return wwZkcp
}
