const iconv = require('iconv-lite');
class EscPosPrinter {
    MAX_COLUMNS = 6;      // Maximum columns for printing in columns functio

    static ALIGN_LEFT = 0;       // Left alignment
    static ALIGN_CENTER = 1;     // Center alignment
    static ALIGN_RIGHT = 2;      // Right alignment
    static DASHED_LINE = '--------------------------------';

    HRI_POS_ABOVE = 1;    // HRI above the barcode
    HRI_POS_BELOW = 2;    // HRI below the barcode
    dotsPerLine = 0;
    widthOfColumns = [];
    charHSize = 0;
    orderData = '';

    constructor(dotsPerLine) {
        if (dotsPerLine != 384 && dotsPerLine != 576) // Print width in dots. 384 for 58mm and 576 for 80mm
            dotsPerLine = 384;
        if (dotsPerLine == 384) {
            EscPosPrinter.DASHED_LINE = '--------------------------------';
        } else {
            EscPosPrinter.DASHED_LINE = '-----------------------------------------------';
        }
        this.widthOfColumns = new Array(this.MAX_COLUMNS);
        this.dotsPerLine = dotsPerLine;
        this.charHSize = 1;
        this.orderData = '1b52' + this._numToHexStr(15, 2); // Chinese
    }

    _numToHexStr(n, bytes) {
        var str = '';
        var v;

        for (var i = 0; i < bytes; i++) {
            v = n & 0xFF;
            if (v < 0x10)
                str += '0' + v.toString(16);
            else
                str += v.toString(16);
            n >>= 8;
        }
        return str;
    }

    _unicodeToUtf8(unicode) {
        var c1, c2, c3, c4;

        if (unicode < 0)
            return '';
        if (unicode <= 0x7F) {
            c1 = (unicode & 0x7F);
            return this._numToHexStr(c1, 1);
        }
        if (unicode <= 0x7FF) {
            c1 = ((unicode >> 6) & 0x1F) | 0xC0;
            c2 = ((unicode) & 0x3F) | 0x80;
            return this._numToHexStr(c1, 1) + this._numToHexStr(c2, 1);
        }
        if (unicode <= 0xFFFF) {
            c1 = ((unicode >> 12) & 0x0F) | 0xE0;
            c2 = ((unicode >> 6) & 0x3F) | 0x80;
            c3 = ((unicode) & 0x3F) | 0x80;
            return this._numToHexStr(c1, 1) + this._numToHexStr(c2, 1) + this._numToHexStr(c3, 1);
        }
        if (unicode <= 0x10FFFF) {
            c1 = ((unicode >> 18) & 0x07) | 0xF0;
            c2 = ((unicode >> 12) & 0x3F) | 0x80;
            c3 = ((unicode >> 6) & 0x3F) | 0x80;
            c4 = ((unicode) & 0x3F) | 0x80;
            return this._numToHexStr(c1, 1) + this._numToHexStr(c2, 1) + this._numToHexStr(c3, 1) + this._numToHexStr(c4, 1);
        }
        return '';
    }

    //////////////////////////////////////////////////
    // Basic ESC/POS Commands
    //////////////////////////////////////////////////

    // Append text in the order.
    appendText = function (str) {
        this.orderData += iconv.encode(str, 'GB2312').toString('hex')
    }

    // [LF] Print the contents in the buffer and feed n lines.
    lineFeed = function (n) {
        for (var i = 0; i < n; i++)
            this.orderData += '0a';
    }

    // [ESC @] Restore default settings (line spacing, print modes, etc).
    restoreDefaultSettings = function () {
        this.charHSize = 1;
        this.orderData += '1b40';
    }

    // [ESC 2] Restore default line spacing.
    restoreDefaultLineSpacing = function () {
        this.orderData += '1b32';
    }

    // [ESC 3] Set line spacing.
    setLineSpacing = function (n) {
        if (n >= 0 && n <= 255)
            this.orderData += '1b33' + this._numToHexStr(n, 1);
    }

