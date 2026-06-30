const base = (process.env.PRESENTON_SERVER_URL || "").replace(/\/$/, "");

if (!base) {
  console.log("No PRESENTON_SERVER_URL");
  process.exit(0);
}

const payload = {
  content: "KinQuest family reunion scavenger hunt highlights",
  n_slides: 5,
  language: "English",
  template: "general",
  export_as: "pptx",
};

async function test(label, headers = {}) {
  const url = `${base}/api/v1/ppt/presentation/generate`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    console.log(`\n[${label}] ${response.status} ${response.statusText} ${url}`);
    console.log(text.slice(0, 500));
  } catch (error) {
    console.log(`\n[${label}] ERROR ${error.message}`);
  }
}

(async () => {
  await test("noauth");

  const username = process.env.PRESENTON_USERNAME || "";
  const password = process.env.PRESENTON_PASSWORD || "";
  if (username) {
    const basic = `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
    await test("basic", { Authorization: basic });
  }

  const apiKey = process.env.PRESENTON_API_KEY || "";
  if (apiKey) {
    await test("apikey", {
      Authorization: `Bearer ${apiKey}`,
      "X-API-Key": apiKey,
    });
  }
})();
