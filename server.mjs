import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const PORT = Number(
  process.env.PORT || 4000
);

const OLLAMA_URL =
  process.env.OLLAMA_URL ||
  "http://127.0.0.1:11434";

const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL ||
  "ibm/granite4.2:8b";

/* =========================================================
   RESPONSE HELPER
========================================================= */

function sendJson(
  res,
  statusCode,
  data
) {
  const body =
    JSON.stringify(data);

  res.writeHead(
    statusCode,
    {
      "Content-Type":
        "application/json; charset=utf-8",

      "Content-Length":
        Buffer.byteLength(body),

      "Access-Control-Allow-Origin":
        "*",

      "Access-Control-Allow-Headers":
        "Content-Type",

      "Access-Control-Allow-Methods":
        "GET,POST,OPTIONS",
    }
  );

  res.end(body);
}

/* =========================================================
   REQUEST BODY
========================================================= */

async function readRequestBody(req) {
  return new Promise(
    (resolve, reject) => {
      let body = "";

      req.on(
        "data",
        (chunk) => {
          body += chunk;
        }
      );

      req.on(
        "end",
        () => {
          try {
            resolve(
              JSON.parse(
                body || "{}"
              )
            );
          } catch {
            reject(
              new Error(
                "Invalid JSON request body."
              )
            );
          }
        }
      );

      req.on(
        "error",
        reject
      );
    }
  );
}

/* =========================================================
   OLLAMA STATUS
========================================================= */

async function getOllamaStatus() {
  try {
    const response =
      await fetch(
        `${OLLAMA_URL}/api/tags`
      );

    if (!response.ok) {
      return {
        available: false,
        modelAvailable: false,
        models: [],
      };
    }

    const data =
      await response.json();

    const models =
      Array.isArray(
        data.models
      )
        ? data.models
        : [];

    const modelAvailable =
      models.some(
        (model) => {
          const name =
            String(
              model.name || ""
            );

          return (
            name ===
              OLLAMA_MODEL ||
            name.split(":")[0] ===
              OLLAMA_MODEL.split(":")[0]
          );
        }
      );

    return {
      available: true,
      modelAvailable,

      models:
        models.map(
          (model) =>
            model.name
        ),
    };
  } catch {
    return {
      available: false,
      modelAvailable: false,
      models: [],
    };
  }
}

/* =========================================================
   SAFE NUMBER
========================================================= */

function nullableNumber(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

/* =========================================================
   NORMALIZE AI RESULT
========================================================= */

function normalizeResult(
  result
) {
  const safe =
    result &&
    typeof result ===
      "object"
      ? result
      : {};

  return {
    country:
      String(
        safe.country || ""
      ),

    sourceCountry:
      String(
        safe.sourceCountry ||
          ""
      ),

    product:
      String(
        safe.product || ""
      ),

    year:
      nullableNumber(
        safe.year
      ),

    scenarioTariffPercent:
      nullableNumber(
        safe.scenarioTariffPercent
      ),

    intent:
      String(
        safe.intent ||
          "tariff_impact"
      ),

    summary:
      String(
        safe.summary || ""
      ),

    fact:
      String(
        safe.fact || ""
      ),

    inference:
      String(
        safe.inference ||
          ""
      ),

    possibility:
      String(
        safe.possibility ||
          ""
      ),
  };
}

/* =========================================================
   PARSE GRANITE JSON
========================================================= */

function parseModelJson(
  text
) {
  const cleaned =
    String(text)
      .trim()
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();

  try {
    return JSON.parse(
      cleaned
    );
  } catch {
    const start =
      cleaned.indexOf("{");

    const end =
      cleaned.lastIndexOf("}");

    if (
      start !== -1 &&
      end > start
    ) {
      return JSON.parse(
        cleaned.slice(
          start,
          end + 1
        )
      );
    }

    throw new Error(
      "Granite returned invalid JSON."
    );
  }
}

/* =========================================================
   NATIVE HTTP REQUEST TO OLLAMA
   This avoids the previous fetch/Undici timeout.
========================================================= */

function postJsonToOllama(
  endpoint,
  payload,
  timeoutMs
) {
  return new Promise(
    (resolve, reject) => {
      const parsedUrl =
        new URL(endpoint);

      const body =
        JSON.stringify(
          payload
        );

      const isHttps =
        parsedUrl.protocol ===
        "https:";

      const transport =
        isHttps
          ? https
          : http;

      const request =
        transport.request(
          {
            protocol:
              parsedUrl.protocol,

            hostname:
              parsedUrl.hostname,

            port:
              parsedUrl.port ||
              (isHttps
                ? 443
                : 80),

            path:
              `${parsedUrl.pathname}${parsedUrl.search}`,

            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",

              "Content-Length":
                Buffer.byteLength(
                  body
                ),
            },
          },

          (response) => {
            let responseBody =
              "";

            response.setEncoding(
              "utf8"
            );

            response.on(
              "data",
              (chunk) => {
                responseBody +=
                  chunk;
              }
            );

            response.on(
              "end",
              () => {
                const statusCode =
                  response.statusCode ||
                  500;

                if (
                  statusCode <
                    200 ||
                  statusCode >=
                    300
                ) {
                  reject(
                    new Error(
                      `Ollama returned HTTP ${statusCode}: ${responseBody}`
                    )
                  );

                  return;
                }

                try {
                  resolve(
                    JSON.parse(
                      responseBody
                    )
                  );
                } catch {
                  reject(
                    new Error(
                      "Ollama returned invalid JSON."
                    )
                  );
                }
              }
            );
          }
        );

      request.setTimeout(
        timeoutMs,
        () => {
          request.destroy(
            new Error(
              `Ollama request exceeded the ${Math.round(
                timeoutMs / 60000
              )}-minute timeout.`
            )
          );
        }
      );

      request.on(
        "error",
        (error) => {
          reject(error);
        }
      );

      request.write(
        body
      );

      request.end();
    }
  );
}

