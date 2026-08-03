// =================================================================
// GOOGLE APPS SCRIPT FOR EXPENSE TRACKER WEB APP SYNC
// =================================================================
// Instructions:
// 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1bfNMmLVRhPTvibBlHYiAP_Wx4zssbUDiZBuyGCW8RNA/edit
// 2. Go to Extensions -> Apps Script
// 3. Delete any code there and paste this ENTIRE code block.
// 4. Click "Save" (disk icon).
// 5. Click "Deploy" -> "New deployment".
// 6. Select type: "Web app".
// 7. Execute as: "Me"
// 8. Who has access: "Anyone" (Crucial for web app sync without API key auth).
// 9. Click "Deploy" and copy the Web App URL.
// 10. Paste the Web App URL inside your Expense Tracker Web App Settings!

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var contents = JSON.parse(e.postData.contents);
    
    // Ensure header row exists
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "ID", 
        "Date & Time", 
        "Type", 
        "Category", 
        "Amount (₹)", 
        "Payment Method", 
        "Notes / Receiver", 
        "IPO Status / Status",
        "Synced At"
      ]);
      // Format header row bold
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#e8f0fe");
    }
    
    // Check if e contains array of transactions or single transaction
    var items = Array.isArray(contents) ? contents : [contents];
    
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      sheet.appendRow([
        item.id || "",
        item.datetime || new Date().toLocaleString("en-IN"),
        item.type || "Expense",
        item.category || "General",
        item.amount || 0,
        item.paymentMethod || "GPay",
        item.notes || "",
        item.status || "Completed",
        new Date().toLocaleString("en-IN")
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ "result": "success", "count": items.length }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Salary & Expense Tracker Sync API is Active!");
}
