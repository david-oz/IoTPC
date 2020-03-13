
const merkle_tree_solidity = require('merkle-tree-solidity')
const ethereumjs_util = require('ethereumjs-util')
const Web3 = require('web3')
const web3 = new Web3()
const Utils = require('../Utils/Utils.js')
web3.setProvider(new Web3.providers.WebsocketProvider('ws://'.concat('127.0.0.1:8547')))
/* const VendorEthereumClient = require('../Vendor/VendorEthereumClient');
const DistributorEthereumClient = require('../Distributor/DistributorEthereumClient')
const IoTEthereumClient = require('../IoT/IoTEthereumClient')
const VendorWebtorrentClient = require('../Vendor/VendorWebtorrentClient') */

function checkMerkleTree () {
  // create merkle tree
// expects unique 32 byte buffers as inputs (no hex strings)
// if using web3.sha3, convert first -> Buffer(web3.sha3('a'), 'hex')
  let iots = ['0xae1004b7ce327450a7f5a7e8656c22c711a0222d']

  /* for (let i = 0 ; i < iots.length ; i++ ){
        let hash = web3.utils.sha3(iots[i]);
        hash = hash.slice(2)
        console.log(hash);
        elements.push(new Buffer(hash,'hex'));
    } */

  let num_iots = 1048575
  // let num_iots = 10480;
  // let num_iots = 3
  for (let k = 0; k < num_iots; k++) {
    let rand = web3.utils.randomHex(20)
    iots.push(rand)
  }

  console.log('iots len = ' + iots.length)
  let elements = iots.map(e => ethereumjs_util.sha3(e))
  console.log('pko hash = ' + elements[0].toString('hex'))
  const merkleTree = new merkle_tree_solidity.default(elements, false)

  // get the merkle root
  // returns 32 byte buffer
  const root = merkleTree.getRoot()

  // generate merkle proof
  // returns array of 32 byte buffers
  const proof = merkleTree.getProof(elements[0])
  console.log(proof[0].toString('hex'))
  let str_proof = '0x'
  for (let j = 0; j < proof.length; j++) {
    let eachProof = proof[j].toString('hex')
    console.log('eachProof =' + eachProof)
    str_proof += eachProof
  }
  console.log('str_proof = ' + str_proof)
  // check merkle proof in JS
  // returns bool
  // console.log(merkle_tree_solidity.checkProof(proof, root, elements[0]))
  let hash = '0x' + elements[0].toString('hex')
  console.log('hash = ' + hash)
  deploy_contract('0x' + root.toString('hex'), '0xbf64aa8e5c76864fa0a6e0274875d0cc22c95ac3', 4, 100, 200000, str_proof, num_iots + 1)
}

function deploy_contract (merkle_root, file_hash, days_till_expiration, contract_value, delta_to_reveal, proof, num_iots) {
  let vendor_address = '0x76527421efd505b37b62eadd0dcfb0cc723db8e4'
  let vendor_passphrase = 'myvendor1'
  let myContract = new web3.eth.Contract(Utils.get_factory_contract_abi(), Utils.get_factory_contract_address())
  console.log('Vendor::publishContract::Unlocking coinbase account')
  console.log('merkle_root = ' + merkle_root)
  console.log('file_hash = ' + file_hash)
  console.log('days_till_expiration = ' + days_till_expiration)
  console.log('delta_to_reveal = ' + delta_to_reveal)
  web3.eth.personal.unlockAccount(vendor_address, vendor_passphrase, function (error, result) {
    if (error) {
      console.log(error)
    } else {
      console.log('Vendor::publishContract::Coinbase account successfully unlocked')
      myContract.methods.createContract(merkle_root, file_hash, days_till_expiration, delta_to_reveal, num_iots)
        .estimateGas(function (err, gasAmount) {
          console.log('Vendor::publishContract::Gas estimation is ' + gasAmount)
          myContract.methods.createContract(merkle_root, file_hash, days_till_expiration, delta_to_reveal, num_iots)
            .send({
              from: vendor_address,
              gas: 2 * gasAmount,
              value: contract_value,
              gasPrice: 1
            })
            .then(function (transactionApproval) {
              if (transactionApproval.events.ContractPublishmentLogger) {
                let new_contract_address = transactionApproval.events.ContractPublishmentLogger.returnValues[2]
                if (new_contract_address) {
                  console.log('Vendor::publishContract::Contract has been deployed successfully in ' + new_contract_address)
                  // myContract = new web3.eth.Contract(Utils.get_contract_abi(), new_contract_address);
                  // commit(new_contract_address,proof)

                  // Utils.add_contract_address(vendor_config_file_path, new_contract_address);
                  // Utils.set_json_attribute(this.config_file_path,'contract',new_contract_address,'Vendor::contract_address');
                  // myEvents.emit('ContractPublished')
                }
              }
              console.log('Vendor::publishContract::Transaction approval:')
              console.log(transactionApproval)
            })
        })
    }
  })
};

