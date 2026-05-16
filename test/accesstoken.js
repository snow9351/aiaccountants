// Exchange Intuit authorization code for tokens.
//
// From repo root:
//   node --env-file=test/.env ./test/accesstoken.js
// From this folder (test):
//   node --env-file=.env ./accesstoken.js
//
// test/.env (KEY=value per line). Either set works:
//   CLIENT_ID / CLIENT_SECRET / AUTH_CODE / REDIRECT_URI
//   or INTUIT_CLIENT_ID / INTUIT_CLIENT_SECRET / INTUIT_AUTH_CODE / INTUIT_REDIRECT_URI

const CLIENT_ID = process.env.INTUIT_CLIENT_ID ?? process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.INTUIT_CLIENT_SECRET ?? process.env.CLIENT_SECRET;
const AUTH_CODE = process.env.INTUIT_AUTH_CODE ?? process.env.AUTH_CODE;
const REDIRECT_URI = process.env.INTUIT_REDIRECT_URI ?? process.env.REDIRECT_URI;

if (!CLIENT_ID || !CLIENT_SECRET || !AUTH_CODE || !REDIRECT_URI) {
  console.error(
    "Missing env. Set CLIENT_ID, CLIENT_SECRET, AUTH_CODE, REDIRECT_URI (or INTUIT_* equivalents) in test/.env\n" +
      "From repo root: node --env-file=test/.env ./test/accesstoken.js\n" +
      "From test/:      node --env-file=.env ./accesstoken.js"
  );
  process.exit(1);
}

const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`, "utf8").toString("base64");

const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
  method: "POST",
  headers: {
    Authorization: "Basic " + basic,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code: AUTH_CODE,
    redirect_uri: REDIRECT_URI,
  }),
});

const body = await response.json();
if (!response.ok) {
  console.error("Token exchange failed:", response.status, body);
  process.exit(1);
}

const { access_token, refresh_token } = body;
console.log("OK — access_token length:", access_token?.length);
console.log("OK — refresh_token length:", refresh_token?.length);