/* =========================================================
   BUILD AI PROMPT
========================================================= */

function buildPrompts(
  question,
  dataContext
) {
  const compactContext = {
    countries:
      Array.isArray(
        dataContext?.countries
      )
        ? dataContext.countries
        : [],

    products:
      Array.isArray(
        dataContext?.products
      )
        ? dataContext.products
        : [],

    industries:
      Array.isArray(
        dataContext?.industries
      )
        ? dataContext.industries
        : [],

    tradeRelationships:
      Array.isArray(
        dataContext?.tradeRelationships
      )
        ? dataContext.tradeRelationships
        : [],

    tariffScenarios:
      Array.isArray(
        dataContext?.tariffScenarios
      )
        ? dataContext.tariffScenarios
        : [],

    downstreamRelationships:
      Array.isArray(
        dataContext?.downstreamRelationships
      )
        ? dataContext.downstreamRelationships
        : [],
  };

  const systemPrompt = `
You are the AI reasoning engine inside TariffGraph AI.

Your job is to explain the potential effects of a tariff or trade-policy scenario.

You receive:
1. a user's natural-language question;
2. a structured prototype trade dataset.

Use the structured data as the evidence base.

STRICT RULES:

- Never invent countries.
- Never invent source countries.
- Never invent products.
- Never invent industries.
- Never invent companies.
- Never invent trade volumes.
- Never invent statistics.
- Never invent trade relationships.
- Do not turn an inference into a fact.
- Do not claim that a tariff increase WILL cause a specific economic outcome.
- Use cautious terms such as "could", "may", "potentially", and "might".
- If the user explicitly states a source country, preserve it.
- If the user does not explicitly state a source country, return an empty string for sourceCountry.
- If the user explicitly states a tariff percentage, preserve it.
- If the user explicitly states a year, preserve it.
- Facts must come from the question or supplied prototype data.
- Inferences must be logical explanations based on those facts.
- Possibilities must be clearly described as potential downstream effects.
- Treat all supplied trade data as prototype/demo data, not as live official statistics.
- Return ONLY valid JSON.
`;

  const userPrompt = `
USER QUESTION:
${question}

PROTOTYPE TRADE DATA:
${JSON.stringify(
    compactContext,
    null,
    2
  )}

Return exactly this JSON object:

{
  "country": "",
  "sourceCountry": "",
  "product": "",
  "year": null,
  "scenarioTariffPercent": null,
  "intent": "tariff_impact",
  "summary": "",
  "fact": "",
  "inference": "",
  "possibility": ""
}

FIELD RULES:

country:
The destination country explicitly stated or clearly identifiable from the question.

sourceCountry:
Only return a source country when the USER explicitly states it using wording such as "from Taiwan".
Otherwise return "".

product:
Return the matching product from the supplied product list.

year:
Return the year explicitly stated by the user. Otherwise null.

scenarioTariffPercent:
Return the tariff percentage explicitly stated by the user. Otherwise null.

summary:
Give a concise explanation of the modeled scenario.

fact:
State only facts supported by the supplied question or prototype data.

inference:
Explain what the tariff change could logically mean for import costs, manufacturers, or production costs.

possibility:
Explain cautious downstream effects that may potentially occur.

Do not invent statistics or companies.
`;

  return {
    systemPrompt,
    userPrompt,
  };
}

/* =========================================================
   GRANITE ANALYSIS
========================================================= */

async function analyzeWithGranite(
  question,
  dataContext
) {
  const {
    systemPrompt,
    userPrompt,
  } =
    buildPrompts(
      question,
      dataContext
    );

  const endpoint =
    `${OLLAMA_URL.replace(
      /\/$/,
      ""
    )}/api/chat`;

  console.log(
    `[AI] Sending request to ${OLLAMA_MODEL}`
  );

  const response =
    await postJsonToOllama(
      endpoint,
      {
        model:
          OLLAMA_MODEL,

        messages: [
          {
            role:
              "system",

            content:
              systemPrompt,
          },

          {
            role:
              "user",

            content:
              userPrompt,
          },
        ],

        /*
          Thinking is disabled because TariffGraph
          needs a structured answer rather than a
          long visible reasoning process.
        */
        think:
          false,

        stream:
          false,

        format:
          "json",

        keep_alive:
          "10m",

        options: {
          temperature:
            0.2,

          num_ctx:
            8192,

          num_predict:
            600,
        },
      },

      10 * 60 * 1000
    );

  const generatedText =
    response?.message
      ?.content || "";

  if (
    !generatedText
  ) {
    throw new Error(
      "Granite returned an empty response."
    );
  }

  const parsed =
    parseModelJson(
      generatedText
    );

  const normalized =
    normalizeResult(
      parsed
    );

  console.log(
    "[AI] Granite response received."
  );

  return normalized;
}