function commit (contract_add, str_proof) {
  let s = '0x7b94fffa6bdd0ac35195d5000c0fda32f4934f98d4285ad98dc73951012c5f97'
  let pko = '0xae1004b7ce327450a7f5a7e8656c22c711a0222d'
  let pko_hash = '0x10e715cea78713335244d7d92eeab1984f430d4632e4c4a12190cc20c743653e'
  let signature = '0x858a5f3fee19ee1b31cb6c3ceadbd1949e7a8c3ac87e2471c2aec6bfe0f457622e20ece838b5af912fcd172c8c9a3f83ae1384dbc42a3c67d1b631d899a73ec71c'
  let dist_add = '0x2d315132b33e28721c1b8006c7d41196d23725e0'
  let dist_pass = 'mydist1'
  signature = signature.substr(2, signature.length)
  let sig_r = '0x' + signature.substr(0, 64)
  let sig_s = '0x' + signature.substr(64, 64)
  let sig_v = web3.utils.hexToNumber(signature.substr(128, 2))
  console.log('sig_r = ' + sig_r)
  console.log('sig_s =' + sig_s)
  console.log('sig_v =' + sig_v)
  let myContract = new web3.eth.Contract(Utils.get_contract_abi(), contract_add)
  console.log('Distributor::commit::Unlocking coinbase account')
  web3.eth.personal.unlockAccount(dist_add, dist_pass, function (error, result) {
    if (error) {
      console.log(error)
    } else {
      console.log('Distributor::commit::Coinbase account successfully unlocked')
      myContract.methods.commit(pko, pko_hash, str_proof, s, sig_v, sig_r, sig_s)
        .estimateGas(function (err, gasAmount) {
          console.log('Distributor::commit::Gas estimation is ' + gasAmount)
          myContract.methods.commit(pko, pko_hash, str_proof, s, sig_v, sig_r, sig_s)
            .send({
              from: dist_add,
              gas: gasAmount,
              gasPrice: 1
            })
            .then(function (transactionApproval) {
              console.log('Distributor::commit::transaction approval')
              console.log(transactionApproval)
              console.log(transactionApproval.events.Logger)
              reveal(contract_add, str_proof)
            })
        })
    }
  })
}

function reveal (contract_add, str_proof) {
  let dist_add = '0x2d315132b33e28721c1b8006c7d41196d23725e0'
  let dist_pass = 'mydist1'
  let t = '0x81ebbea0de6d1948a436c37b9b923ba0810f413d2d1b047cb7668c6b4697a023'
  let r = web3.utils.soliditySha3(dist_add, t)
  console.log('r = ' + r)
  let s = web3.utils.soliditySha3(r)
  console.log('s = ' + s)
  // 0x7b94fffa6bdd0ac35195d5000c0fda32f4934f98d4285ad98dc73951012c5f97
  let pko = '0xae1004b7ce327450a7f5a7e8656c22c711a0222d'
  let pko_hash = '0x10e715cea78713335244d7d92eeab1984f430d4632e4c4a12190cc20c743653e'
  let myContract = new web3.eth.Contract(Utils.get_contract_abi(), contract_add)
  console.log('Distributor::reveal::Unlocking coinbase account')
  web3.eth.personal.unlockAccount(dist_add, dist_pass, function (error, result) {
    if (error) {
      console.log(error)
    } else {
      console.log('Distributor::reveal::Coinbase account successfully unlocked')
      myContract.methods.reveal(t, r, pko)
        .estimateGas(function (err, gasAmount) {
          console.log('Distributor::reveal::Gas estimation is ' + gasAmount)
          myContract.methods.reveal(t, r, pko)
            .send({
              from: dist_add,
              gas: 10 * gasAmount,
              gasPrice: 1
            })
            .then(function (transactionApproval) {
              console.log('Distributor::reveal::transaction approval')
              console.log(transactionApproval)
              // TODO : delte this
            })
        })
    }
  })
}

