const EscPosPrinter = require('./escposPrinter')

class ContentBuilder {
  // 顾客打印模板，实现了打印的样式
  // todo 入参修改为门店对象
  buildCustomerSummary(printer, customerContent) {
    printer.restoreDefaultLineSpacing()
    // printer.lineFeed(1);
    printer.setPrintModes(true, true, true)
    printer.setAlignment(1) // 居中

    printer.setCharacterSize(3, 2)
    printer.appendText(customerContent.shopName)

    printer.lineFeed(2)

    printer.setPrintModes(true, false, false)
    printer.setCharacterSize(1, 1)

    printer.setAlignment(EscPosPrinter.ALIGN_LEFT) // 居左

    let addressDetail = customerContent.address
    printer.appendText(addressDetail)
    printer.lineFeed(2)

    printer.setPrintModes(true, false, false)
    printer.setCharacterSize(2, 2)
    // 区分外卖模式与堂食
    let isDelivery = customerContent.isDelivery // 后续作为入参
    if (isDelivery) {
      let arg1 = printer.columnWidthWithAlignment(204, EscPosPrinter.ALIGN_LEFT)
      let arg2 = printer.columnWidthWithAlignment(0, EscPosPrinter.ALIGN_RIGHT)
      printer.setColumnWidths(arg1, arg2)
      // todo 外卖配送信息
      let receiverName = customerContent.receiverName
      let receiverPhone = customerContent.receiverPhone
      let receiverAdress = customerContent.receiverAdress
      printer.printInColumns(receiverName, receiverPhone)
      printer.appendText(receiverAdress)
    } else {
      printer.setAlignment(1)
      if (customerContent.tableCode) {
        printer.appendText('TABLE ' + customerContent.tableCode)
      } else if (customerContent.takeawayNo) {
        printer.appendText('TAKEAWAY NO. ' + customerContent.takeawayNo)
      }
    }

    printer.lineFeed(1)
    printer.setAlignment(EscPosPrinter.ALIGN_LEFT)
    printer.setPrintModes(false, false, false)
    printer.setCharacterSize(1, 1)
    printer.appendText(EscPosPrinter.DASHED_LINE)
    printer.lineFeed(1)

    if (customerContent.statementID) {
      printer.appendText('Order No.: ' + customerContent.statementID)
      printer.lineFeed(1)
    }

    if (customerContent.customerNum) {
      printer.appendText('Customer: ' + customerContent.customerNum)
      printer.lineFeed(1)
    }

    if (customerContent.attendant) {
      printer.appendText('Attendant: ' + customerContent.attendant)
      printer.lineFeed(1)
    }

    if (customerContent.remark) {
      printer.appendText('Remark: ' + customerContent.remark)
      printer.lineFeed(1)
    }

    if (customerContent.createdDate) {
      printer.appendText('Date: ' + customerContent.createdDate)
    }
    printer.lineFeed(1)
    printer.appendText(EscPosPrinter.DASHED_LINE)
    printer.lineFeed(1)
  }
  buildCustomerFoodList(printer, foodList) {
    printer.setPrintModes(true, true, false)
    printer.setCharacterSize(1, 1)
    printer.setColumnWidths(
      printer.columnWidthWithAlignment(60, EscPosPrinter.ALIGN_LEFT),
      printer.columnWidthWithAlignment(205, EscPosPrinter.ALIGN_LEFT),
      printer.columnWidthWithAlignment(150, EscPosPrinter.ALIGN_RIGHT),
      printer.columnWidthWithAlignment(0, EscPosPrinter.ALIGN_RIGHT),
    )
    printer.printInColumns('Qty', 'Stock Description', 'Price', 'Total')
    printer.setPrintModes(false, false, false)
    printer.appendText(EscPosPrinter.DASHED_LINE)
    printer.lineFeed(1)

    printer.setCharacterSize(1, 1)
    foodList.map((item) => {
      printer.setColumnWidths(
        printer.columnWidthWithAlignment(60, EscPosPrinter.ALIGN_LEFT),
        printer.columnWidthWithAlignment(205, EscPosPrinter.ALIGN_LEFT),
        printer.columnWidthWithAlignment(150, EscPosPrinter.ALIGN_RIGHT),
        printer.columnWidthWithAlignment(0, EscPosPrinter.ALIGN_RIGHT),
      )
      printer.printInColumns(item.num, item.name, item.price, `${parseFloat(item.num) * parseFloat(item.price.replace(/,/g, ''))}`)
      printer.printInColumns('', item.modifier)
    })
    printer.setPrintModes(false, false, false)
    printer.appendText(EscPosPrinter.DASHED_LINE)
    printer.lineFeed(1)
  }
  buildCustomerBottom(printer, customerContent) {
    // todo 判断外卖模式
    let isDeliveryMode = customerContent.isDelivery
    if (isDeliveryMode) {
      printer.setLineSpacing(45)
      printer.setPrintModes(false, true, false)
      printer.setColumnWidths(printer.columnWidthWithAlignment(156, EscPosPrinter.ALIGN_LEFT), printer.columnWidthWithAlignment(0, EscPosPrinter.ALIGN_RIGHT))
      // todo 外卖费
      let deliveryFee = customerContent.deliveryFee
      printer.printInColumns('DELIVERY FEE', deliveryFee)
      printer.restoreDefaultLineSpacing()
    }
    printer.setPrintModes(true, false, false)
    let arg1 = printer.columnWidthWithAlignment(100, EscPosPrinter.ALIGN_LEFT)
    let arg2 = printer.columnWidthWithAlignment(0, EscPosPrinter.ALIGN_RIGHT)
    printer.setColumnWidths(arg1, arg2)

    // 小费
    if (customerContent.tipsFee) {
      printer.printInColumns('Tips', customerContent.tipsFee)
    }

    // 小费
    if (customerContent.discount) {
      printer.printInColumns('Discount', '-' + customerContent.discount)
    }

    // todo 订单总费用
    printer.setCharacterSize(1, 1)
    printer.printInColumns('Amount', customerContent.totalPrice)

    printer.lineFeed(3)
    // printer.setPrintModes(false, false, false)
    // printer.appendText(EscPosPrinter.DASHED_LINE)
    // printer.lineFeed(1)

    // printer.setPrintModes(true, true, false)
    // printer.setAlignment(EscPosPrinter.ALIGN_CENTER)

    // printer.setPrintModes(false, false, false)
    // printer.appendText(EscPosPrinter.DASHED_LINE)
    // printer.lineFeed(1)
  }
  /**
   *
   * @param {Object} customerContent
   * @param {String} printerWidth 80或者58机型
   * @returns
   */
  buildCustomerContent(customerContent, printerWidth = '80') {
    // 1. 构造打印头部总览
    // 2. 构造打印内容 菜
    // 3. 构造打印底部 总结
    let printer = new EscPosPrinter(printerWidth == '80' ? 576 : 384)
    this.buildCustomerSummary(printer, customerContent)
    this.buildCustomerFoodList(printer, customerContent.foodList)
    this.buildCustomerBottom(printer, customerContent)
    return printer
  }

