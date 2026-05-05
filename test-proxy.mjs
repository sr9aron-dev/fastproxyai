// Test script for API proxy

async function testApi() {
  console.log("Testing API with key: sk_live_IFKiy07kp7MsybJzJ6LcAdjPnVI5f6qVfiDsc_ht2L0");
  
  // Mock Vercel req/res
  const req = {
    method: "POST",
    headers: {
      "authorization": "Bearer sk_live_IFKiy07kp7MsybJzJ6LcAdjPnVI5f6qVfiDsc_ht2L0",
      "content-type": "application/json"
    },
    body: {
      settings: {
        keywordCount: 10
      },
      prompt: "Generate 10 keywords for a beautiful sunset over the mountains."
    }
  };

  let statusCode = 0;
  let responseBody = "";

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    send: (body) => {
      responseBody = body;
      return res;
    },
    setHeader: (key, val) => {}
  };

  try {
    // Note: handler is the vercel-wrapped handler, but I need the raw handler to test easily
    // or I can call the default export which is the vercelHandler
    const vercelHandler = (await import("./api/generate.js")).default;
    await vercelHandler(req, res);

    console.log("Status Code:", statusCode);
    console.log("Response Body:", responseBody);
  } catch (err) {
    console.error("Test failed with error:", err);
  }
}

testApi();
