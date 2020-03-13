module.exports = IoTEthereumClient
const Web3 = require('web3')
const Utils = require('../Utils/Utils.js')
const EventEmitter = require('events').EventEmitter
const inherits = require('inherits')
const debug = require('debug')('iotpc:iot-ethereum-client')
const colors = require('colors')

/**
 * @constructor
 */
function IoTEthereumClient (configFilePath) {
  this.configFilePath = configFilePath
  this.address = Utils.get_json_attribute(this.configFilePath, 'address')
  this.web3 = new Web3()
  const provider = Utils.get_json_attribute(this.configFilePath, 'web3_provider')
  this.web3.setProvider(new Web3.providers.WebsocketProvider(provider))
  /* Transaction IDs of all seen events.
   This is used to walkaround an occasional web3 provider bug for notifying the same event twice. */
  this.eventsTxHashes = {}
}

inherits(IoTEthereumClient, EventEmitter)

IoTEthereumClient.prototype.subscribeToPastContracts = function () {
  let self = this
  let factoryContractAddress = Utils.get_factory_contract_address()
  let currContract = new self.web3.eth.Contract(Utils.get_factory_contract_abi(), factoryContractAddress)
  currContract.getPastEvents('ContractPublished', {fromBlock: 0, toBlock: 'latest'}, function (error, events) {
    debug(events)
  })
}

IoTEthereumClient.prototype.subscribeToContractPublished = function () {
  let self = this
  let factoryContractAddress = Utils.get_factory_contract_address()
  let currContract = new self.web3.eth.Contract(Utils.get_factory_contract_abi(), factoryContractAddress)
  console.log(colors.green('IoT subscribed to contract ' + factoryContractAddress))
  let vendor = Utils.get_json_attribute(self.configFilePath, 'vendor').toLowerCase()
  debug('subscribeToContractPublished: vendor = ', vendor)
  currContract.events.ContractPublished({filter: {contract_creator: vendor}})
    .on('data', (event) => self._onContractPublished(event))
    .on('error', console.error)
}

IoTEthereumClient.prototype._onContractPublished = function (event) {
  let self = this
  debug('_onContractPublished: event =', event)
  debug('_onContractPublished: ' + event.returnValues.contract_creator + ' published new contract in address ' + event.returnValues.contract_address)
  if (self.eventsTxHashes[event.transactionHash]) {
    return debug('_onContractPublished: exiting, already seen event of this transaction hash')
  }
  self.eventsTxHashes[event.transactionHash] = true
  console.log(colors.green('Received event of new published contract'))
  Utils.set_json_attribute(self.configFilePath, 'contract', event.returnValues.contract_address, 'IoT::contract_address')
  let infoHash = event.returnValues.filehash
  let merkleRoot = event.returnValues.merkle_root
  self._subscribeToKeyRevealed(event.returnValues.contract_address)
  self.emit('newUpdate', infoHash, merkleRoot)
}

IoTEthereumClient.prototype._subscribeToKeyRevealed = function (contractAddress) {
  let self = this
  let currContract = new self.web3.eth.Contract(Utils.get_contract_abi(), contractAddress)
  debug('subscribeToKeyRevealed: subscribed to address = %s', contractAddress)
  currContract.events.KeyRevealed({filter: {pko: self.address}})
    .on('data', (event) => self._onKeyRevealed(event))
    .on('error', console.error)
}

IoTEthereumClient.prototype._onKeyRevealed = function (event) {
  let self = this
  if (self.eventsTxHashes[event.transactionHash]) {
    return debug('_onKeyRevealed: exiting, already seen event of this transaction hash')
  }
  self.eventsTxHashes[event.transactionHash] = true
  let r = event.returnValues['r']
  debug('subscribeToKeyRevealed: published r is %s', r)
  self.emit('rReady', Utils.trim0x(r))
}
