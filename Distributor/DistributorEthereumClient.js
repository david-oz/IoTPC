module.exports = DistributorEthereumClient
const Web3 = require('web3')
const MerkleTree = require('merkle-tree-solidity')
const ethereumjsUtil = require('ethereumjs-util')
const EthereumTx = require('ethereumjs-tx')
const EventEmitter = require('events').EventEmitter
const inherits = require('inherits')
const debug = require('debug')('iotpc:distributor-ethereum-client')
const colors = require('colors')
const Utils = require('../Utils/Utils.js')
const globalConfigFile = '../Files/global_config.json'
const chainId = parseInt(Utils.get_json_attribute(globalConfigFile, 'chain_id'))

/**
 * @constructor
 */
function DistributorEthereumClient (configFilePath) {
  this.configFilePath = configFilePath
  this.web3 = new Web3()
  const provider = Utils.get_json_attribute(this.configFilePath, 'web3_provider')
  this.web3.setProvider(new Web3.providers.WebsocketProvider(provider))
  this.address = Utils.get_json_attribute(this.configFilePath, 'address')
  let passphrase = Utils.get_json_attribute(this.configFilePath, 'passphrase')
  this.privateKey = Utils.get_private_key(this.configFilePath, passphrase)
  /* Transaction IDs of all seen events of 'ContractPublished'.
   This is used to walkaround an occasional web3 provider bug for notifying the same event twice. */
  this.contractPublishedTxHashes = {}
}

inherits(DistributorEthereumClient, EventEmitter)

DistributorEthereumClient.prototype.subscribeToContractPublished = function () {
  let self = this
  let factoryContractAddress = Utils.get_factory_contract_address()
  let currContract = new self.web3.eth.Contract(Utils.get_factory_contract_abi(), factoryContractAddress)
  console.log(colors.green('Distributor subscribed to contract ' + factoryContractAddress))
  let permissionedVendors = Utils.get_json_attribute(self.configFilePath, 'permissioned_vendors').map(s => s.toLowerCase())
  currContract.events.ContractPublished({filter: {contract_creator: permissionedVendors}})
    .on('data', (event) => self._onContractPublished(event))
    .on('error', console.error)
}

DistributorEthereumClient.prototype._onContractPublished = function (event) {
  let self = this
  console.log(colors.green('Received event of new published contract'))
  debug('_onContractPublished: event =', event)
  debug('_onContractPublished:' + event.returnValues.contract_creator + ' published new contract in address ' + event.returnValues.contract_address)
  if (self.contractPublishedTxHashes[event.transactionHash]) {
    return debug('_onContractPublished: exiting, already seen event of this transaction hash')
  }
  self.contractPublishedTxHashes[event.transactionHash] = true
  Utils.set_json_attribute(self.configFilePath, 'contract', event.returnValues.contract_address, 'Distributor::contract_address')
  let packageInfoHash = event.returnValues.package_info_hash
  let merkleRoot = event.returnValues.merkle_root
  let numOfIotDevices = parseInt(event.returnValues.n)
  self.emit('newContract', packageInfoHash, merkleRoot, numOfIotDevices)
}

DistributorEthereumClient.prototype.subscribeToPastContracts = function () {
  let self = this
  let factoryContractAddress = Utils.get_factory_contract_address()
  let currContract = new self.web3.eth.Contract(Utils.get_factory_contract_abi(), factoryContractAddress)

  currContract.getPastEvents('ContractPublishmentLogger', {
    fromBlock: 0,
    toBlock: 'latest'
  }, function (error, events) {
    debug(events)
  })
}

// pko, iotAddresses, s given as buffers
DistributorEthereumClient.prototype.commit = async function (pko, iotAddresses, s, signature, cb) {
  let self = this
  pko = '0x' + pko.toString('hex')
  s = '0x' + s.toString('hex')
  let pko_hash = '0x' + ethereumjsUtil.sha3(pko).toString('hex')
  let sig_r = '0x' + signature.r.toString('hex')
  let sig_s = '0x' + signature.s.toString('hex')
  let sig_v = signature.v
  // debug('pko =', pko)
  // debug('s =', s)
  // debug('pko_hash =', pko_hash)
  // debug('sig_r =', sig_r)
  // debug('sig_s =', sig_s)
  // debug('sig_v =', sig_v)
  let proof = generateMerkleProof(pko, iotAddresses)
  let contractAddress = Utils.get_json_attribute(self.configFilePath, 'contract')
  let iotPcContract = new self.web3.eth.Contract(Utils.get_contract_abi(), contractAddress)
  let commit = iotPcContract.methods.commit(pko, pko_hash, proof, s, sig_v, sig_r, sig_s)
  let data = commit.encodeABI()
  try {
    let nonce = await self._getNonce(pko)
    let gasLimit = await commit.estimateGas({from: self.address})
    // debug('commit: gasLimit =', gasLimit)
    let gasPrice = await self.web3.eth.getGasPrice()
    gasPrice = parseInt(gasPrice)
    // debug('commit: gasPrice =', gasPrice)
    let balance = await self.web3.eth.getBalance(self.address)
    debug('commit: balance =', balance)
    let txParams = {
      nonce,
      gasLimit,
      gasPrice,
      data,
      chainId,
      to: contractAddress
    }
    debug('commit: txParams =', txParams, '[' + pko.substring(0, 5) + ']')
    let tx = new EthereumTx(txParams)
    // debug('commit: created tx')
    tx.sign(Buffer.from(self.privateKey.substring('0x'.length, self.privateKey.length), 'hex'))
    // debug('commit: signed tx')
    let serializedTx = '0x' + tx.serialize().toString('hex')
    let receipt = await self.web3.eth.sendSignedTransaction(serializedTx)
    debug('commit: receipt =', receipt, '[' + pko.substring(0, 5) + ']')
    cb()
  } catch (error) {
    cb(error)
  }
}

