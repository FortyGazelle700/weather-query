// @ts-check - Enable JSDoc for type checking

// Bun HTTP Server        https://bun.sh/docs/api/http
// Terminal colors found  https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color

/**
 * @typedef {{
 *   date?: string;
 *   weather_code?: string;
 *   temperature_max?: string;
 *   temperature_min?: string;
 *   precipitation_sum?: string;
 *   wind_speed_max?: string;
 *   precipitation_probability_max?: string;
 * }[]} Dataset
 */

const DEFAULT_FILE = `
  date: 
  weather_code: 
  temperature_max: 
  temperature_min: 
  precipitation_sum: 
  wind_speed_max: 
  precipitation_probability_max: 
`
  .split("\n")
  .slice(1, -2)
  .join("\n")
  .replace(new RegExp("  ", "gm"), "");

const ROWS_TO_RECEIVE = {
  weather_code: "weather_code",
  temperature_max: "temperature_2m_max",
  temperature_min: "temperature_2m_min",
  precipitation_sum: "precipitation_sum",
  wind_speed_max: "wind_gusts_10m_max",
};

const PORT = 5000;

Bun.serve({
  port: PORT,
  async fetch(/** @type {Request} */ req) {
    const path = new URL(req.url).pathname;
    let debug = false;
    let res;
    if (path.startsWith("/api/")) {
      // Handle API
      debug = true;
      res = handleAPI(req, path);
    } else {
      // Handle Static Assets (index.html, index.css, index.js, /icons/...)
      res = handleStatic(req, path);
    }
    // If debug, show request + response
    debug &&
      console.log(
        "\x1b[32m -> \x1b[0m" +
          req.method +
          " " +
          path +
          " " +
          (await (await req).clone().text())
      );
    debug &&
      console.log(
        "\x1b[34m <- \x1b[0m" +
          req.method +
          " " +
          path +
          " " +
          (await (await res).clone().text())
      );
    return res;
  },
});

console.log(
  "\x1b[32m UP \x1b[0m" + "Started server on http://localhost:" + PORT
);

/**
 *
 * @param {Request} req
 * @param {string} path
 * @returns {Promise<Response>}
 */
async function handleStatic(req, path) {
  const filePath =
    import.meta.url.replace("file:///", "/").split("/").slice(0, -1).join("/") +
    `/frontend/${path == "/" ? "index.html" : path}`;
  const file = await Bun.file(filePath);
  if (await file.exists()) {
    return new Response(file, {
      headers: {
        "Content-Type": file.type,
      },
    });
  } else {
    return new Response("404 - Static Asset Not Found", {
      status: 404,
    });
  }
}

/**
 *
 * @param {Request} req
 * @param {string} path
 * @returns {Promise<Response>}
 */