    // [ESC !] Select print modes (double width/height or not, bold or not).
    setPrintModes = function (bold, double_h, double_w) {
        var n = 0;

        if (bold)
            n |= 8;
        if (double_h)
            n |= 16;
        if (double_w)
            n |= 32;
        this.charHSize = (double_w) ? 2 : 1;
        this.orderData += '1b21' + this._numToHexStr(n, 1);
    }

    // [GS !] Set character size (1~8 times of normal width or height).
    setCharacterSize = function (h, w) {
        var n = 0;

        if (h >= 1 && h <= 8)
            n |= (h - 1);
        if (w >= 1 && w <= 8) {
            n |= (w - 1) << 4;
            this.charHSize = w;
        }
        this.orderData += '1d21' + this._numToHexStr(n, 1);
    }

    // [HT] Jump to the next n TAB positions.
    horizontalTab = function (n) {
        for (var i = 0; i < n; i++)
            this.orderData += '09';
    }

    // [ESC $] Move to horizontal absolute position.
    setAbsolutePrintPosition = function (n) {
        if (n >= 0 && n <= 65535)
            this.orderData += '1b24' + this._numToHexStr(n, 2);
    }

    // [ESC \] Move to horizontal relative position.
    setRelativePrintPosition = function (n) {
        if (n >= -32768 && n <= 32767)
            this.orderData += '1b5c' + this._numToHexStr(n, 2);
    }

    // [ESC a] Set alignment.
    setAlignment = function (n) {
        if (n >= 0 && n <= 2)
            this.orderData += '1b61' + this._numToHexStr(n, 1);
    }

    // [GS V m] Cut paper.
    cutPaper = function (fullCut) {
        this.orderData += '1d56' + ((fullCut) ? '30' : '31');
    }

    // [GS V m n] Postponed cut paper.
    // After sending this command, the cutter will not cut until (76+n) dot lines are fed.
    postponedCutPaper = function (fullCut, n) {
        if (n >= 0 && n <= 255)
            this.orderData += '1d56' + ((fullCut) ? '61' : '62') + this._numToHexStr(n, 1);
    }

    //////////////////////////////////////////////////
    // Print in Columns
    //////////////////////////////////////////////////

    // Return the width of a character.
    _widthOfChar(c) {
        if ((c >= 0x00020 && c <= 0x0036F) ||
            (c >= 0x0FF61 && c <= 0x0FF9F))
            return 12;
        if ((c == 0x02010) ||
            (c >= 0x02013 && c <= 0x02016) ||
            (c >= 0x02018 && c <= 0x02019) ||
            (c >= 0x0201C && c <= 0x0201D) ||
            (c >= 0x02025 && c <= 0x02026) ||
            (c >= 0x02030 && c <= 0x02033) ||
            (c == 0x02035) ||
            (c == 0x0203B))
            return 24;
        if ((c >= 0x01100 && c <= 0x011FF) ||
            (c >= 0x02460 && c <= 0x024FF) ||
            (c >= 0x025A0 && c <= 0x027BF) ||
            (c >= 0x02E80 && c <= 0x02FDF) ||
            (c >= 0x03000 && c <= 0x0318F) ||
            (c >= 0x031A0 && c <= 0x031EF) ||
            (c >= 0x03200 && c <= 0x09FFF) ||
            (c >= 0x0AC00 && c <= 0x0D7FF) ||
            (c >= 0x0F900 && c <= 0x0FAFF) ||
            (c >= 0x0FE30 && c <= 0x0FE4F) ||
            (c >= 0x1F000 && c <= 0x1F9FF))
            return 24;
        if ((c >= 0x0FF01 && c <= 0x0FF5E) ||
            (c >= 0x0FFE0 && c <= 0x0FFE5))
            return 24;
        return 0;
    }

    columnWidthWithAlignment(width, alignment) {
        return ((width & 0xFFFF) | ((alignment & 3) << 16));
    }

