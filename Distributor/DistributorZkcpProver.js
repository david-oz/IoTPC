const child_process = require('child_process')
const line_ending = /\r?\n/

function DistributorZkcpProver () {

}

DistributorZkcpProver.prototype.prove = function (proving_key, encryption_key, update_data) {
  return new Promise(function (resolve, reject) {
    //TODO: add logic to select the right executable for the current cpu architecture
    const prc = child_process.spawn('./prove.x86_64', [], {stdio: ['pipe', process.stdout, 'pipe']})
    const input = [proving_key, update_data, encryption_key].map(arg => (Buffer.from(arg).toString('base64'))).join('\n') + '\n'
    prc.stdin.write(input)
    let all_data = ''
    prc.stderr.on('data', data => {
      all_data += data
    })
    prc.on('close', code => {
      if (code === 0) {
        const result = all_data.split(line_ending).map(line => Buffer.from(line, 'base64'))
        resolve({
          'encrypted_update_data': result[0],
          'key_hash': result[1],
          'update_hash': result[2],
          'proof': result[3]
        })
      }
      else {
        reject(new Error(code))
      }
    })
  })
}
module.exports = DistributorZkcpProver

