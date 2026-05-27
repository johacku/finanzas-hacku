// This goes in the Google Apps Script project linked to the spreadsheet
// Deploy as Web App: Execute as "Me", Access "Anyone"

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Income Segmentation');
    var customerSheet = ss.getSheetByName('Customer List');

    if (!sheet || !customerSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false, error: 'Sheet not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Lookup client in Customer List: match column B, return column A
    var customerData = customerSheet.getDataRange().getValues();
    var clientName = data.client_name || '';
    var matchedClient = clientName; // default to original name

    for (var i = 1; i < customerData.length; i++) {
      if (customerData[i][1] && customerData[i][1].toString().toLowerCase().trim() === clientName.toLowerCase().trim()) {
        matchedClient = customerData[i][0]; // Column A value
        break;
      }
    }

    // Format first month from fecha_emision
    var emissionDate = new Date(data.fecha_emision + 'T00:00:00');
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var firstMonthStr = months[emissionDate.getMonth()] + '/' + String(emissionDate.getFullYear()).slice(-2);

    // Write rows for each installment
    var rows = [];
    var cuotas = data.cuotas || [];

    for (var j = 0; j < cuotas.length; j++) {
      var cuotaDate = new Date(emissionDate.getFullYear(), emissionDate.getMonth() + j, 1);
      var monthYearStr = months[cuotaDate.getMonth()] + '/' + String(cuotaDate.getFullYear()).slice(-2);

      rows.push([
        monthYearStr,                          // A: Month & Year
        matchedClient,                         // B: Client
        cuotas[j].monto_usd || cuotas[j].monto, // C: Amount (USD)
        data.numero_factura || '',             // D: Invoice number / reference
        data.sociedad || '',                   // E: Society
        'Post-Closing',                        // F: Event
        data.vendedor || '',                   // G: Hunter or KAM
        firstMonthStr,                         // H: First month invoice
        'Active MRR',                          // I: Segmentation
        ''                                     // J: Segmentation Plan
      ]);
    }

    if (rows.length > 0) {
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, 10).setValues(rows);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true, rowsAdded: rows.length
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok', service: 'income-segmentation-webhook'
  })).setMimeType(ContentService.MimeType.JSON);
}