function vendorUploadUpdate () {
  let vendorWebTClient = new VendorWebtorrentClient('../Vendor/Vendor_config.json')
  let vk = '8ffd454b52771f2edddde5c79640d5ca00c5924051df9304cb968a71a41603bd'
  let pk = '393d10a5e4c9682532544597ec71c7059b91a0c7c4ade58a20261b51bb22e04f'
  let vendorSignature = '0xd20d0c727814ab0aea4fbd4907ba29ead721226309c48fe4753b973ecf04f3ac'
  let iot_pks = Utils.get_json_attribute('../Vendor/Vendor_config.json', 'iot_public_keys')
  vendorWebTClient.uploadUpdate('../Files/Updates/Update1_1.txt', vk, pk, iot_pks)
}

// vendorUploadUpdate()
function test_vendor_deploy_contract () {
  const vendor = new VendorEthereumClient('../Vendor/Vendor_config.json')
  let iot_pks = ['0xae1004b7ce327450a7f5a7e8656c22c711a0222d', '0x0784943c5cc9a59ef21117cfc29fa98dd62bb6f0', '0xeca2a39f24d7540ebf402ef2e8dcdc89c2a6101a',
    '0x86f1796b2ef9fc15a4810662e048922930e07edc']
  let file_hash = '0xbf64aa8e5c76864fa0a6e0274875d0cc22c95ac3'
  let day_till_expiration = 4
  let contract_value = 100
  let delta_to_reveal = 200000
  vendor.deploy_contract(iot_pks, file_hash, day_till_expiration, contract_value, delta_to_reveal)
}

function test_distributor_commit () {
  let pko = '0xae1004b7ce327450a7f5a7e8656c22c711a0222d'
  let s = '0x7b94fffa6bdd0ac35195d5000c0fda32f4934f98d4285ad98dc73951012c5f97'
  const dist = new DistributorEthereumClient('../Distributor/Distributor_config.json')
  const file_hash = '0xbf64aa8e5c76864fa0a6e0274875d0cc22c95ac3'
  let hash_to_sign = web3.utils.soliditySha3(file_hash, s)
  dist.web3.eth.personal.sign(hash_to_sign, pko, 'myiot1', function (err, signature) {
    if (!err) {
      dist.commit(pko, s, signature, function () {
      })
    }
  })
}

function test_distributor_reveal () {
  let t = '0x81ebbea0de6d1948a436c37b9b923ba0810f413d2d1b047cb7668c6b4697a023'
  const dist = new DistributorEthereumClient('../Distributor/Distributor_config.json')
  let r = web3.utils.soliditySha3(dist.address, t)
  console.log('r = ' + r)
  let s = web3.utils.soliditySha3(r)
  console.log('s = ' + s)
  let pko = '0xae1004b7ce327450a7f5a7e8656c22c711a0222d'
  let pko_hash = '0x10e715cea78713335244d7d92eeab1984f430d4632e4c4a12190cc20c743653e'
  dist.reveal(pko, t, r)
}

function test_distributor_subscribe () {
  const dist = new DistributorEthereumClient('../Distributor/Distributor_config.json')
  dist.subscribe_to_contract_publishment()
}

function test_iot_subscribe () {
  const iot = new IoTEthereumClient('../IoT/IoT_config.json')
  iot.subscribe_to_contract_publishment()
}

// automate_configCreation()

function automate_configCreation () {
  const configCreation = require('../Utils/ConfigCreation.js')
  let web3_provider = 'wss://ropsten.infura.io/ws'
  // vendor
  let vendorAccountJson = web3.eth.accounts.create()
  let vendorPrivateKey = vendorAccountJson.privateKey.toString()
  let vendorAddress = vendorAccountJson.address.toString()
  let vendorEncKey = (web3.eth.accounts.encrypt(vendorPrivateKey, 'myvendor'))
  // dist
  for (let i = 0; i < 8; i++) {
    let distAccountJson = web3.eth.accounts.create()
    let distPrivateKey = distAccountJson.privateKey.toString()
    let distAddress = distAccountJson.address.toString()
    let distEncKey = (web3.eth.accounts.encrypt(distPrivateKey, 'dist'))
    configCreation.distributor_create_config_file_from_json(distAddress, 'mydist', vendorAddress, web3_provider, '../Files/DownloadedFiles/', distEncKey, '/home/user/accounts/Distributors/dist_' + i + '.json')
  }
  let iots = []
  // iots
  for (let j = 0; j < 45; j++) {
    let iotAccountJson = web3.eth.accounts.create()
    let iotPrivateKey = iotAccountJson.privateKey.toString()
    let iotAddress = iotAccountJson.address.toString()
    let iotEncryptedKey = (web3.eth.accounts.encrypt(iotPrivateKey, 'myiot'))
    configCreation.iot_create_config_file_from_json(iotAddress, 'myiot', vendorAddress, web3_provider, iotEncryptedKey, '/home/user/accounts/Iots/iot_' + j + '.json', './downloads')
    iots.push(iotAddress)
  }

  configCreation.vendor_create_config_file_from_json(vendorAddress, 'myvendor', 4, iots, web3_provider, vendorEncKey, '/home/user/accounts/vendor.json')
}

