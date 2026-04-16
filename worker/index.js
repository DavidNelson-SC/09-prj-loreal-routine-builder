export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
      const { messages, useWebSearch } = await request.json();

      if (!Array.isArray(messages) || !messages.length) {
        return jsonResponse({ error: "messages array is required" }, 400);
      }

      if (!env.OPENAI_API_KEY) {
        return jsonResponse(
          { error: "OPENAI_API_KEY is missing in Worker secrets" },
          500,
        );
      }

      const model = useWebSearch ? "gpt-4.1-mini" : "gpt-4o";
      const transcript = messages
        .map(
          (message) =>
            `${String(message.role || "user").toUpperCase()}: ${String(message.content || "")}`,
        )
        .join("\n\n");

      const payload = {
        model,
        input: transcript,
      };

      if (useWebSearch) {
        payload.tools = [{ type: "web_search_preview" }];
      }

      const openAiResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await openAiResponse.json();

      if (!openAiResponse.ok) {
        return jsonResponse(
          {
            error: "OpenAI request failed",
            details: data,
          },
          openAiResponse.status,
        );
      }

      const reply = data.output_text || "No response text returned.";
      const citations = extractCitations(data);

      return jsonResponse({ reply, citations }, 200);
    } catch (error) {
      return jsonResponse(
        {
          error: "Worker failed to process the request",
          details: error.message,
        },
        500,
      );
    }
  },
};

function extractCitations(data) {
  const citations = [];

  if (!Array.isArray(data.output)) {
    return citations;
  }

  data.output.forEach((item) => {
    if (!Array.isArray(item.content)) {
      return;
    }

    item.content.forEach((contentItem) => {
      if (!Array.isArray(contentItem.annotations)) {
        return;
      }

      contentItem.annotations.forEach((annotation) => {
        if (annotation.type !== "url_citation") {
          return;
        }

        const url = annotation.url || "";
        const title = annotation.title || "";

        if (!url) {
          return;
        }

        const alreadyExists = citations.some(
          (citation) => citation.url === url,
        );

        if (!alreadyExists) {
          citations.push({ url, title });
        }
      });
    });
  });

  return citations;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}
