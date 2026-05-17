function formatOfxDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}000000.000`;
}

function formatCurrency(amount: number) {
  return amount.toFixed(2);
}

export function buildOfx(account: any, transactions: any[], startDate: string, endDate: string) {
  const accountNumber = account.number || account.id || '000000';
  const accountName = account.name || 'Actual Budget Account';
  const dtStart = formatOfxDate(new Date(startDate));
  const dtEnd = formatOfxDate(new Date(endDate));
  const dtServer = formatOfxDate(new Date());

  const txnRows = transactions.map((transaction) => {
    const amount = Number(transaction.amount ?? 0);
    const type = amount < 0 ? 'DEBIT' : 'CREDIT';
    const signedAmount = formatCurrency(amount);
    const fitid = String(transaction.id || transaction.import_id || `${transaction.date}-${signedAmount}`);
    const name = transaction.payee?.name || transaction.payee || transaction.memo || accountName;

    return `
      <STMTTRN>
        <TRNTYPE>${type}</TRNTYPE>
        <DTPOSTED>${formatOfxDate(new Date(transaction.date))}</DTPOSTED>
        <TRNAMT>${signedAmount}</TRNAMT>
        <FITID>${fitid}</FITID>
        <NAME>${name}</NAME>
        <MEMO>${transaction.memo || ''}</MEMO>
      </STMTTRN>`;
  }).join('');

  return `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:UTF-8\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n\n<OFX>\n  <SIGNONMSGSRSV1>\n    <SONRS>\n      <STATUS>\n        <CODE>0</CODE>\n        <SEVERITY>INFO</SEVERITY>\n      </STATUS>\n      <DTSERVER>${dtServer}</DTSERVER>\n      <LANGUAGE>ENG</LANGUAGE>\n    </SONRS>\n  </SIGNONMSGSRSV1>\n  <BANKMSGSRSV1>\n    <STMTTRNRS>\n      <TRNUID>1</TRNUID>\n      <STATUS>\n        <CODE>0</CODE>\n        <SEVERITY>INFO</SEVERITY>\n      </STATUS>\n      <STMTRS>\n        <CURDEF>USD</CURDEF>\n        <BANKACCTFROM>\n          <BANKID>${accountNumber}</BANKID>\n          <ACCTID>${accountNumber}</ACCTID>\n          <ACCTTYPE>CHECKING</ACCTTYPE>\n        </BANKACCTFROM>\n        <BANKTRANLIST>\n          <DTSTART>${dtStart}</DTSTART>\n          <DTEND>${dtEnd}</DTEND>${txnRows}\n        </BANKTRANLIST>\n      </STMTRS>\n    </STMTTRNRS>\n  </BANKMSGSRSV1>\n</OFX>`;
}
