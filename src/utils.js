const fs = require('fs')
const path = require('path')

/**
 * 获取某个文件的大小（mb）
 * https://stackoverflow.com/questions/42363140/how-to-find-the-size-of-the-file-in-node-js
 * @param {string} fileName 文件名
 */
function getFileSizeInMegaBytes(fileName) {
  if (fs.existsSync(fileName)) {
    const stats = fs.statSync(fileName)
    const fileSizeInBytes = stats['size']
    const fileSizeInMegabytes = fileSizeInBytes / 1000000.0
    return fileSizeInMegabytes
  }
  return 0
}

/**
 * 文件大小大于 1MB 则删除该文件
 * @param {string} fileName 文件名
 * @param {number} [megaBytes] 文件大小，默认 1 MB
 */
function unlinkFileIfSizeOver(fileName, megaBytes = 1) {
  const fileSizeInMegabytes = getFileSizeInMegaBytes(fileName)
  if (fileSizeInMegabytes > megaBytes) {
    fs.unlinkSync(fileName)
  }
}

const log = (str, { prefix = '', details = '' } = {}) => {
  const logPath = path.join(process.cwd(), './app.log')
  unlinkFileIfSizeOver(logPath)
  const time = new Date().toLocaleString()
  fs.appendFileSync(logPath, `[${time}] ${prefix}${JSON.stringify(`${str}${details && `|${details}`}`)}\n`)
  console.log(`[${time}] ${prefix}`, str)
}

const toHex = (str) => str.toString(16).padStart(4, '0')

module.exports = {
  log,
  toHex,
}
