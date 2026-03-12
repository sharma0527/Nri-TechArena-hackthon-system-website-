const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = path.join(__dirname, 'registrations.xlsx');
if (fs.existsSync(excelPath)) {
    const workbook = xlsx.readFile(excelPath);
    const sheetName = "Registrations";
    if (workbook.Sheets[sheetName]) {
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        console.log(`Initial rows: ${data.length}`);

        // Using string conversion just in case
        const targetUTR = "326728629305";
        const validData = data.filter(row => {
            const rowUtr = row.UTR ? row.UTR.toString().trim() : "";
            return rowUtr !== targetUTR;
        });
        console.log(`Valid rows: ${validData.length}`);

        // Write back
        workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(validData);
        xlsx.writeFile(workbook, excelPath);
        console.log(`Cleaned ${data.length - validData.length} specific fake records.`);
    }
}