    _columnWidth(v) {
        return (v & 0xFFFF);
    }

    _columnAlignment(v) {
        return ((v >> 16) & 3);
    }

    // Set the width and alignment mode for each columns.
    setColumnWidths = function (...args) {
        var i, remain, width, alignment;

        if (args.length == 0)
            return;
        for (i = 0; i < this.MAX_COLUMNS; i++)
            this.widthOfColumns[i] = 0;

        remain = this.dotsPerLine; // Dots not used
        for (i = 0; i < args.length; i++) {
            if (i == this.MAX_COLUMNS) // Maximum columns exceeded
                return;
            width = this._columnWidth(args[i]);
            alignment = this._columnAlignment(args[i]);
            if (width == 0 || width > remain) { // Use all free dots for the last column
                this.widthOfColumns[i] = this.columnWidthWithAlignment(remain, alignment);
                return;
            }
            this.widthOfColumns[i] = args[i];
            remain -= width;
        }
    }

    // Print in columns with the current column settings.
    printInColumns = function (...args) {
        var strcurr = new Array(this.MAX_COLUMNS);
        var strrem = new Array(this.MAX_COLUMNS);
        var strwidth = new Array(this.MAX_COLUMNS);
        var i, j, c, w, columns, width, alignment, pos;
        var done;

        if (args.length == 0)
            return;

        columns = 0;
        for (i = 0; i < args.length; i++) {
            if (i == this.MAX_COLUMNS || this.widthOfColumns[i] == 0)
                break;
            strcurr[i] = '';
            strrem[i] = args[i];
            columns++;
        }

        do {
            done = true;
            pos = 0;
            for (i = 0; i < columns; i++) {
                width = this._columnWidth(this.widthOfColumns[i]);
                if (strrem[i].length == 0) {
                    pos += width;
                    continue;
                }
                done = false;
                strcurr[i] = '';
                strwidth[i] = 0;
                for (j = 0; j < strrem[i].length; j++) {
                    c = strrem[i].charCodeAt(j);
                    if (c == 0x0A) {
                        j++; // Drop the '\n'
                        break;
                    } else {
                        // TODO
                        w = this._widthOfChar(c);
                        if (w == 0) {
                            c = '?';
                            w = 12;
                        }
                        w *= this.charHSize;
                        if (strwidth[i] + w > width) {
                            break;
                        } else {
                            strcurr[i] += String.fromCharCode(c);
                            strwidth[i] += w;
                        }
                    }
                }
                if (j < strrem[i].length)
                    strrem[i] = strrem[i].substring(j);
                else
                    strrem[i] = '';

                alignment = this._columnAlignment(this.widthOfColumns[i]);
                switch (alignment) {
                    case 1:
                        this.setAbsolutePrintPosition(pos + (width - strwidth[i]) / 2);
                        break;
                    case 2:
                        this.setAbsolutePrintPosition(pos + (width - strwidth[i]));
                        break;
                    default:
                        this.setAbsolutePrintPosition(pos);
                        break;
                }
                this.appendText(strcurr[i]);
                pos += width;
            }
            if (!done)
                this.lineFeed(1);
        } while (!done);
    }

    //////////////////////////////////////////////////
    // Barcode / QR Code Printing
    //////////////////////////////////////////////////

    // Append barcode in the order.
    appendBarcode = function (hri_pos, height, module_size, barcode_type, text) {
        var text_length = text.length;

        if (text_length == 0)
            return;
        if (text_length > 255)
            text_length = 255;
        if (height < 1)
            height = 1;
        else if (height > 255)
            height = 255;
        if (module_size < 1)
            module_size = 1;
        else if (module_size > 6)
            module_size = 6;

        this.orderData += '1d48' + this._numToHexStr((hri_pos & 3), 1);
        this.orderData += '1d6600';
        this.orderData += '1d68' + this._numToHexStr(height, 1);
        this.orderData += '1d77' + this._numToHexStr(module_size, 1);
        this.orderData += '1d6b' + this._numToHexStr(barcode_type, 1) + this._numToHexStr(text_length, 1);
        for (var i = 0; i < text_length; i++)
            this.orderData += this._numToHexStr(text.charCodeAt(i), 1);
    }

