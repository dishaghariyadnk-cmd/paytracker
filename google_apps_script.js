// Google Apps Script Code for Live Google Sheet Sync & Color Coding
// Paste this code into Extensions -> Apps Script in your Google Sheet!

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    // Header setup if sheet is brand new
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Transaction ID", "Date Time", "Type", "Category", "Amount (₹)", "Payment Method", "Notes / Receiver", "Logged By", "Status"]);
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#0f172a").setFontColor("#ffffff");
    }

    var loggedUser = (data.loggedBy || data.logged_by || "").toString();

    // Append new payment row
    sheet.appendRow([
      data.id || "",
      data.datetime || "",
      data.type || "Expense",
      data.category || "",
      data.amount || 0,
      data.paymentMethod || data.payment_method || "",
      data.notes || "",
      loggedUser,
      data.status || "Completed"
    ]);

    var lastRow = sheet.getLastRow();
    var rowRange = sheet.getRange(lastRow, 1, 1, 9);

    // Apply distinct color coding per user
    if (loggedUser.toLowerCase().indexOf("dish") !== -1 || loggedUser.toLowerCase().indexOf("owner") !== -1) {
      // Soft Pink tint for Disha
      rowRange.setBackground("#fce4ec").setFontColor("#880e4f");
    } else if (loggedUser.toLowerCase().indexOf("shiv") !== -1) {
      // Soft Indigo tint for Shivdattsinh
      rowRange.setBackground("#e8eaf6").setFontColor("#1a237e");
    } else {
      rowRange.setBackground("#f8fafc").setFontColor("#0f172a");
    }

    return ContentService.createTextOutput(JSON.stringify({ result: "success", row: lastRow }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ result: "error", error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("DiShiv PayTracker Google Apps Script Endpoint is Live!");
}