function hashAddress(address){
  console.log(ethereumjs_util.sha3().toString('hex'))
}
//hashAddress("0x99e0b4eda9e11a7aa54ccb2a3cf7826eb4f268c5")
//create_dist_config(12)
function create_dist_config (n) {
  const vendorAddress = '0x2ae919bd945220c9c3cb782a5d4245485cc7251e'
  const web3_provider = 'wss://ropsten.infura.io/ws'
  const configCreation = require('../Utils/ConfigCreation.js')
  for (let i = 0; i < n; i++) {
    let distAccountJson = web3.eth.accounts.create()
    let distPrivateKey = distAccountJson.privateKey.toString()
    let distAddress = distAccountJson.address.toString()
    let distEncKey = (web3.eth.accounts.encrypt(distPrivateKey, 'dist'))
    configCreation.distributor_create_config_file_from_json(distAddress, 'dist', [vendorAddress], web3_provider, '../Files/DownloadedFiles/', distEncKey, '/home/user/accounts/Distributors/dist_' + i + '.json')
  }
}

function test_iot_decrypt(){
  const IoT = require ('../IoT/IoT.js')
  const iot = new IoT()
  const key = '0xddd5de08080cdad6ad80deed124e24e233b52c14ca67dd748dede22c02357b70'
  const data = Buffer.from('yishai')
  let res = iot._decrypt(data, key)
  let res2 = iot._decrypt(res, key)
  console.log(res2.toString('utf8'))
}
//test_iot_decrypt()

// test_distributor_reveal()
// test_distributor_commit()
// test_iot_subscribe()

// test_distributor_subscribe()
// checkMerkleTree()
// test_distributor_commit()
// test_distributor_reveal()
// test_vendor_deploy_contract()
// commit()

/* let file_hash = "0xbf64aa8e5c76864fa0a6e0274875d0cc22c95ac3"
let pko = "0xae1004b7ce327450a7f5a7e8656c22c711a0222d"
console.log('pko_hash = '+web3.utils.soliditySha3(pko))
let t = '0x81ebbea0de6d1948a436c37b9b923ba0810f413d2d1b047cb7668c6b4697a023'
let pkd = "0x2d315132b33e28721c1b8006c7d41196d23725e0"
let r = web3.utils.soliditySha3(pkd,t);
console.log('r = '+r)
let s = web3.utils.soliditySha3(r)
console.log('s = '+s)
let hash_to_sign = web3.utils.soliditySha3(file_hash,s)
web3.eth.personal.sign(hash_to_sign,pko,'myiot1',function(err,signature){
    if(!err){
        console.log('sign = '+signature)
        signature = signature.substr(2, signature.length);
        let sig_r = '0x' + signature.substr(0, 64);
        let sig_s = '0x' + signature.substr(64, 64);
        let sig_v = web3.utils.hexToNumber(signature.substr(128, 2));
        console.log('sig_r = '+sig_r)
        console.log('sig_s ='+sig_s)
        console.log('sig_v ='+sig_v)
    }
}) */

// 406885

// pko_hash = 7c168fa08108afb17b69a834eb492ee0e9839a36427b1cc26c3c1e2ae31635f6
// console.log(web3.utils.soliditySha3('0x3bbb057aed002ec7689d415589d0da9227d10b00'))

// web3.eth.getBlock('pending',true).then(console.log)

/*
let dist_add = "0x2d315132b33e28721c1b8006c7d41196d23725e0"
let t = '0x81ebbea0de6d1948a436c37b9b923ba0810f413d2d1b047cb7668c6b4697a023'
let r = web3.utils.soliditySha3(dist_add,t);
console.log('s =' +web3.utils.soliditySha3(r)) */
/*
console.log(web3.utils.randomHex(4))
console.log(web3.utils.randomHex(20)) */
// console.log(web3.utils.sha3("0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03"))