    // Append QR code in the order.
    appendQRcode = function (module_size, ec_level, text) {
        var text_length = text.length;

        if (text_length == 0)
            return;
        if (text_length > 65535)
            text_length = 65535;
        if (module_size < 1)
            module_size = 1;
        else if (module_size > 16)
            module_size = 16;
        if (ec_level < 0)
            ec_level = 0;
        else if (ec_level > 3)
            ec_level = 3;

        this.orderData += '1d286b040031410000';
        this.orderData += '1d286b03003143' + this._numToHexStr(module_size, 1);
        this.orderData += '1d286b03003145' + this._numToHexStr((ec_level + 48), 1);
        this.orderData += '1d286b' + this._numToHexStr((text_length + 3), 2) + '315030';
        for (var i = 0; i < text_length; i++)
            this.orderData += this._numToHexStr(text.charCodeAt(i), 1);
        this.orderData += '1d286b0300315130';
    }

    //////////////////////////////////////////////////
    // Image Printing
    //////////////////////////////////////////////////

    // Grayscale to mono - diffuse dithering.
    _diffuseDither(src_data, width, height) {
        if (width <= 0 || height <= 0)
            return null;
        if (src_data.length < width * height)
            return null;

        var bmwidth = (width + 7) >> 3;
        var dst_data = new Array(bmwidth * height);
        var line_buffer = new Array(2 * width);
        var i, p, q, x, y, mask;
        var line1, line2, b1, b2, tmp;
        var err, e1, e3, e5, e7;
        var not_last_line;

        line1 = 0;
        line2 = 1;
        for (i = 0; i < width; i++) {
            line_buffer[i] = 0;
            line_buffer[width + i] = src_data[i];
        }

        for (y = 0; y < height; y++) {
            tmp = line1;
            line1 = line2;
            line2 = tmp;
            not_last_line = (y < height - 1);

            if (not_last_line) {
                p = (y + 1) * width;
                for (i = 0; i < width; i++) {
                    line_buffer[line2 * width + i] = src_data[p];
                    p++;
                }
            }

            q = y * bmwidth;
            for (i = 0; i < bmwidth; i++) {
                dst_data[q] = 0;
                q++;
            }

            b1 = 0;
            b2 = 0;
            q = y * bmwidth;
            mask = 0x80;

            for (x = 1; x <= width; x++) {
                var idx = line1 * width + b1;
                if (line_buffer[idx] < 128) { // Black pixel
                    err = line_buffer[idx];
                    dst_data[q] |= mask;
                } else {
                    err = line_buffer[idx] - 255;
                }
                b1++;
                if (mask == 1) {
                    q++;
                    mask = 0x80;
                } else {
                    mask >>= 1;
                }
                e7 = ((err * 7) + 8) >> 4;
                e5 = ((err * 5) + 8) >> 4;
                e3 = ((err * 3) + 8) >> 4;
                e1 = err - (e7 + e5 + e3);
                if (x < width)
                    line_buffer[line1 * width + b1] += e7;
                if (not_last_line) {
                    line_buffer[line2 * width + b2] += e5;
                    if (x > 1)
                        line_buffer[line2 * width + b2 - 1] += e3;
                    if (x < width)
                        line_buffer[line2 * width + b2 + 1] += e1;
                }
                b2++;
            }
        }
        return dst_data;
    }