async function handleAPI(req, path) {
  const filePath =
    import.meta.url.replace("file:///", "/").split("/").slice(0, -2).join("/") +
    "/dataset.txt";
  const file = Bun.file(filePath);
  const fileData = (await file.exists()) ? await file.text() : DEFAULT_FILE;
  let data = parseDataset(fileData);
  const args = path.split("/").slice(2);

  let result;

  if ((args[0] == undefined || args[0] == "") && req.method == "GET") {
    return new Response(
      JSON.stringify({
        name: "WeatherQuery",
        version: "1.0.0",
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  if (
    req.method == "GET" &&
    args[0] != "input" &&
    (args[1] == undefined || args[1] == "")
  ) {
    return new Response(JSON.stringify({ error: "No row provided" }), {
      status: 400,
      statusText: "Bad Request",
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  if (req.method == "GET") {
    switch (args[0]) {
      case "input":
        return new Response(JSON.stringify({ result: data }), {
          headers: {
            "Content-Type": "application/json",
          },
        });
      case "min":
        result = (() => {
          const startDate = args[2] ? parseDate(args[2], data) : undefined;
          const endDate = args[3] ? parseDate(args[3], data) : undefined;
          const startIdx = startDate
            ? data.findIndex((row) => row.date == startDate)
            : 0;
          const endIdx = endDate
            ? data.findIndex((row) => row.date == endDate) + 1
            : data.length;
          const range = data.slice(startIdx, endIdx);
          return min(range.map((row) => row[args[1]]));
        })();
        if (result == undefined) {
          return new Response(JSON.stringify({ error: "Row not found" }), {
            status: 400,
            statusText: "Bad Request",
            headers: {
              "Content-Type": "application/json",
            },
          });
        }
        return new Response(JSON.stringify({ result: result }), {
          headers: {
            "Content-Type": "application/json",
          },
        });
      case "max":
        result = (() => {
          const startDate = args[2] ? parseDate(args[2], data) : undefined;
          const endDate = args[3] ? parseDate(args[3], data) : undefined;
          const startIdx = startDate
            ? data.findIndex((row) => row.date == startDate)
            : 0;
          const endIdx = endDate
            ? data.findIndex((row) => row.date == endDate) + 1
            : data.length;
          const range = data.slice(startIdx, endIdx);
          return max(range.map((row) => row[args[1]]));
        })();
        if (result == undefined) {
          return new Response(JSON.stringify({ error: "Row not found" }), {
            status: 400,
            statusText: "Bad Request",
            headers: {
              "Content-Type": "application/json",
            },
          });
        }
        return new Response(JSON.stringify({ result: result }), {
          headers: {
            "Content-Type": "application/json",
          },
        });
      case "avg":
        result = (() => {
          const startDate = args[2] ? parseDate(args[2], data) : undefined;
          const endDate = args[3] ? parseDate(args[3], data) : undefined;
          const startIdx = startDate
            ? data.findIndex((row) => row.date == startDate)
            : 0;
          const endIdx = endDate
            ? data.findIndex((row) => row.date == endDate) + 1
            : data.length;
          const range = data.slice(startIdx, endIdx);
          return avg(range.map((row) => row[args[1]]));
        })();
        if (result == undefined) {
          return new Response(JSON.stringify({ error: "Row not found" }), {
            status: 400,
            statusText: "Bad Request",
            headers: {
              "Content-Type": "application/json",
            },
          });
        }
        return new Response(JSON.stringify({ result: result }), {
          headers: {
            "Content-Type": "application/json",
          },
        });
      case "value":
        result = (() => {
          const startDate = args[2] ? parseDate(args[2], data) : undefined;
          const startIdx = startDate
            ? data.findIndex((row) => row.date == startDate)
            : 0;
          return data.at(startIdx)?.[args[1]] ?? -1;
        })();
        if (result == undefined) {
          return new Response(JSON.stringify({ error: "Row not found" }), {
            status: 400,
            statusText: "Bad Request",
            headers: {
              "Content-Type": "application/json",
            },
          });
        }
        return new Response(JSON.stringify({ result: result }), {
          headers: {
            "Content-Type": "application/json",
          },
        });
      case "histogram":
        result = (() => {
          const startDate = args[2] ? parseDate(args[2], data) : undefined;
          const endDate = args[3] ? parseDate(args[3], data) : undefined;
          const startIdx = startDate
            ? data.findIndex((row) => row.date == startDate)
            : 0;
          const endIdx = endDate
            ? data.findIndex((row) => row.date == endDate) + 1
            : data.length;
          const range = data.slice(startIdx, endIdx);
          /** @type {Record<string,number>} */
          const result = {};
          range.forEach((row) => {
            result[row?.date ?? ""] = Number(row[args[1]]);
            return result;
          });
          return result;
        })();
        if (result == undefined) {
          return new Response(JSON.stringify({ error: "Row not found" }), {
            status: 400,
            statusText: "Bad Request",
            headers: {
              "Content-Type": "application/json",
            },
          });
        }
        return new Response(
          JSON.stringify({
            result: result,
          }),
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      case "external":
        result = await (async () => {
          const lat = args[1];
          const long = args[2];
          const startDate = args[5]
            ? parseDate(args[5], data)
            : parseDate("0", data);
          const endDate = args[6]
            ? parseDate(args[6], data)
            : args[3] == "value"
            ? startDate
            : parseDate("-1", data);
          const apiRow = ROWS_TO_RECEIVE[args[4]];
          const url = new URL(
            "/v1/archive",
            "https://archive-api.open-meteo.com/"
          );
          url.searchParams.set("latitude", String(lat));
          url.searchParams.set("longitude", String(long));
          url.searchParams.set(
            "start_date",
            startDate ?? data.at(0)?.date ?? ""
          );
          url.searchParams.set("end_date", endDate ?? data.at(-1)?.date ?? "");
          url.searchParams.set("daily", apiRow);
          url.searchParams.set("temperature_unit", "fahrenheit");
          url.searchParams.set("wind_speed_unit", "mph");
          url.searchParams.set("precipitation_unit", "inch");
          const fetched = await (await fetch(url)).json();
          const results = fetched?.daily?.[apiRow] ?? 0;
          console.log(url.toString(), results);
          if (fetched?.daily?.[apiRow] == null)
            console.warn("No Historical Data!");
          let result;
          switch (args[3]) {
            case "min":
              result = min(results);
            case "max":
              result = max(results);
            case "avg":
              result = avg(results);
            case "value":
              result = results[0];
          }
          return result;
        })();
        if (result == undefined) {
          return new Response(
            JSON.stringify({
              error:
                "Something went wrong with connecting to API. Is there something wrong with the connection?",
            }),
            {
              status: 400,
              statusText: "Bad Request",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );
        }
        return new Response(
          JSON.stringify({
            result: result,
          }),
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      default:
        console.error("not handled " + path.split("/").at(1));
        return new Response("404 - API Endpoint Not Found", {
          status: 404,
        });
    }
  } else if (req.method == "POST") {
    if (args[0] == "input") {
      let body;
      try {
        body = await req.text();
      } catch (err) {
        return new Response(
          JSON.stringify({
            error: "Unable to parse body",
          }),
          {
            status: 400,
            statusText: "Bad Request",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }
      try {
        data = parseDataset(body);
        if (data.length == 0) {
          throw new Error("No data");
        }
        Bun.write(filePath, toDataset(data));
        return new Response(JSON.stringify(data), {
          headers: {
            "Content-Type": "application/json",
          },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            error:
              "Something went wrong when saving the file, is the file correctly formatted?",
          }),
          {
            status: 400,
            statusText: "Bad Request",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }
    }
  } else if (req.method == "PUT") {
    if (args[0] == "input") {
      let body;
      try {
        body = await req.json();
      } catch (err) {
        return new Response(
          JSON.stringify({
            error: "Unable to parse body",
          }),
          {
            status: 400,
            statusText: "Bad Request",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }
      if (body?.length == undefined) {
        return new Response(
          JSON.stringify({
            error: "Body is meant to be an array",
          }),
          {
            status: 400,
            statusText: "Bad Request",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }
      for (let record = 0; record < body.length; record++) {
        for (const property in body[record]) {
          const dataRecord = data.findIndex(
            (rec) => rec.date == body[record].date
          );
          data[dataRecord][property] = body[record][property];
        }
      }
      Bun.write(filePath, toDataset(data));
      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  } else if (req.method == "DELETE") {
    if (args[0] == "input") {
      let body;
      try {
        body = await req.json();
      } catch (err) {
        return new Response(
          JSON.stringify({
            error: "Unable to parse body",
          }),
          {
            status: 400,
            statusText: "Bad Request",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }
      if (body?.length == undefined) {
        return new Response(
          JSON.stringify({
            error: "Body is meant to be an array",
          }),
          {
            status: 400,
            statusText: "Bad Request",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
      }
      data = data.filter((rec) => !body.includes(rec.date));
      Bun.write(filePath, toDataset(data));
      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  }
  return new Response("404 - API Endpoint Not Found", {
    status: 404,
  });
}

/**
 *
 * @param {number[]} data
 *
 * @returns {number | undefined}
 */
function min(data) {
  return data.reduce((a, b) => (Number(a) <= Number(b) ? a : b));
}

/**
 *
 * @param {number[]} data
 *
 * @returns {number | undefined}
 */
function max(data) {
  return data.reduce((a, b) => (Number(a) >= Number(b) ? a : b));
}

/**
 *
 * @param {number[]} data
 *
 * @returns {number | undefined}
 */
function avg(data) {
  return data.reduce((a, b) => Number(a) + Number(b)) / data.length;
}

/**
 *
 * @param {string} fileData
 * @returns {Dataset}
 */
function parseDataset(fileData) {
  const values = fileData.split("\n").map((row) => row.split(": ")[0]);
  const table = /** @type {string[][]} */ fileData
    .split("\n")
    .map((row) => row?.split(": ")?.[1]?.split(" ") ?? []);
  /** @type {Dataset} */
  const response = [];
  for (let row = 0; row < table.length; row++) {
    for (let col = 0; col < table[row].length; col++) {
      response[col] ??= {};
      response[col][values[row]] = table[row][col];
    }
  }
  return response;
}

/**
 *
 * @param {Dataset} json
 * @returns
 */
function toDataset(json) {
  let body = {};
  for (let record = 0; record < json.length; record++) {
    for (const property in json[record]) {
      if (body[property] == undefined) body[property] = "";
      body[property] += ` ${json[record][property]}`;
    }
  }
  return Object.entries(body)
    .reduce((prev, [key, value]) => `${prev}\n${key}:${value}`, "")
    .replace("\n", "");
}

/**
 *
 * @param {string} date
 * @param {Dataset} data
 * @returns
 */
function parseDate(date, data) {
  if (date.length == 10) {
    return date;
  }
  if (
    date.length == 1 ||
    date.length == 2 ||
    (date.length == 3 && date.startsWith("-"))
  ) {
    return data.at(Number(date))?.date;
  }
  throw new Error("Cannot parse date " + date);
}
