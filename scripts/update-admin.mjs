const credential = JSON.parse(process.env.ADMIN_ACCOUNT_UPDATE || "{}");
if (credential.identifier !== "cx931774" || !credential.hash || !credential.salt) throw new Error("Missing administrator update credential");
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/5d74a0ba-c455-4fa3-9699-9c104f353009/query`;
const response = await fetch(endpoint, {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    sql: "UPDATE users SET email = ?, password_hash = ?, password_salt = ?, updated_at = ? WHERE email = 'admin' AND role = 'admin' RETURNING id, email, role",
    params: [credential.identifier, credential.hash, credential.salt, Math.floor(Date.now() / 1000)],
  }),
});
const result = await response.json();
if (!response.ok || !result.success) throw new Error(`Administrator update failed: ${JSON.stringify(result.errors)}`);
const rows = result.result?.[0]?.results || [];
if (rows.length !== 1) throw new Error("Expected exactly one existing administrator");
console.log("Administrator account updated successfully");
