const fs = require('fs')
const path = require('path')

const log = (str, { prefix = '', details = '' } = {}) => {
  const time = new Date().toLocaleString()
  fs.appendFileSync(path.join(process.cwd(), './.log'), `[${time}]${prefix} ${JSON.stringify(`${str}${details && `|${details}`}`)}\n\n`)
  console.log(`[${time}]${prefix}`, str)
}

const toHex = (str) => str.toString(16).padStart(4, '0')

module.exports = {
  log,
  toHex,
}
