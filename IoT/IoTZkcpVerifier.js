const childProcess = require('child_process')
const exec = childProcess.exec

function IoTZkcpVerifier () {

}

IoTZkcpVerifier.prototype.verify = function (verificationKey, encryptedUpdateData, encryptionKeyHash, updateHash, proof) {
  return new Promise(function (resolve, reject) {
    // TODO: add logic to select the right executable for the current cpu architecture
    exec('uname -m', function (error, stdout, stderr) {
      if (error) return reject(error)
      let arch = stdout
      const prc = childProcess.spawn('./verify.' + arch, [], {stdio: ['pipe', process.stdout, process.stderr]})
      const input = [verificationKey, encryptedUpdateData, encryptionKeyHash, updateHash, proof].map(arg => (Buffer.from(arg).toString('base64'))).join('\n') + '\n'
      prc.stdin.write(input)
      prc.on('close', code => {
        if (code === 0) {
          resolve(true)
        } else if (code === 1) {
          resolve(false)
        } else {
          reject(new Error(code))
        }
      })
    })
  })
}

module.exports = IoTZkcpVerifier
