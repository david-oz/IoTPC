const fs = require('fs')
const solc = require('solc')
const Web3 = require('web3')
const path = require('path')
const globalConfigFile = path.join(__dirname, '../Files/global_config.json')
const Utils = require(path.join(__dirname, '../Utils/Utils.js'))
const contractPath = path.join(__dirname, '../Files/Contracts/IotPC.sol')
const web3 = new Web3()
const debug = require('debug')('iotpc:setup')
const ethereumJs = require('ethereumjs-util')
const EthereumTx = require('ethereumjs-tx')
const web3Povider = Utils.get_json_attribute(globalConfigFile, 'web3_provider')
const chainId = parseInt(Utils.get_json_attribute(globalConfigFile, 'chain_id'))
web3.setProvider(new Web3.providers.WebsocketProvider(web3Povider))

async function deployFactoryContract (privateKey) {
  debug('contractPath =', contractPath)
  let abiJson = compileContracts(contractPath)
  let deployerAddress = '0x' + ethereumJs.privateToAddress(privateKey).toString('hex')
  debug('deployerAddress = %s', deployerAddress)
  let myContract = new web3.eth.Contract(abiJson.iotpcFactoryAbi)
  let deploy = myContract.deploy({data: '0x' + abiJson.iotpcFactoryContractObjBytecode})
  let data = deploy.encodeABI()
  try {
    let nonce = await web3.eth.getTransactionCount(deployerAddress)
    let gasLimit = await deploy.estimateGas()
    debug('gasLimit = %s', gasLimit)
    let gasPrice = await web3.eth.getGasPrice()
    gasPrice = parseInt(gasPrice)
    debug('gasPrice = %s', gasPrice)
    let balance = await web3.eth.getBalance(deployerAddress)
    debug('balance = %s', balance)
    let txParams = {
      value: 0,
      nonce,
      gasLimit,
      gasPrice,
      data,
      chainId
    }
    debug('txParams = %j', txParams)
    let tx = new EthereumTx(txParams)
    debug('created tx')
    tx.sign(privateKey)
    debug('signed tx')
    let senderAdderss = tx.getSenderAddress()
    debug('senderAdderss = %s', senderAdderss.toString('hex'))
    let serializedTx = '0x' + tx.serialize().toString('hex')
    debug('serializedTx = %s', serializedTx)
    let receipt = await web3.eth.sendSignedTransaction(serializedTx)
    console.log('receipt =', receipt)
    let factoryContractAddress = receipt.contractAddress
    // write changes
    Utils.set_json_attribute(globalConfigFile, 'factory_contract_address', factoryContractAddress, 'Setup: factory_contract_address')
    Utils.set_json_attribute(globalConfigFile, 'iotpc_factory_abi', abiJson.iotpcFactoryAbi, 'Setup: iotpc_factory_abi')
    Utils.set_json_attribute(globalConfigFile,'iotpc_abi', abiJson.iotpcAbi, 'Setup: iotpc_abi')
  } catch (err) {
    console.error(err)
  }
}

function compileContracts (contractFilePath) {
  let contract = fs.readFileSync(contractFilePath, 'utf8')
  let contractCompiled = solc.compile(contract, 1)
  debug('contractCompiled =', contractCompiled)
  let iotpcContractObj = contractCompiled.contracts[':IotPC']
  debug('iotpcContractObj =', iotpcContractObj)
  let iotpcFactoryContractObj = contractCompiled.contracts[':IotPCFactory']
  debug('iotpcFactoryContractObj =', iotpcFactoryContractObj)
  let iotpcFactoryContractObjBytecode = iotpcFactoryContractObj.bytecode
  let iotpcAbi = JSON.parse(iotpcContractObj.interface)
  let iotpcFactoryAbi = JSON.parse(iotpcFactoryContractObj.interface)
  let json = {iotpcAbi, iotpcFactoryAbi, iotpcFactoryContractObjBytecode}
  return json
}

// hard-coded private key. This is very very BAD! Use this method only for Testnet!
deployFactoryContract(Buffer.from('aa2f4955b46b2a8a104d01f7df7a610fb8a929a8b35da9c23ebaffeaf687cdb6', 'hex'))
