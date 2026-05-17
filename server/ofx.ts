function formatOfxDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}000000.000`;
}

function formatCurrency(amount: number) {
  return amount.toFixed(2);
}

function escapeOfxText(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function formatTransactionMemo(transaction: any) {
  const memo = normalizeText(transaction.memo);
  const notes = normalizeText(transaction.notes);

  if (memo && isUuidLike(memo) && notes) {
    return notes;
  }

  if (memo && notes && memo !== notes) {
    return `${memo} - ${notes}`;
  }

  return memo || notes;
}

function getTransactionPayeeName(transaction: any) {
  if (!transaction) {
    return "";
  }

  const payee = transaction.payee;
  if (payee && typeof payee === "object") {
    return normalizeText(payee.name || payee.title || payee.id);
  }

  return normalizeText(payee);
}

function getCurrency(account: any) {
  return String(
    account.currency ||
      account.currencyCode ||
      process.env.DEFAULT_CURRENCY ||
      "USD",
  ).toUpperCase();
}

function getAccountType(account: any) {
  const rawType = String(
    account.accountType || account.type || account.offbudget || "",
  ).toLowerCase();

  if (rawType.includes("saving")) {
    return "SAVINGS";
  }

  if (
    rawType.includes("credit") ||
    rawType.includes("card") ||
    rawType === "true"
  ) {
    return "CREDITLINE";
  }

  if (rawType.includes("money") || rawType.includes("market")) {
    return "MONEYMRKT";
  }

  return "CHECKING";
}

export function buildOfx(
  account: any,
  transactions: any[],
  startDate: string,
  endDate: string,
) {
  const accountNumber = account.number || account.id || "000000";
  const accountName = account.name || "Actual Budget Account";
  const currency = getCurrency(account);
  const accountType = getAccountType(account);
  const dtStart = formatOfxDate(new Date(startDate));
  const dtEnd = formatOfxDate(new Date(endDate));
  const dtServer = formatOfxDate(new Date());

  const txnRows = transactions
    .map((transaction) => {
      const amount = Number(transaction.amount ?? 0);
      const type = amount < 0 ? "DEBIT" : "CREDIT";
      const signedAmount = formatCurrency(amount);
      const fitid = String(
        transaction.id ||
          transaction.import_id ||
          `${transaction.date}-${signedAmount}`,
      );
      const memo = formatTransactionMemo(transaction);
      const payeeName = getTransactionPayeeName(transaction);
      const name =
        (payeeName && !isUuidLike(payeeName) ? payeeName : "") ||
        memo ||
        accountName;

      return `
      <STMTTRN>
        <TRNTYPE>${type}</TRNTYPE>
        <DTPOSTED>${formatOfxDate(new Date(transaction.date))}</DTPOSTED>
        <TRNAMT>${signedAmount}</TRNAMT>
        <FITID>${escapeOfxText(fitid)}</FITID>
        <NAME>${escapeOfxText(name)}</NAME>
        <MEMO>${escapeOfxText(memo)}</MEMO>
      </STMTTRN>`;
    })
    .join("");

  return `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:UTF-8\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n\n<OFX>\n  <SIGNONMSGSRSV1>\n    <SONRS>\n      <STATUS>\n        <CODE>0</CODE>\n        <SEVERITY>INFO</SEVERITY>\n      </STATUS>\n      <DTSERVER>${dtServer}</DTSERVER>\n      <LANGUAGE>ENG</LANGUAGE>\n    </SONRS>\n  </SIGNONMSGSRSV1>\n  <BANKMSGSRSV1>\n    <STMTTRNRS>\n      <TRNUID>1</TRNUID>\n      <STATUS>\n        <CODE>0</CODE>\n        <SEVERITY>INFO</SEVERITY>\n      </STATUS>\n      <STMTRS>\n        <CURDEF>${currency}</CURDEF>\n        <BANKACCTFROM>\n          <BANKID>${accountNumber}</BANKID>\n          <ACCTID>${accountNumber}</ACCTID>\n          <ACCTTYPE>${accountType}</ACCTTYPE>\n        </BANKACCTFROM>\n        <BANKTRANLIST>\n          <DTSTART>${dtStart}</DTSTART>\n          <DTEND>${dtEnd}</DTEND>${txnRows}\n        </BANKTRANLIST>\n      </STMTRS>\n    </STMTTRNRS>\n  </BANKMSGSRSV1>\n</OFX>`;
}
