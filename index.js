'use strict'

const fs = require('fs')

const escpos = require('escpos')
escpos.USB = require('escpos-usb')
escpos.Network = require('escpos-network')

const jpeg = require('jpeg-js')
const qrImage = require('qr-image')
const pngToJpeg = require('png-to-jpeg')

const ini = require('ini')
const info = ini.parse(fs.readFileSync(__dirname + '/init.conf').toString())
const base = info['base']
const port = Number(base.port)

const ContentBuilder = require('./src/contentBuilder.js')
const contentBuilder = new ContentBuilder()

const utils = require('./src/utils')
const { log, toHex } = utils

const print = function (device, printer, content) {
  printer.lineFeed(4)
  printer.cutPaper(false)
  const buf = Buffer.from(printer.orderData, 'hex')
  device.write(buf)
  log(`Print bill success`, { prefix: '[SUCCESS]', details: JSON.stringify(content) })
  device.close()
}

const printWithQRCode = function (rartingUrl, device, printer, content) {
  pngToJpeg()(qrImage.imageSync(rartingUrl)).then((data) => {
    const jpegBuf = jpeg.decode(data)
    printer.appendText('Please scan the QRcode to evaluate the order.')
    printer.lineFeed(1)
    printer.appendImage(jpegBuf)
    printer.lineFeed(1)
    print(device, printer, content)
  })
}

const app = require('express')()
const http = require('http').Server(app)
const cors = require('cors')
const bodyParser = require('body-parser')
app.use(cors())
app.use(bodyParser.json())

app.post('/print', (req, res) => {
  // Print Bill - 打印客户小票
  if (req.body.toPrintBillContent && req.body.toPrintBillContent.length) {
    for (const item of req.body.toPrintBillContent) {
      if (item.customerContent) {
        let device
        try {
          if (item.hardwareType && item.hardwareType.toLowerCase() == 'usb') {
            device = new escpos.USB(item.vid, item.pid)
          } else {
            device = new escpos.Network(item.ip)
          }
        } catch (error) {
          log(`Print bill error: ${item.hardwareType.toLowerCase() === 'usb' ? `${item.vid}|${item.pid}` : item.ip}|${JSON.stringify(error)}`, { prefix: '[ERROR]' })
          continue
        }

        device.open(function (error) {
          if (error) {
            log(
              `Device open when print bill error: ${['ECONNREFUSED', 'ETIMEDOUT'].includes(error.code) ? 'Device Not Found|' : ''}${
                item.hardwareType.toLowerCase() === 'usb' ? `${item.vid}|${item.pid}` : item.ip
              }|${JSON.stringify(error)}`,
              {
                prefix: '[ERROR]',
              },
            )
          } else {
            const printer = contentBuilder.buildCustomerContent(item.customerContent, base.width)
            if (Boolean(base.evalution_QRCode) && item.customerContent.rartingUrl && item.customerContent.statementID) {
              printWithQRCode(item.customerContent.rartingUrl, device, printer, item.customerContent)
            } else {
              print(device, printer, item.customerContent)
            }
          }
        })
      }
    }
  }

  // Print Order - 打印后厨订单
  if (req.body.toPrintOrderContent && req.body.toPrintOrderContent.length) {
    req.body.toPrintOrderContent.forEach((item) => {
      for (const c of item.chefContent) {
        let device
        try {
          if (item.hardwareType && item.hardwareType.toLowerCase() == 'usb') {
            device = new escpos.USB(item.vid, item.pid)
          } else {
            device = new escpos.Network(item.ip)
          }
        } catch (error) {
          log(`Print order error: ${item.hardwareType.toLowerCase() === 'usb' ? `${item.vid}|${item.pid}` : item.ip}|${JSON.stringify(error)}`, { prefix: '[ERROR]' })
          continue
        }
        device.open(function (error) {
          if (error) {
            log(
              `Device open when print order error: ${['ECONNREFUSED', 'ETIMEDOUT'].includes(error.code) ? 'Device Not Found|' : ''}${
                item.hardwareType.toLowerCase() === 'usb' ? `${item.vid}|${item.pid}` : item.ip
              }|${JSON.stringify(error)}`,
              {
                prefix: '[ERROR]',
              },
            )
          } else {
            const buf = Buffer.from(contentBuilder.buildChefContent(c, base.width).orderData, 'hex')
            device.write(buf)
            log(`Print order success`, { prefix: '[SUCCESS]', details: JSON.stringify(c) })
            device.close()
          }
        })
      }
    })
  }

  res.json({
    resCode: '0',
  })
})

http.listen(port, () => {
  log(`////////// Printer Tool Start //////////`)

  const printers = escpos.USB.findPrinter()

  if (!printers.length) log(`USB Printers Not Found`)
  else {
    log(`${printers.length} USB Printers Found`, {
      prefix: '[SUCCESS]',
      details: JSON.stringify(printers),
    })
    printers.forEach(({ deviceDescriptor: { idVendor: vid, idProduct: pid } }, i) => log(`vid:0x${toHex(vid)}|pid:0x${toHex(pid)}`, { prefix: `Device ${i + 1}:` }))
  }
})
