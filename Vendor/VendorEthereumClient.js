const Web3 = require('web3')
const Utils = require('../Utils/Utils.js')
const globalConfigFile = '../Files/global_config.json'
const EventEmitter = require('events').EventEmitter
const MerkleTreeSolidity = require('merkle-tree-solidity')
const ethereumjsUtil = require('ethereumjs-util')
const EthereumTx = require('ethereumjs-tx')
const inherits = require('inherits')
const debug = require('debug')('iotpc:vendor-ethereum-client')
const colors = require('colors')
const chainId = parseInt(Utils.get_json_attribute(globalConfigFile, 'chain_id'))

function VendorEthereumClient (configFilePath) {
  this.configFilePath = configFilePath
  let provider = Utils.get_json_attribute(this.configFilePath, 'web3_provider')
  this.web3 = new Web3(provider)
  this.address = Utils.get_json_attribute(this.configFilePath, 'vendor_address')
  let passphrase = Utils.get_json_attribute(this.configFilePath, 'vendor_passphrase')
  this.privateKey = Utils.get_private_key(this.configFilePath, passphrase)
  /* Transaction IDs of all seen events.
     This is used to walkaround an occasional web3 provider bug for notifying the same event twice. */
  this.eventsTxHashes = {}
}

inherits(VendorEthereumClient, EventEmitter)

VendorEthereumClient.prototype.deployContract = async function (iotAddresses, packageInfoHash, fileHash, daysTillExpiration, contractValue, deltaToReveal) {
  let self = this
  debug(`deployContract: packageInfoHash = ${packageInfoHash}, fileHash = ${fileHash}, daysTillExpiration = ${daysTillExpiration}, contractValue = ${contractValue}, deltaToReveal = ${deltaToReveal}`)
  let merkleRoot = _generateMerkleRoot(iotAddresses)
  debug('deployContract: merkleRoot =', merkleRoot)
  let factoryContractAddress = Utils.get_factory_contract_address()
  let factoryContractAbi = Utils.get_factory_contract_abi()
  let factoryContract = new self.web3.eth.Contract(factoryContractAbi, factoryContractAddress)
  let createContract = factoryContract.methods.createContract(merkleRoot, packageInfoHash, fileHash, daysTillExpiration, deltaToReveal, iotAddresses.length)
  let data = createContract.encodeABI()
  debug('data =', data)
  try {
    let nonce = await self.web3.eth.getTransactionCount(self.address)
    let gasLimit = await createContract.estimateGas({from: self.address, value: contractValue})
    debug('gasLimit =', gasLimit)
    let gasPrice = await self.web3.eth.getGasPrice()
    gasPrice = parseInt(gasPrice)
    debug('gasPrice =', gasPrice)
    let balance = await self.web3.eth.getBalance(self.address)
    debug('balance =', balance)
    let txParams = {
      value: contractValue,
      nonce,
      gasLimit: 1000000,
      gasPrice,
      data,
      chainId,
      to: factoryContractAddress
    }
    debug('txParams =', txParams)
    let tx = new EthereumTx(txParams)
    debug('created tx')
    tx.sign(Buffer.from(self.privateKey.substring('0x'.length, self.privateKey.length), 'hex'))
    debug('signed tx')
    let senderAdderss = tx.getSenderAddress()
    debug('senderAdderss =', senderAdderss.toString('hex'))
    let serializedTx = '0x' + tx.serialize().toString('hex')
    debug('serializedTx =', serializedTx)
    factoryContract.events.ContractPublished({filter: {contract_creator: self.address}})
      .on('data', data => self._onContractPublished(data))
      .on('error', console.error)
    let receipt = await self.web3.eth.sendSignedTransaction(serializedTx)
    debug('receipt =', receipt)
  } catch (err) {
    console.error(err)
  }
}

function _generateMerkleRoot (iotAddresses) {
  let elements = iotAddresses.map(e => ethereumjsUtil.sha3(e))
  const merkleTree = new MerkleTreeSolidity.default(elements, false)
  const root = merkleTree.getRoot()
  let rootToReturn = '0x' + root.toString('hex')
  return rootToReturn
}

VendorEthereumClient.prototype._onContractPublished = function (data) {
  let self = this
  if (self.eventsTxHashes[data.transactionHash]) {
    return debug('_onContractPublished: exiting, already seen event of this transaction hash')
  }
  self.eventsTxHashes[data.transactionHash] = true
  let newContractAddress = data.returnValues['contract_address']
  debug('_onContractPublished: newContractAddress =', newContractAddress)
  self._subscribeToKeyReveal(newContractAddress)
  Utils.set_json_attribute(self.configFilePath, 'contract', newContractAddress, 'Vendor::contract_address')
  console.log(colors.green('Contract published successfully in ' + newContractAddress))
}

VendorEthereumClient.prototype._subscribeToKeyReveal = function (contractAddress) {
  let self = this
  let currContract = new self.web3.eth.Contract(Utils.get_contract_abi(), contractAddress)
  debug('_subscribeToKeyReveal: subscribed to address ' + contractAddress)
  currContract.events.KeyRevealed()
    .on('data', data => self._onKeyRevealed(data))
    .on('error', console.error)
}

VendorEthereumClient.prototype._onKeyRevealed = function (data) {
  let self = this
  if (self.eventsTxHashes[data.transactionHash]) {
    return debug('_onKeyRevealed: exiting, already seen event of this transaction hash')
  }
  self.eventsTxHashes[data.transactionHash] = true
  console.log(colors.green('IoT ' + data.returnValues.pko + ' successfully updated!'))
  self.emit('keyRevealedEvent', data)
}

module.exports = VendorEthereumClient
