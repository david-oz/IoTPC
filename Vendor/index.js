let Vendor = require('./Vendor')
const express = require('express')
const bodyParser = require('body-parser')
const fs = require('fs')
const path = require('path')
const http = require('http')
const Utils = require('../Utils/Utils')
const configFilePath = './Vendor_config.json'
const restPort = Utils.get_json_attribute(configFilePath, 'rest_server_port')
const WebSocketServer = require('websocket').server
const fileUpload = require('express-fileupload')
const debug = require('debug')('iotpc:vendor-server')

const restApp = express()
restApp.use(fileUpload())
const server = http.createServer(restApp)
const vendor = new Vendor(configFilePath)
server.listen(restPort, '0.0.0.0', function () {
  debug('Listening on ' + restPort)
})
const wsServer = new WebSocketServer({
  httpServer: server
})
vendor.ethereumClient.on('keyRevealedEvent', _onKeyRevealedEvent)
let connection

function _onKeyRevealedEvent (data) {
  if (connection) {
    connection.sendUTF(JSON.stringify(data))
  }
}

// WebSocket server
wsServer.on('request', function (request) {
  debug('client connected')
  connection = request.accept(null, request.origin)
  // vendor.ethereumClient.emit('keyRevealedEvent', {data: 'd5363'})
  connection.on('close', function (connection) {
    // close user connection
    debug('client disconnected')
  })
})

restApp.use(express.static('./WebPages'))

restApp.use(bodyParser.json())

restApp.get('/', function (req, res) {
  res.sendFile(path.join(__dirname + '/WebPages/screen1.html'))
})

restApp.get('/getIoTAddresses', function (req, res) {
  debug('IoT Addresses : ' + vendor.iotAddresses)
  debug('Number of IoT devices : ' + vendor.iotAddresses.length)
  res.send(vendor.iotAddresses)
})

restApp.get('/Map', function (req, res) {
  res.sendFile(path.join(__dirname + '/WebPages/screen2.html'))
})

restApp.post('/uploadFile', function (req, res) {
  if (!req.files) {
    return res.status(400).send('No files were uploaded.')
  }

  let sampleFile = req.files.myFile

  sampleFile.mv('updateFile', function (err) {
    if (err) {
      return res.status(500).send(err)
    }
  })

  vendor.uploadFile('updateFile')
  // mockUploadFile()
  res.redirect('/Map')
})

restApp.post('/sendIotAddress', function (req, res) {
  let iotAddress = req.body.iotAddress
  let json_to_edit = JSON.parse(fs.readFileSync(configFilePath, 'utf8'))
  let iotAddresses = json_to_edit['iot_addresses']
  if (json_to_edit && iotAddresses.indexOf(iotAddress) === -1) {
    iotAddresses.push(iotAddress)
    json_to_edit['iot_addresses'] = iotAddresses
    fs.writeFileSync(configFilePath, JSON.stringify(json_to_edit), 'utf8')
    debug(iotAddress + ' pushed to iotAdresses')
  }
  res.sendStatus(200)
})