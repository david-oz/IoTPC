
let DistributorEthereumClient = require('../Distributor/DistributorEthereumClient');
//let VendorEthereumClient = require('../Vendor/VendorEthereumClient');
let IoTEthereumClient = require( '../IoT/IoTEthereumClient')
let Utils = require('../Utils/Utils.js');


// distributor signs with its private key, and commit on his own address (instead on the iot address),
// which is not included in the iot_address saved in the contract
// the commit action failes

function distributor_impersonate_iot(){

    let distributor = new DistributorEthereumClient('../Distributor/Distributor_config.json');
    let file_hash = "0xbf64aa8e5c76864fa0a6e0274875d0cc22c95ac3"
    let t = '0xf7f018b9ffd6dd6c7bf12112ce58ba864dfca780f24bd6f592cb5171a1485a15' // should be randomly generated, hard coded for testing purposes
    let r = distributor.web3.utils.soliditySha3(distributor.address,t);
    let s = distributor.web3.utils.soliditySha3(r)
    console.log("s = "+s)
    let hash_to_sign = distributor.web3.utils.soliditySha3(file_hash,s)
    let signature_object = distributor.web3.eth.accounts.sign(hash_to_sign, Utils.get_private_key(distributor.config_file_path,
        distributor.passphrase,
        distributor.web3
    ))
    distributor.commit(distributor.address, s, signature_object.signature,function(){
        distributor.reveal(distributor.address, t ,r)
    } )

}

// an iot signs twice for one file hash. then two distributors trying to get a reward for those signatures.
// after the first distributor gets the reward the other failes.
function iot_double_spend(){

// TODO : add contract deployment before everything

    let distributor_1 = new DistributorEthereumClient('../Distributor/Distributor_config.json');
    let distributor_2 = new DistributorEthereumClient('../Distributor/Distributor2_config');
    let t1 = '0xf7f018b9ffd6dd6c7bf12112ce58ba864dfca780f24bd6f592cb5171a1485a15' // should be randomly generated, hard coded for testing purposes
    let r1 = distributor_1.web3.utils.soliditySha3(distributor_1.address,t1);
    let t2 = '0xf7f018b9ffd6dd6c7bf12112ce58ba864dfca780f24bd6f592cb5171a1485a13' // should be randomly generated, hard coded for testing purposes
    let r2 = distributor_2.web3.utils.soliditySha3(distributor_2.address,t2);
    let s1 = distributor_1.web3.utils.soliditySha3(r1)
    let s2 = distributor_2.web3.utils.soliditySha3(r2)

    let iot = new IoTEthereumClient('../IoT/IoT_config.json');
    let file_hash = "0xbf64aa8e5c76864fa0a6e0274875d0cc22c95ac3"
    let hash_to_sign_1 = iot.web3.utils.soliditySha3(file_hash,s1)
    let hash_to_sign_2 = iot.web3.utils.soliditySha3(file_hash,s2)
    let signature_object_1 = iot.web3.eth.accounts.sign(hash_to_sign_1, Utils.get_private_key(iot.config_file_path,
        iot.passphrase,
        iot.web3
    ))
    let signature_object_2 = iot.web3.eth.accounts.sign(hash_to_sign_2, Utils.get_private_key(iot.config_file_path,
        iot.passphrase,
        iot.web3
    ))
    distributor_1.commit(distributor_1.address, s1, signature_object_1.signature,function(){
        distributor_1.reveal(distributor_1.address, t1 ,r1 , function(){
            distributor_2.commit(distributor_2.address,s2, signature_object_2.signature ,function(){
                distributor_2.reveal(distributor_1.address, t2 ,r2 , function(){

                })
            } )
        })
    } )


}



/*
DistributorEthereumClient.create_config_file("0x0dbc3a552a6d16ec296019e9f0102d33f784c3e8",'mydist2',["0xb9f697599feb74b857faac0fef1fcfdb13576ca9"],"127.0.0.1",
    '',5000,"../Files/DownloadedFiles/",'/home/user/Desktop/1','/home/user/Desktop/Distributor2_config')
*/

//distributor_impersonate_iot()
//iot_double_spend()

/*new VendorEthereumClient('../Vendor/Vendor_config.json').deploy_contract(["0x6a7609813348a0d5e933514968da132d991ebc3c"],'0xbf64aa8e5c76864fa0a6e0274875d0cc22c95ac3',
    4,100,200000)*/
/*
distributor.create_config_file("0x7c635a6dbc4479bd4a6d4d8bdcc8d4dce7738ac3",'mydist1',["0xb9f697599feb74b857faac0fef1fcfdb13576ca9"],
    '127.0.0.1','',5000,"../Files/DownloadedFiles/",'/home/user/Desktop/1','/home/user/Desktop/Distributor_config.json')*/

/*
new VendorEthereumClient().create_config_file("0xb9f697599feb74b857faac0fef1fcfdb13576ca9",'myvendor1',2,["0x3bbb057aed002ec7689d415589d0da9227d10b00"]
,'127.0.0.1','',5001,'/home/user/Desktop/2','/home/user/Desktop/Vendor_config.json')*/

/*
new IoTEthereumClient().create_config_file("0x3bbb057aed002ec7689d415589d0da9227d10b00", 'myiot1', "0xb9f697599feb74b857faac0fef1fcfdb13576ca9", '127.0.0.1',
'',["8020","8030","8070","8080","8090"],'/home/user/Desktop/3','/home/user/Desktop/IoT_config.json'  )*/
