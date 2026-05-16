const query = `SELECT * FROM Account WHERE AccountType IN 
  ('Income', 'Bank', 'Cost of Goods Sold', 'Expense') 
  MAXRESULTS 200`;

const response = await fetch(
  `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  }
);