    // Grayscale to mono - threshold dithering.
    _thresholdDither(src_data, width, height) {
        if (width <= 0 || height <= 0)
            return null;
        if (src_data.length < width * height)
            return null;

        var bmwidth = (width + 7) >> 3;
        var dst_data = new Array(bmwidth * height);
        var p, q, k, x, y, mask;

        p = 0;
        q = 0;
        for (y = 0; y < height; y++) {
            k = q;
            mask = 0x80;
            for (x = 0; x < width; x++) {
                if (src_data[p] < 128) { // Black pixel
                    dst_data[k] |= mask;
                }
                p++;
                if (mask == 1) {
                    k++;
                    mask = 0x80;
                } else {
                    mask >>= 1;
                }
            }
            q += bmwidth;
        }
        return dst_data;
    }

    // RGB to grayscale.
    _convertToGray(imgdata, width, height) {
        var gray_data = new Array(width * height);
        var i = 0, j = 0, x, y, r, g, b;

        for (y = 0; y < height; y++) {
            for (x = 0; x < width; x++) {
                r = imgdata.data[j++] & 0xFF;
                g = imgdata.data[j++] & 0xFF;
                b = imgdata.data[j++] & 0xFF;
                j++; // Skip the Alpha channel
                gray_data[i++] = ((r * 11 + g * 16 + b * 5) >> 5) & 0xFF;
            }
        }
        return gray_data;
    }

    // Append image in the order.
    appendImage = function (imgdata, dither) {
        var gray_data, mono_data;
        var w = imgdata.width;
        var h = imgdata.height;

        gray_data = this._convertToGray(imgdata, w, h);
        if (dither == 'diffuse')
            mono_data = this._diffuseDither(gray_data, w, h);
        else /* if (dither == 'threshold') */
            mono_data = this._thresholdDither(gray_data, w, h);

        w = (w + 7) >> 3;
        this.orderData += '1d763000';
        this.orderData += this._numToHexStr(w, 2);
        this.orderData += this._numToHexStr(h, 2);
        for (var i = 0; i < mono_data.length; i++)
            this.orderData += this._numToHexStr((mono_data[i] & 0xFF), 1);
    }

    //////////////////////////////////////////////////
    // Page Mode Commands
    //////////////////////////////////////////////////

    // Enter page mode.
    enterPageMode = function () {
        this.orderData += '1b4c';
    }

    // Set print area in page mode.
    // x, y: origin of the print area (the left-top corner of the print area)
    // w, h: width and height of the print area
    setPrintAreaInPageMode = function (x, y, w, h) {
        this.orderData += '1b57';
        this.orderData += this._numToHexStr(x, 2);
        this.orderData += this._numToHexStr(y, 2);
        this.orderData += this._numToHexStr(w, 2);
        this.orderData += this._numToHexStr(h, 2);
    }

    // Set print direction in page mode.
    // dir: 0:not rotated; 1:90-degree clockwise rotated;
    //      2:180-degree clockwise rotated; 3:270-degree clockwise rotated
    setPrintDirectionInPageMode = function (dir) {
        if (dir >= 0 && dir <= 3)
            this.orderData += '1b54' + this._numToHexStr(dir, 1);
    }

    // Set absolute print position in page mode.
    setAbsolutePrintPositionInPageMode = function (n) {
        if (n >= 0 && n <= 65535)
            this.orderData += '1d24' + this._numToHexStr(n, 2);
    }

    // Set relative print position in page mode.
    setRelativePrintPositionInPageMode = function (n) {
        if (n >= -32768 && n <= 32767)
            this.orderData += '1d5c' + this._numToHexStr(n, 2);
    }

    // Print contents in the buffer and exit page mode.
    printAndExitPageMode = function () {
        this.orderData += '0c';
    }

    // Print contents in the buffer and keep in page mode.
    printInPageMode = function () {
        this.orderData += '1b0c';
    }

    // Clear contents in the buffer and keep in page mode.
    clearInPageMode = function () {
        this.orderData += '18';
    }

    // Discard contents in the buffer and exit page mode.
    exitPageMode = function () {
        this.orderData += '1b53';
    }
}

module.exports = EscPosPrinter;
