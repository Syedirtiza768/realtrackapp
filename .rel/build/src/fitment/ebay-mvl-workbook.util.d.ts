import * as XLSX from 'xlsx';
export declare function readMvlWorkbook(filePath: string, password?: string): XLSX.WorkBook;
export declare function sheetToRows(workbook: XLSX.WorkBook, sheetName: string): {
    headers: string[];
    rows: unknown[][];
};
