const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyG1FnAOxm5tpUcvd4n6kvg9yHn6BMjoNOveUXggaEd6jAoDsyIo6RiYu06dPTxwTm3/exec";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ ok: false, error: "Método no permitido" })
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");

    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const text = await response.text();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { ok: false };
    }

    if (parsed.ok) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true })
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false })
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: String(err)
      })
    };
  }
};
