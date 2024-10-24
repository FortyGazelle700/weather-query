let rowValues = /** @type {string[]} */ ([]);
let dateValues = /** @type {string[]} */ ([]);
const loadDataset = async () => {
  const input = await (
    await fetch("/api/input", {
      credentials: "include",
      mode: "no-cors",
    })
  ).json();
  rowValues = Object.keys(input.result[0]).filter((row) => row != "date");
  dateValues = input.result.map((pt) => pt.date);
};
loadDataset();
const queries = [
  {
    name: "help",
    description:
      "Explains how to use this application, and displays documentation for queries and their respective parameter types",
    canSubQuery: false,
    params: [],
  },
  {
    name: "input",
    description: "Upload a file to run queries",
    canSubQuery: false,
    params: [],
  },
  {
    name: "clear",
    description: "Clears the chat history",
    canSubQuery: false,
    params: [],
  },
  {
    name: "min",
    description: "Query the minimum value over the dataset between two dates",
    canSubQuery: true,
    params: [
      {
        name: "row",
        type: "row",
        optional: false,
      },
      {
        name: "start",
        type: "date",
        optional: true,
      },
      {
        name: "end",
        type: "date",
        optional: true,
      },
    ],
  },
  {
    name: "max",
    description: "Query the maximum value over the dataset between two dates",
    canSubQuery: true,
    params: [
      {
        name: "row",
        type: "row",
        optional: false,
      },
      {
        name: "start",
        type: "date",
        optional: true,
      },
      {
        name: "end",
        type: "date",
        optional: true,
      },
    ],
  },
  {
    name: "avg",
    description: "Query the avg value over the dataset between two dates",
    canSubQuery: true,
    params: [
      {
        name: "row",
        type: "row",
        optional: false,
      },
      {
        name: "start",
        type: "date",
        optional: true,
      },
      {
        name: "end",
        type: "date",
        optional: true,
      },
    ],
  },
  {
    name: "value",
    description: "Query the value of a specific date",
    canSubQuery: true,
    params: [
      {
        name: "row",
        type: "row",
        optional: false,
      },
      {
        name: "day",
        type: "date",
        optional: false,
      },
    ],
  },
  {
    name: "table",
    description: "Query the all values of the input and return in a table",
    canSubQuery: false,
    params: [],
  },
  {
    name: "compare",
    description:
      "Query the data and compare it with online data at location (using latitude and longitude)",
    canSubQuery: false,
    params: [
      {
        name: "location type",
        type: "enum",
        value: "coord",
        optional: false,
      },
      {
        name: "latitude",
        type: "number",
        optional: false,
      },
      {
        name: "longitude",
        type: "number",
        optional: false,
      },
      {
        name: "subquery",
        type: "subquery",
        optional: false,
      },
    ],
  },
  {
    name: "compare",
    description:
      "Query the data and compare it with online data at location (using latitude and longitude)",
    canSubQuery: false,
    params: [
      {
        name: "location type",
        type: "enum",
        value: "dataset",
        optional: false,
      },
      {
        name: "1st query",
        type: "subquery",
        optional: false,
      },
      {
        name: "2nd query",
        type: "subquery",
        optional: false,
      },
    ],
  },
  {
    name: "compare",
    description:
      "Query the data and compare it with online data at location (using zip code)",
    canSubQuery: false,
    params: [
      {
        name: "location type",
        type: "enum",
        value: "zip",
        optional: false,
      },
      {
        name: "zip code",
        type: "int",
        optional: false,
      },
      {
        name: "subquery",
        type: "subquery",
        optional: false,
      },
    ],
  },
  {
    name: "compare",
    description:
      "Query the data and compare it with online data at location (using city name)",
    canSubQuery: false,
    params: [
      {
        name: "location type",
        type: "enum",
        value: "city",
        optional: false,
      },
      {
        name: "city name",
        type: "string",
        optional: false,
      },
      {
        name: "subquery",
        type: "subquery",
        optional: false,
      },
    ],
  },
  {
    name: "histogram",
    description:
      "Generate a histogram of a given data point between two points",
    canSubQuery: false,
    params: [
      {
        name: "row",
        type: "row",
        optional: false,
      },
      {
        name: "start",
        type: "date",
        optional: true,
      },
      {
        name: "end",
        type: "date",
        optional: true,
      },
    ],
  },
];
const responseUnits = {
  date: "",
  weather_code: "",
  temperature_max: "°",
  temperature_min: "°",
  precipitation_sum: "in",
  wind_speed_max: "mph",
  precipitation_probability_max: "%",
};
const weatherCodes = {
  0: {
    name: "Clear Sky",
    icon: "./icons/sun.svg",
  },
  1: {
    name: "Mainly Clear",
    icon: "./icons/cloud-sun.svg",
  },
  2: {
    name: "Partly Cloudy",
    icon: "./icons/cloud-sun.svg",
  },
  3: {
    name: "Overcast",
    icon: "./icons/cloud.svg",
  },
  45: {
    name: "Fog",
    icon: "./icons/fog.svg",
  },
  48: {
    name: "Fog (depositing rime)",
    icon: "./icons/fog.svg",
  },
  51: {
    name: "Drizzle (Light)",
    icon: "./icons/cloud-drizzle.svg",
  },
  53: {
    name: "Drizzle (Moderate)",
    icon: "./icons/cloud-drizzle.svg",
  },
  55: {
    name: "Drizzle (Heavy)",
    icon: "./icons/cloud-drizzle.svg",
  },
  56: {
    name: "Freezing Drizzle (Light)",
    icon: "./icons/cloud-drizzle.svg",
  },
  57: {
    name: "Freezing Drizzle (Heavy)",
    icon: "./icons/cloud-drizzle.svg",
  },
  61: {
    name: "Rain (Light)",
    icon: "./icons/cloud-rain.svg",
  },
  63: {
    name: "Rain (Moderate)",
    icon: "./icons/cloud-rain.svg",
  },
  65: {
    name: "Rain (Heavy)",
    icon: "./icons/cloud-rain.svg",
  },
  71: {
    name: "Snow (Light)",
    icon: "./icons/cloud-snow.svg",
  },
  73: {
    name: "Snow (Moderate)",
    icon: "./icons/cloud-snow.svg",
  },
  75: {
    name: "Snow (Heavy)",
    icon: "./icons/cloud-snow.svg",
  },
  77: {
    name: "Snow (grains)",
    icon: "./icons/cloud-snow.svg",
  },
  80: {
    name: "Rain Shower (Light)",
    icon: "./icons/cloud-rain.svg",
  },
  81: {
    name: "Rain Shower (Moderate)",
    icon: "./icons/cloud-rain.svg",
  },
  82: {
    name: "Rain Shower (Heavy)",
    icon: "./icons/cloud-rain.svg",
  },
  85: {
    name: "Snow Shower (Light)",
    icon: "./icons/cloud-snow.svg",
  },
  86: {
    name: "Snow Shower (Heavy)",
    icon: "./icons/cloud-snow.svg",
  },
  95: {
    name: "Thunderstorm",
    icon: "./icons/zap.svg",
  },
  96: {
    name: "Thunderstorm with Hail (Slight)",
    icon: "./icons/zap.svg",
  },
  99: {
    name: "Thunderstorm with Hail (Heavy)",
    icon: "./icons/zap.svg",
  },
};

export {
  rowValues,
  dateValues,
  queries,
  responseUnits,
  weatherCodes,
  loadDataset as reloadDataset,
};
