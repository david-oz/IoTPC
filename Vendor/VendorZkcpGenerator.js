const child_process = require('child_process')
const line_ending = /\r?\n/
const MAX_UPDATE_SIZE = 55

function VendorZkcpGenerator () {

}

VendorZkcpGenerator.prototype.gen = function (update_size) {

  return new Promise(function (resolve, reject) {
    if (update_size > MAX_UPDATE_SIZE) {
      reject(new Error('zckpGenerator does not support update file greater than ' + MAX_UPDATE_SIZE + ' bytes'))
    }
    //TODO: add logic to select the right executable for the current cpu architecture
    const prc = child_process.spawn('./gen.x86_64', [update_size], {stdio: ['ignore', 'ignore', 'pipe']})
    let all_data = ''
    prc.stderr.on('data', data => {
      all_data += data
    })
    prc.on('close', code => {
      if (code === 0) {
        const result = all_data.split(line_ending).map(line => Buffer.from(line, 'base64'))
        resolve({'prove_key': result[0], 'verification_key': result[1]})
      }
      else {
        reject(new Error(code))
      }
    })
  })
}

module.exports = VendorZkcpGenerator