/* =========================================================
   HTTP SERVER
========================================================= */

const server =
  http.createServer(
    async (
      req,
      res
    ) => {

      /* ---------------------------------------------------
         CORS PREFLIGHT
      --------------------------------------------------- */

      if (
        req.method ===
        "OPTIONS"
      ) {
        res.writeHead(
          204,
          {
            "Access-Control-Allow-Origin":
              "*",

            "Access-Control-Allow-Headers":
              "Content-Type",

            "Access-Control-Allow-Methods":
              "GET,POST,OPTIONS",
          }
        );

        res.end();

        return;
      }

      /* ---------------------------------------------------
         HEALTH CHECK
      --------------------------------------------------- */

      if (
        req.method ===
          "GET" &&
        req.url ===
          "/api/health"
      ) {
        const status =
          await getOllamaStatus();

        sendJson(
          res,
          200,
          {
            ok: true,

            configured:
              status.available &&
              status.modelAvailable,

            provider:
              status.available &&
              status.modelAvailable
                ? "LOCAL IBM GRANITE"
                : "LOCAL AI UNAVAILABLE",

            model:
              OLLAMA_MODEL,

            endpoint:
              OLLAMA_URL,

            ollamaAvailable:
              status.available,

            modelAvailable:
              status.modelAvailable,

            models:
              status.models ||
              [],

            port:
              PORT,
          }
        );

        return;
      }

      /* ---------------------------------------------------
         AI ANALYSIS
      --------------------------------------------------- */

      if (
        req.method ===
          "POST" &&
        req.url ===
          "/api/ai/analyze"
      ) {
        try {
          const body =
            await readRequestBody(
              req
            );

          const question =
            String(
              body.question ||
                ""
            ).trim();

          if (
            !question
          ) {
            sendJson(
              res,
              400,
              {
                ok: false,

                error:
                  "Question is required.",
              }
            );

            return;
          }

          const status =
            await getOllamaStatus();

          if (
            !status.available
          ) {
            sendJson(
              res,
              503,
              {
                ok: false,

                error:
                  "Ollama is not running.",

                provider:
                  "LOCAL AI UNAVAILABLE",
              }
            );

            return;
          }

          if (
            !status.modelAvailable
          ) {
            sendJson(
              res,
              503,
              {
                ok: false,

                error:
                  `Model ${OLLAMA_MODEL} is not installed in Ollama.`,

                provider:
                  "LOCAL AI UNAVAILABLE",
              }
            );

            return;
          }

          console.log(
            `[AI] Analyzing: ${question}`
          );

          const result =
            await analyzeWithGranite(
              question,
              body.dataContext ||
                {}
            );

          sendJson(
            res,
            200,
            {
              ok: true,

              result,

              provider:
                "LOCAL IBM GRANITE",

              model:
                OLLAMA_MODEL,
            }
          );

        } catch (
          error
        ) {
          console.error(
            "[GRANITE ERROR]",
            error
          );

          sendJson(
            res,
            500,
            {
              ok: false,

              error:
                error?.message ||
                "Granite analysis failed.",

              provider:
                "LOCAL IBM GRANITE",

              model:
                OLLAMA_MODEL,
            }
          );
        }

        return;
      }

      /* ---------------------------------------------------
         UNKNOWN ROUTE
      --------------------------------------------------- */

      sendJson(
        res,
        404,
        {
          ok: false,

          error:
            "Route not found.",
        }
      );
    }
  );

/* =========================================================
   SERVER ERROR HANDLER
========================================================= */

server.on(
  "error",
  (error) => {
    if (
      error.code ===
      "EADDRINUSE"
    ) {
      console.error(
        `Port ${PORT} is already in use.`
      );
    } else {
      console.error(
        "Server error:",
        error
      );
    }
  }
);

/* =========================================================
   START SERVER
========================================================= */

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "----------------------------------------"
    );

    console.log(
      "TariffGraph AI backend"
    );

    console.log(
      `Backend: http://localhost:${PORT}`
    );

    console.log(
      `Ollama: ${OLLAMA_URL}`
    );

    console.log(
      `Model: ${OLLAMA_MODEL}`
    );

    console.log(
      "AI provider: LOCAL IBM GRANITE"
    );

    console.log(
      "Thinking mode: OFF"
    );

    console.log(
      "Timeout: 10 minutes"
    );

    console.log(
      "----------------------------------------"
    );
  }
);