  /**
   *
   * @param {Object} customerContent
   * @param {String} printerWidth 80或者58机型
   * @returns
   */
  buildChefContent(checfContent, printerWidth = '80') {
    let printer = new EscPosPrinter(printerWidth == '80' ? 576 : 384)
    printer.restoreDefaultLineSpacing()
    // printer.lineFeed(1)

    printer.setPrintModes(true, true, true)
    printer.setAlignment(EscPosPrinter.ALIGN_CENTER)

    // 是否是外卖模式
    let isDelivery = checfContent.isDelivery
    if (isDelivery) {
      // 外卖接收人姓名
      let receiverName = checfContent.receiverName
      printer.appendText(receiverName)
    } else {
      // 桌子编码
      if (checfContent.takeawayNo) {
        printer.appendText('TAKEAWAY NO.')
        printer.lineFeed(1)
        printer.appendText(checfContent.takeawayNo)
      } else if (checfContent.tableCode) {
        printer.appendText('TABLE ' + checfContent.tableCode)
      }
    }

    printer.lineFeed(1)
    printer.setPrintModes(false, false, false)
    printer.setAlignment(EscPosPrinter.ALIGN_LEFT)
    printer.appendText(EscPosPrinter.DASHED_LINE)
    printer.lineFeed(1)

    // 账单ID
    let statementID = checfContent.statementID
    printer.appendText('Order No.: ' + statementID)
    printer.lineFeed(1)

    if (checfContent.attendant) {
      printer.appendText('Attendant: ' + checfContent.attendant)
      printer.lineFeed(1)
    }

    // 订单备注
    let remark = checfContent.remark
    if (remark) {
      printer.appendText('Remark: ' + remark)
      printer.lineFeed(1)
    }

    if (checfContent.createdDate) {
      printer.appendText('Date: ' + checfContent.createdDate)
    }
    printer.lineFeed(1)

    // printer.lineFeed(1)
    printer.appendText(EscPosPrinter.DASHED_LINE)
    printer.lineFeed(1)

    printer.setPrintModes(true, false, false)
    printer.setColumnWidths(printer.columnWidthWithAlignment(60, EscPosPrinter.ALIGN_LEFT), printer.columnWidthWithAlignment(0, EscPosPrinter.ALIGN_LEFT))
    printer.printInColumns('Qty', 'Stock Description')
    printer.setPrintModes(false, true, true)
    printer.setCharacterSize(2, 2)

    // 菜数量 菜名称
    printer.printInColumns(checfContent.food.num, checfContent.food.name)

    // 规格
    let modifier = checfContent.food.modifier
    printer.printInColumns('', modifier)
    printer.setPrintModes(false, false, false)
    printer.appendText(EscPosPrinter.DASHED_LINE)
    printer.lineFeed(8)
    printer.cutPaper(false)
    return printer
  }
}

module.exports = ContentBuilder
