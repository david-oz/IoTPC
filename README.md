# IoTPatchPool
IoTPatchPool is a Blockchain-based incentivized IoT software updates delivery network.

## Overview
The project consists of three main components: Vendor, Distributor and IoT. The process begins when a vendor releases a new patch update, uploads the update via our webApp, and publishes Ethereum smart contract that is responsible for the validation and incentivisation of proof of distribution. Then, each of the IoT devices and distributors are notified that there's new patch update waiting to be delivered. The distributor then downloads the patch update, delivers it to the any iot devices desired, gets a proof of distribution from each of the IoT devices, submits those proofs to a smart contract and gets his payment instantly.

## Technology stack
IoT Patching Pool uses a number of open source projects to work properly:

* [JQuery](https://jquery.com/) - HTML enhanced for web apps
* [Node.js](https://nodejs.org/) - asynchrnous event driven runtime environment for JavaScript in the server
* [Express](https://expressjs.com/) - fast Node.js network applciation framework
* [Web3.js](https://github.com/ethereum/web3.js/) - Ethereum compatible JavaScript API node.js module which implements the Generic JSON RPC spec
* [WebTorrent](https://webtorrent.io/) - streaming torrent client for the web browser and the desktop
* [libsnark](https://github.com/scipr-lab/libsnark) - cryptographic system for proving/verifying the integrity of computations in zero-knowledge


## Manual Installation
IoT Patching Pool requires:
* [Node.js](https://nodejs.org/) v8+ 
* libgmpxx4ldbl, libgmp3-dev

### Install node.js & npm
```sh
$ sudo apt-get install nodejs-legacy
$ curl -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -
$ sudo apt-get install -y nodejs
```
### Install libgmpxx4ldbl, libgmp3-dev
```sh
$ sudo apt-get install libgmpxx4ldbl libgmp3-dev
```
### Get the code
```sh
$ git clone https://git.tlabs.bgu.ac.il/IoT/devel.git
$ cd devel
$ git checkout develop
```
Now the code resides inside the IoTPC directory. before any code execution one should install all necessary node.js dependencies declared inside IoTPC/package.json :
```sh
$ cd IoTPC
$ npm install
```
### Deploy the factory contract

_If you want a quick start, you can skip this step._

As mentioned in the overview, each time a vendor releases new patch update, a corresponding Ethereum smart contract is being created. These contracts are created through some factory contract called IotPCFactory. Both iot devices and distributors are subscribed to this IotPCFactory contract, and thus get notified when there's a new patch update available.
In order to deploy IotPCFactory contract :
```sh
$ npm run setup
```
The output of this command is the receipt of the _factory contract_ deployment. This is the factory contract all players should listen to.<br>
Therefore, we then copy `contractAddress` from the output, into the property `factory_contract_address` in global_config.json. 

### Install component-specific modules 
As mentioed in the overview, the project consists of three main components: Vendor, Distributor, IoT. each component holds its own node.js dependencies described in package.json. Let's install all node.js dependencies for vendor component:
```sh
$ cd Vendor
$ npm install
```
You should do the same for IoT, and Distributor directories.

### Run the code
Now, all set and ready for execution, Let's run this thing! 
on each component : 
```sh
$ npm start
```
Now, the vendor component had started a web server listening on the port defined in Vendor/Vendor_config.json under 'rest_server_port'. Open up your browser and go to http://vendor_ip:rest_server_port, and choose an update file to initiate the process.  