DistributorEthereumClient.prototype.reveal = async function (r, pko) {
  let self = this
  pko = '0x' + pko.toString('hex')
  r = '0x' + r.toString('hex')
  // debug('pko = ', pko)
  // debug('r = ', r)
  let contractAddress = Utils.get_json_attribute(self.configFilePath, 'contract')
  let iotPcContract = new self.web3.eth.Contract(Utils.get_contract_abi(), contractAddress)

  let reveal = iotPcContract.methods.reveal(r, pko)
  let data = reveal.encodeABI()
  try {
    let nonce = await self._getNonce(pko)
    let gasLimit = await reveal.estimateGas({from: self.address})
    // debug('reveal: gasLimit =', gasLimit)
    let gasPrice = await self.web3.eth.getGasPrice()
    gasPrice = parseInt(gasPrice)
    // debug('reveal: gasPrice =', gasPrice)
    let balanceBeforeReveal = await self.web3.eth.getBalance(self.address)
    // debug('reveal: balance before reveal =', balanceBeforeReveal)
    let txParams = {
      nonce,
      gasLimit,
      gasPrice,
      data,
      chainId,
      to: contractAddress
    }
    debug('reveal: txParams =', txParams, '[' + pko.substring(0, 5) + ']')
    let tx = new EthereumTx(txParams)
    // debug('reveal: created tx')
    tx.sign(Buffer.from(self.privateKey.substring('0x'.length, self.privateKey.length), 'hex'))
    // debug('reveal: signed tx')
    // let senderAdderss = tx.getSenderAddress()
    // debug('reveal: senderAdderss =', senderAdderss.toString('hex'))
    let serializedTx = '0x' + tx.serialize().toString('hex')
    let receipt = await self.web3.eth.sendSignedTransaction(serializedTx)
    debug('reveal: receipt =', receipt, '[' + pko.substring(0, 5) + ']')
    let balanceAfterReveal = await self.web3.eth.getBalance(self.address)
    debug('reveal: Balance after reveal = ' + balanceAfterReveal, '[' + pko.substring(0, 5) + ']')
    let balanceDiff = balanceAfterReveal - balanceBeforeReveal
    console.log(colors.green('Got ' + self.web3.utils.fromWei(balanceDiff.toString(), 'ether') + ' ether !' + ' [' + pko.substring(0, 5) + ']'))
  } catch (error) {
    throw new Error(error)
  }
}

let currentNonce = -1
DistributorEthereumClient.prototype._getNonce = async function (pko) {
  let self = this
  try {
    debug('_getNonce #1: currentNonce =', currentNonce, '[' + pko.substring(0, 5) + ']')
    let nonce = await this.web3.eth.getTransactionCount(self.address)
    currentNonce = Math.max(nonce, currentNonce + 1)
    debug('_getNonce #2: currentNonce =', currentNonce, '[' + pko.substring(0, 5) + ']')
    return currentNonce
  } catch (err) {
    throw new Error(err)
  }
}

function generateMerkleProof (pko, iotsAddresses) {
  // debug('generateMerkleProof: pko = ', pko)
  // debug('generateMerkleProof: iotsAddresses = ', iotsAddresses)
  let elements = iotsAddresses.map(e => ethereumjsUtil.sha3(e))
  let pkoIndex = iotsAddresses.indexOf(pko)

  // debug('generateMerkleProof: elements = ', elements)
  // debug('generateMerkleProof: pkoIndex = ', pkoIndex)
  const merkleTree = new MerkleTree.default(elements, false)
  const proof = merkleTree.getProof(elements[pkoIndex])
  //debug('proof = ' + proof)
  let strProof = '0x'
  for (let j = 0; j < proof.length; j++) {
    let eachProof = proof[j].toString('hex')
    strProof += eachProof
  }
  // debug('generateMerkleProof: strProof =', strProof)
  return strProof
}
