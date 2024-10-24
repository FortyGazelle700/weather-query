// @ts-check - Enable JSDoc for type checking

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

/**
 * @typedef {{
 *   input: string;
 *   output: string;
 * }[]} Responses
 */

const CLIENT_GEOCODE_API_KEY =
  "prj_live_pk_98536d2d7cc9db2421e395a38cd2cfcd6dd4b378"; // API Key for https://radar.com/documentation/api#geocoding to geocode zip codes

const GENERAL_HINT_TEXT =
  "Start typing to reduce completions, use arrows to select, use tab or click to insert";

// Import query constants (queryable queries, parameters, and formatting)
import {
  rowValues, // rows in dataset (temp_min, temp_max, wind_speed_max, ...)
  dateValues, // possible dates in dataset (2024-04-24, 2024-04-25, ...) (also could be used for length to get day 0, day 1, ...)
  queries, // accessible queries via the GUI (min, max, value, histogram, ...)
  responseUnits, // units for each row value (°F, mph, ...)
  weatherCodes, // weather codes and values (name, icon)
  reloadDataset, // utility to reload fetch and repopulate rowValue and dateValues when input gets updated
} from "./query-constants.js";

// HTML Selectors Elements
const form = // The form at the bottom with the input, used to test onsubmit
  /** @type {HTMLFormElement} */
  (document.querySelector("#new-response"));
const input = // The input inside of the form, used to gather the input value
  /** @type {HTMLInputElement} */
  (document.querySelector("#input"));
const responses = // The responses, used to add the input and new responses
  /** @type {HTMLDivElement} */
  (document.querySelector("#responses"));
const autocomplete = // The div that allows you to preview queryable queries
  /** @type {HTMLDivElement} */
  (document.querySelector("#autocomplete"));
const helpButton =
  /** @type {HTMLButtonElement} */
  (document.querySelector("#help"));
const notification = // The div that allows you to preview queryable queries
  /** @type {HTMLDivElement} */
  (document.querySelector("#notification"));

// Pretty fix, to make scroll to top then clear, ensures that no new requests are made during this period
let isClearBlocking = false;

let savedResponses = /** @type {Responses} */ (
  JSON.parse(localStorage.getItem("saved-responses") ?? "[]")
);

if (savedResponses.length == 0) {
  addEmptyOutput();
}

let selectedAutoCompleteIdx = 0; // The default index for tabbed autocomplete

window.addEventListener("load", async () => {
  for (let response of savedResponses) {
    displayRequest(response.input);
    await sendRequest(response.input, true, response.output);
  }

  scrollToBottom();
});

document.addEventListener("keydown", () => {
  if (document.activeElement != input) {
    input.focus();
  }
});

helpButton.addEventListener("click", async (evt) => {
  evt.preventDefault();
  const oldValue = input.value;
  input.value = "help";
  await submitForm();
  setTimeout(() => {
    input.value = oldValue;
  }, 1);
});

// Simple helper to scroll to bottom, to see last request and response
const scrollToBottom = () => {
  const bottom = /** @type {HTMLDivElement | undefined} */ (
    Array.from(responses.querySelectorAll(".response")).at(-2)
  );
  window.scrollTo({
    top: (bottom?.offsetTop ?? 16) - 16,
    left: 0,
    behavior: "smooth",
  });
};

// listen for inputs to render autocomplete correctly (appear, disappear, update, mousedown and up to ensure cursor at end)
["keydown", "focus", "blur", "mousedown", "mouseup"].forEach(
  (
    evtName // loop through each update event
  ) =>
    input.addEventListener(evtName, (inpEvt) =>
      setTimeout(() => {
        handleAutoComplete(
          input.value,
          autocomplete,
          evtName,
          /** @type {KeyboardEvent | KeyboardEvent} */ (inpEvt),
          false
        );
      }, 1)
    )
);

// Listen for form submission (clicking on button, or [Enter] key press)
form.addEventListener("submit", async (evt) => {
  evt.preventDefault();
  await submitForm();
});

async function submitForm() {
  // As we wait to scroll to top then clear, make sure that we render any new items after clear occurs
  await (async () => {
    return new Promise((resolve) => {
      function check() {
        if (isClearBlocking) return;
        resolve(null);
      }
      check();
      const checkInterval = setInterval(check, 100);
    });
  })();

  const queryValue = input.value ?? "";

  if (queryValue.trim() == "") return;

  if (savedResponses.length == 0) responses.innerHTML = "";

  displayRequest(queryValue);

  // Validate the input
  if (!validateInput(input.value, false)) {
    scrollToBottom();
    setTimeout(() => {
      // Save the input and clear it to allow to have another query inputted
      input.value = "";
      input.blur();
    }, 1);
    return;
  }

  // Display a loading response
  const response = document.createElement("div");
  response.className = "response";
  const loaderIcon = document.createElement("img");
  loaderIcon.src = "./icons/loader.svg";
  loaderIcon.className = "icon spin";
  response.appendChild(loaderIcon);
  const text = document.createElement("span");
  text.textContent = "Sending Request";
  response.appendChild(text);
  responses.appendChild(response);

  setTimeout(() => {
    // Save the input and clear it to allow to have another query inputted
    input.value = "";
    input.blur();
  }, 1);

  const responseVal = await sendRequest(queryValue, true);

  if (queryValue.startsWith("clear")) {
    savedResponses = [];
  } else {
    savedResponses.push({
      input: queryValue,
      output: responseVal,
    });
  }

  localStorage.setItem("saved-responses", JSON.stringify(savedResponses));

  response.remove();

  scrollToBottom();
}

/**
 * Autocomplete as a function to allow recursion for sub-queries
 *
 * @param {string} inpValue
 * @param {HTMLDivElement} autocomplete
 * @param {string} evtName
 * @param {KeyboardEvent | KeyboardEvent} inpEvt
 * @param {boolean} isSubQuery
 */
function handleAutoComplete(
  inpValue,
  autocomplete,
  evtName,
  inpEvt,
  isSubQuery
) {
  // If input is active / visible
  if (evtName == "blur" && autocomplete.contains(document.activeElement)) {
    return;
  }
  if (document.activeElement == input || evtName == "keydown") {
    if (evtName == "keydown") {
      if (inpEvt.key == "Escape") {
        /** @type {HTMLInputElement} */ (document.activeElement)?.blur();
        return;
      }
    }
    // Ensure that the cursor is fixed at the end, while ensuring that you can select somewhere to end.
    setTimeout(function () {
      if (
        !inpEvt.shiftKey &&
        !inpEvt.ctrlKey &&
        !inpEvt.metaKey &&
        !inpEvt.ctrlKey
      ) {
        input.selectionStart = 10000;
      }
      input.selectionEnd = 10000;
    }, 0); // https://stackoverflow.com/questions/511088/use-javascript-to-place-cursor-at-end-of-text-in-text-input-element

    // Rerender the autocomplete, and ensure that you can see the autocomplete
    autocomplete.classList.add("visible");

    // Reset html to completely re-render
    autocomplete.innerHTML = "";

    // Get all of the arguments that are passed in
    const args = getArgs(inpValue);

    if (inpValue == "" || (args.length == 1 && !inpValue.endsWith(" "))) {
      // Searching all queries
      // Queries that have a similar name
      const closeQueryNames = queries
        .filter((query) => query.canSubQuery || !isSubQuery)
        .filter((query) => query.name.startsWith(args[0] || ""));

      if (evtName == "keydown") {
        const evt = /** @type {KeyboardEvent} */ (inpEvt);
        switch (evt.key) {
          default:
            // When typing, ensure that the top result is always selected
            selectedAutoCompleteIdx = 0;
            break;
          case "ArrowDown":
            // Move autocomplete tab down, or loop around
            selectedAutoCompleteIdx++;
            if (selectedAutoCompleteIdx >= closeQueryNames.length)
              selectedAutoCompleteIdx = 0;
            break;
          case "ArrowUp":
            // Move autocomplete tab up, or loop around
            selectedAutoCompleteIdx--;
            if (selectedAutoCompleteIdx < 0)
              selectedAutoCompleteIdx = closeQueryNames.length - 1;
            break;
          case "Tab":
            // Finish autocomplete
            // Re-focus as it will select the send button
            input.focus();
            // Sets the content to only the primary query;
            // !isSubQuery: ""
            // isSubQuery: "compare 0 0"
            input.value = input.value.replace(new RegExp(inpValue + "$"), "");
            // Set the result to the name of the query name
            input.value +=
              closeQueryNames[selectedAutoCompleteIdx].name +
              (closeQueryNames[selectedAutoCompleteIdx].params[0]?.type ==
              "enum"
                ? " " +
                  closeQueryNames[selectedAutoCompleteIdx].params[0]?.value
                : "") +
              " ";
            break;
        }
      } else {
        // When refocusing, reset the index back to 0.
        selectedAutoCompleteIdx = 0;
      }

      let autocompleteRowHeader = document.createElement("div");
      autocompleteRowHeader.className = "row";
      autocompleteRowHeader.textContent = "Queries: ";
      autocomplete.appendChild(autocompleteRowHeader);

      if (!isSubQuery) {
        let autocompleteRowHint = document.createElement("div");
        autocompleteRowHint.className = "arg hint verbose";
        autocompleteRowHint.textContent = GENERAL_HINT_TEXT;
        autocompleteRowHeader.appendChild(autocompleteRowHint);
      }

      // No completions were found
      if (closeQueryNames.length == 0) {
        // Create a row to state no completions found
        let autocompleteRow = document.createElement("div");
        autocompleteRow.className = "row";
        autocomplete.appendChild(autocompleteRow);

        // Add the name (bold the part that is typed)
        const errorMessage = document.createElement("div");
        errorMessage.className = "arg description";
        errorMessage.textContent = "No completions could be found";
        autocompleteRow.appendChild(errorMessage);
        return;
      }
      // At least 1 completion was found

      // Add each name to the autocomplete list
      closeQueryNames.forEach((query, idx) => {
        // Create a record
        let autocompleteRow = document.createElement("button");
        autocompleteRow.className = "row";
        autocomplete.appendChild(autocompleteRow);

        autocompleteRow.addEventListener("click", () => {
          // Finish autocomplete
          // Re-focus as it will select the send button
          input.focus();
          // Sets the content to only the primary query;
          // !isSubQuery: ""
          // isSubQuery: "compare 0 0"
          input.value = input.value.replace(new RegExp(inpValue + "$"), "");
          // Set the result to the name of the query name
          input.value +=
            query.name +
            (query.params[0]?.type == "enum"
              ? " " + query.params[0]?.value
              : "") +
            " ";
        });

        // Add the name (bold the part that is typed)
        const name = document.createElement("div");
        autocompleteRow.appendChild(name);
        const typedName = document.createElement("b");
        typedName.textContent = query.name.substring(0, args[0]?.length ?? 0);
        name.appendChild(typedName);
        const autoCompletedName = document.createElement("span");
        autoCompletedName.textContent =
          query.name.substring(args[0]?.length ?? 0) +
          (query.params[0]?.type == "enum"
            ? " (" + query.params[0].value + ")"
            : "");
        name.appendChild(autoCompletedName);

        const hasSubQuery = query.params.at(-1)?.type == "subquery";

        // Add the amt of args
        const numArgs = document.createElement("span");
        numArgs.className = "arg description count";
        const minArgs = query.params.filter((param) => !param.optional).length;
        const maxArgs = query.params.length;
        numArgs.textContent = ` — ${
          minArgs - (hasSubQuery ? 1 : 0) == maxArgs - (hasSubQuery ? 1 : 0)
            ? maxArgs - (hasSubQuery ? 1 : 0)
            : `${minArgs - (hasSubQuery ? 1 : 0)}-${
                maxArgs - (hasSubQuery ? 1 : 0)
              }`
        } arguments${hasSubQuery ? " + subquery" : ""}`;
        autocompleteRow.appendChild(numArgs);

        // Add the description
        const description = document.createElement("span");
        description.className = "arg description";
        description.textContent = ` — ${query.description}`;
        autocompleteRow.appendChild(description);

        // Add the tab hint if selected
        if (idx == selectedAutoCompleteIdx) {
          const tabHint = document.createElement("span");
          tabHint.className = "arg hint";
          tabHint.textContent = "Tab";
          autocompleteRow.appendChild(tabHint);
        }
      });
    } else {
      // We have a query (valid or not), but ready to pass arguments

      // Get the current query
      let enumedQuery = queries
        .filter((query) => query.canSubQuery || !isSubQuery)
        .filter((query) => query.name == args[0]);

      // Couldn't find the query
      if (enumedQuery.length == 0) {
        // Create a row to state no completions found
        let autocompleteRow = document.createElement("div");
        autocompleteRow.className = "row";
        autocomplete.appendChild(autocompleteRow);

        // Add the name (bold the part that is typed)
        const errorMessage = document.createElement("div");
        errorMessage.className = "arg description";
        errorMessage.textContent = "No completions could be found";
        autocompleteRow.appendChild(errorMessage);
        return;
      }

      // Query exists
      let query = enumedQuery[0];

      // Create a record
      let autocompleteRowHeader = document.createElement("div");
      autocompleteRowHeader.className = "row";
      autocompleteRowHeader.textContent = `Query ${query?.name} documentation: `;
      autocomplete.appendChild(autocompleteRowHeader);

      if (!isSubQuery) {
        let autocompleteRowHint = document.createElement("div");
        autocompleteRowHint.className = "arg hint verbose";
        autocompleteRowHint.textContent = GENERAL_HINT_TEXT;
        autocompleteRowHeader.appendChild(autocompleteRowHint);
      }

      let autocompleteRow = document.createElement("div");
      autocompleteRow.className = "row";
      autocomplete.appendChild(autocompleteRow);

      // Add the name
      const name = document.createElement("div");
      name.textContent = args[0];
      autocompleteRow.appendChild(name);

      // enumed function
      if (enumedQuery.length > 1) {
        if (
          (args.length == 1 && inpValue.endsWith(" ")) ||
          (args.length == 2 && !inpValue.endsWith(" "))
        ) {
          const param = document.createElement("b");
          param.className = "arg red";
          param.textContent = `[${query.params[0].name}]`;
          autocompleteRow.appendChild(param);

          const restParam = document.createElement("div");
          restParam.className = "arg description";
          restParam.textContent = `(...rest)`;
          autocompleteRow.appendChild(restParam);

          let autocompleteRowValueHeader = document.createElement("div");
          autocompleteRowValueHeader.className = "row";
          autocompleteRowValueHeader.textContent = `Possible values for ${query.params[0].name}: `;
          autocomplete.appendChild(autocompleteRowValueHeader);

          let filteredenumedQueries = enumedQuery.filter((query) =>
            query.params[0].value?.startsWith(args[1] ?? "")
          );

          // Handle keyboard shortcuts to autocomplete
          if (evtName == "keydown") {
            const evt = /** @type {KeyboardEvent} */ (inpEvt);
            switch (evt.key) {
              default:
                // Reset to top
                selectedAutoCompleteIdx = 0;
                break;
              case "ArrowDown":
                // Move down, or loop around
                selectedAutoCompleteIdx++;
                if (selectedAutoCompleteIdx >= filteredenumedQueries.length)
                  selectedAutoCompleteIdx = 0;
                break;
              case "ArrowUp":
                // Move up, or loop around
                selectedAutoCompleteIdx--;
                if (selectedAutoCompleteIdx < 0)
                  selectedAutoCompleteIdx = filteredenumedQueries.length - 1;
                break;
              case "Tab":
                // Autocomplete!
                input.focus();
                input.value =
                  input.value.replace(new RegExp(inpValue + "$"), "") +
                  [
                    ...args.slice(
                      0,
                      args.length - (inpValue.endsWith(" ") ? 0 : 1)
                    ),
                    filteredenumedQueries[selectedAutoCompleteIdx].params[0]
                      .value,
                  ].join(" ") +
                  " ";
                break;
            }
          } else {
            // Reset when re-focusing
            selectedAutoCompleteIdx = 0;
          }

          filteredenumedQueries.forEach((query, idx) => {
            const val = query.params[0].value ?? "";

            const argValue = document.createElement("button");
            argValue.className = "row arg description";
            autocompleteRow.appendChild(argValue);

            argValue.addEventListener("click", () => {
              // Autocomplete!
              input.focus();
              input.value =
                input.value.replace(new RegExp(inpValue + "$"), "") +
                [
                  ...args.slice(
                    0,
                    args.length - (inpValue.endsWith(" ") ? 0 : 1)
                  ),
                  val,
                ].join(" ") +
                " ";
            });

            const typedName = document.createElement("b");
            typedName.textContent = val.substring(
              0,
              (inpValue.endsWith(" ") ? "" : args.at(-1))?.length ?? 0
            );
            argValue.appendChild(typedName);
            const autoCompletedName = document.createElement("span");
            autoCompletedName.textContent = val.substring(
              (inpValue.endsWith(" ") ? "" : args.at(-1))?.length ?? 0
            );
            argValue.appendChild(autoCompletedName);
            if (idx == selectedAutoCompleteIdx) {
              // Add the tab hint
              const tabHint = document.createElement("span");
              tabHint.className = "arg hint";
              tabHint.textContent = "Tab";
              argValue.appendChild(tabHint);
            }
            autocomplete.appendChild(argValue);
          });
          return;
        } else {
          // Current query parameter
          const inQuotes =
            (inpValue.match(new RegExp('"', "g")) ?? []).length % 2 == 1;
          let currentIdx =
            args.length - (inpValue.endsWith(" ") && !inQuotes ? 1 : 2);
          let currentArg = query.params[currentIdx];

          let actualQuery = enumedQuery.find(
            (query) => query.params[0].value == args[1]
          );
          if (!actualQuery) {
            const autocompleteArgLabel = document.createElement("div");
            autocompleteArgLabel.className = "row";
            autocompleteArgLabel.textContent = `Type ${currentArg?.name} doesn't have an enum for ${args[1]}`;
            autocomplete.appendChild(autocompleteArgLabel);
            return;
          }
          query = actualQuery;
        }
      }

      // Current query parameter
      const inQuotes =
        (inpValue.match(new RegExp('"', "g")) ?? []).length % 2 == 1;
      let currentIdx =
        args.length - (inpValue.endsWith(" ") && !inQuotes ? 1 : 2);
      let currentArg = query.params[currentIdx];

      const hasTwoQueries =
        query.params.filter((param) => param.type == "subquery").length == 2;
      const isSecondQuery =
        args.filter((arg) => queries.find((query) => query.name == arg))
          .length >= 3;

      if (
        hasTwoQueries &&
        currentIdx >=
          query.params.findIndex((param) => param.type == "subquery")
      ) {
        currentIdx = query.params.length - (isSecondQuery ? 1 : 2);
      }

      currentArg = query.params[currentIdx];

      // Loop through each parameter
      query.params.forEach((arg, idx) => {
        // Bold the active one
        const param = document.createElement(
          (idx <= currentIdx && arg.type == "subquery" && !isSecondQuery) ||
            idx == currentIdx
            ? "b"
            : "div"
        );

        // Pick color for parameter type
        param.className = "arg";
        switch (arg.type) {
          default:
            break;
          case "enum":
            param.className += " red";
            break;
          case "row":
            param.className += " orange";
            break;
          case "string":
            param.className += " pink";
            break;
          case "date":
            param.className += " green";
            break;
          case "int":
          case "number":
            param.className += " blue";
            break;
          case "subquery":
            param.className += " purple";
            break;
        }
        // Append the parameter name with the formatting [] for [required] and () for (optional)
        param.textContent = "";
        param.textContent += arg.optional ? "(" : "[";
        param.textContent += arg.name;
        param.textContent += arg.optional ? ")" : "]";
        autocompleteRow.appendChild(param);
      });

      if (currentArg && currentArg.type != "subquery") {
        let autocompleteRowValueHeader = document.createElement("div");
        autocompleteRowValueHeader.className = "row";
        autocompleteRowValueHeader.textContent = `Possible values for ${
          currentArg.name
        }${currentArg.optional ? " (optional)" : ""}: `;
        autocomplete.appendChild(autocompleteRowValueHeader);
      }

      // Autocomplete results list, used for keyboard shortcuts
      const possibleParameterValues = [];

      let autocompleteArgLabel;

      autocompleteArgLabel = document.createElement("div");
      autocompleteArgLabel.className = "row";

      autocompleteArgLabel.addEventListener("click", () => {
        // Autocomplete!
        input.focus();
        input.value =
          input.value.replace(new RegExp(inpValue + "$"), "") +
          [
            ...args.slice(0, args.length - (inpValue.endsWith(" ") ? 0 : 1)),
            possibleParameterValues[selectedAutoCompleteIdx],
          ].join(" ") +
          " ";
      });

      // Show results
      switch (currentArg?.type) {
        case "row":
          // Add all rows that can be tabbed
          rowValues
            .filter((val) => ("`" + val).startsWith(args[currentIdx + 1] ?? ""))
            .forEach((val, idx) => {
              val = "`" + val + "`";
              const argValue = document.createElement("button");
              argValue.className = "row arg description";
              argValue.addEventListener("click", () => {
                // Autocomplete!
                input.focus();
                input.value =
                  input.value.replace(new RegExp(inpValue + "$"), "") +
                  [
                    ...args.slice(
                      0,
                      args.length - (inpValue.endsWith(" ") ? 0 : 1)
                    ),
                    possibleParameterValues[idx],
                  ].join(" ") +
                  " ";
              });
              autocompleteRow.appendChild(argValue);
              const typedName = document.createElement("b");
              typedName.textContent = val.substring(
                0,
                (inpValue.endsWith(" ") ? "" : args.at(-1))?.length ?? 0
              );
              argValue.appendChild(typedName);
              const autoCompletedName = document.createElement("span");
              autoCompletedName.textContent = val.substring(
                (inpValue.endsWith(" ") ? "" : args.at(-1))?.length ?? 0
              );
              argValue.appendChild(autoCompletedName);
              autocomplete.appendChild(argValue);
              possibleParameterValues.push(val);
            });
          break;
        case "date":
          // Add all dates that can be tabbed from the dataset
          dateValues
            .filter((val) => val.startsWith(args[currentIdx + 1] ?? ""))
            .forEach((val, idx) => {
              const argValue = document.createElement("button");
              argValue.className = "row arg description";
              argValue.addEventListener("click", () => {
                // Autocomplete!
                input.focus();
                input.value =
                  input.value.replace(new RegExp(inpValue + "$"), "") +
                  [
                    ...args.slice(
                      0,
                      args.length - (inpValue.endsWith(" ") ? 0 : 1)
                    ),
                    possibleParameterValues[idx],
                  ].join(" ") +
                  " ";
              });
              autocompleteRow.appendChild(argValue);
              const typedName = document.createElement("b");
              typedName.textContent = val.substring(
                0,
                (inpValue.endsWith(" ") ? "" : args.at(-1))?.length ?? 0
              );
              2;
              argValue.appendChild(typedName);
              const autoCompletedName = document.createElement("span");
              autoCompletedName.textContent = val.substring(
                (inpValue.endsWith(" ") ? "" : args.at(-1))?.length ?? 0
              );
              argValue.appendChild(autoCompletedName);
              autocomplete.appendChild(argValue);
              possibleParameterValues.push(val);
            });
          break;
        default: // If not handled
          autocompleteArgLabel.textContent = `Type ${currentArg?.type} doesn't have any autocompletable values`;
          autocomplete.appendChild(autocompleteArgLabel);
          break;
        case "string": // No autocomplete values
          autocompleteArgLabel.textContent =
            'string (formatted as "" or "my string")';
          autocomplete.appendChild(autocompleteArgLabel);
          return;
        case "int": // No autocomplete values
          autocompleteArgLabel.textContent = "number (formatted as 66213)";
          autocomplete.appendChild(autocompleteArgLabel);
          return;
        case "number": // No autocomplete values
          autocompleteArgLabel.textContent = "number (formatted as 13 or 23.1)";
          autocomplete.appendChild(autocompleteArgLabel);
          return;
        case undefined:
        case "subquery": // Custom implementation below
          break;
      }

      // If we have a subquery, reuse the same function
      if (
        currentArg?.type == "subquery" ||
        (currentArg == undefined && query.params.at(-1)?.type == "subquery")
      ) {
        // Create another autocomplete as subquery, and re-run the function to populate results.
        const subQueryAutocomplete = document.createElement("div");
        subQueryAutocomplete.className = "autocomplete subquery";
        autocomplete.appendChild(subQueryAutocomplete);
        const subQueryInput =
          getArgs(inpValue)
            .slice(
              hasTwoQueries ? query.params.length - 1 : query.params.length
            )
            .slice(
              hasTwoQueries && isSecondQuery
                ? args.findLastIndex((arg) =>
                    queries.find((query) => query.name == arg)
                  ) - 2
                : 0
            )
            .join(" ") +
          (getArgs(inpValue)
            .slice(
              hasTwoQueries ? query.params.length - 1 : query.params.length
            )
            .slice(
              hasTwoQueries && isSecondQuery
                ? args.findLastIndex((arg) =>
                    queries.find((query) => query.name == arg)
                  ) - 2
                : 0
            ).length > 0 && inpValue.endsWith(" ")
            ? " "
            : "");
        handleAutoComplete(
          subQueryInput,
          subQueryAutocomplete,
          evtName,
          inpEvt,
          true
        );
        return;
      }

      // Handle keyboard shortcuts to autocomplete
      if (evtName == "keydown") {
        const evt = /** @type {KeyboardEvent} */ (inpEvt);
        switch (evt.key) {
          default:
            // Reset to top
            selectedAutoCompleteIdx = 0;
            break;
          case "ArrowDown":
            // Move down, or loop around
            selectedAutoCompleteIdx++;
            if (selectedAutoCompleteIdx >= possibleParameterValues.length)
              selectedAutoCompleteIdx = 0;
            break;
          case "ArrowUp":
            // Move up, or loop around
            selectedAutoCompleteIdx--;
            if (selectedAutoCompleteIdx < 0)
              selectedAutoCompleteIdx = possibleParameterValues.length - 1;
            break;
          case "Tab":
            // Autocomplete!
            input.focus();
            input.value =
              input.value.replace(new RegExp(inpValue + "$"), "") +
              [
                ...args.slice(
                  0,
                  args.length - (inpValue.endsWith(" ") ? 0 : 1)
                ),
                possibleParameterValues[selectedAutoCompleteIdx],
              ].join(" ") +
              " ";
            break;
        }
      } else {
        // Reset when re-focusing
        selectedAutoCompleteIdx = 0;
      }

      // Add the tab hint to active element.
      autocomplete
        .querySelectorAll(".arg.description")
        .forEach((argValue, idx) => {
          if (idx == selectedAutoCompleteIdx) {
            // Add the tab hint
            const tabHint = document.createElement("span");
            tabHint.className = "arg hint";
            tabHint.textContent = "Tab";
            argValue.appendChild(tabHint);
          }
        });
    }
  } else {
    // Hides the autocomplete
    autocomplete.classList.remove("visible");
  }
}

/**
 *
 * @param {string} inpValue
 * @returns {string[]}
 */
function getArgs(inpValue) {
  let resultValue = [];
  let quoteOpen = false;
  for (let possibleArg of inpValue.split(" ")) {
    if (quoteOpen) {
      resultValue[resultValue.length - 1] += " " + possibleArg;
    } else {
      resultValue.push(possibleArg);
    }
    if (possibleArg.startsWith('"')) {
      quoteOpen = true;
    }
    if (possibleArg.endsWith('"')) {
      quoteOpen = false;
    }
  }
  resultValue = resultValue.filter((arg) => arg != "");
  return resultValue;
}

/**
 * Validates input to ensure that query exists, and has the right parameters
 *
 * @param {string} inpValue
 * @param {boolean} isSubQuery
 * @returns {boolean}
 */
function validateInput(inpValue, isSubQuery) {
  const args = getArgs(inpValue);
  const query = queries.find(
    (query) =>
      query.name == args[0] &&
      (!isSubQuery || query.canSubQuery == true) &&
      (query.params[0]?.value ?? args[1]) == args[1]
  );

  if (!query) {
    addErrorResponse(
      `Given ${isSubQuery ? "sub-" : ""}query ${args[0]} doesn't exist.`
    );
    return false;
  }

  const requiredArgs = query.params.filter((param) => !param.optional);
  const possibleArgs = query.params;

  // arg[0] is name, so we remove it for checking
  // Ensures we meet the minimum requirement for number of parameters
  if (args.length - 1 < requiredArgs.length) {
    addErrorResponse(
      `Given ${isSubQuery ? "sub-" : ""}query ${args[0]} ${
        requiredArgs.length > 0
          ? `(${requiredArgs.map((arg) => arg.name).join(", ")})`
          : ""
      } expected at least ${requiredArgs.length} arguments, but only received ${
        args.length - 1
      } ${
        requiredArgs.length > 0
          ? `(${requiredArgs
              .map((arg) => arg.name)
              .slice(undefined, args.length - 1)
              .join(", ")})`
          : ""
      }.`
    );
    return false;
  }

  // arg[0] is name, so we remove it for checking
  // Test for subquery, and then run checks on subquery
  if (query.params.at(-1)?.type == "subquery") {
    if (query.params.filter((param) => param.type == "subquery").length == 2) {
      const firstSubQuery = getArgs(inpValue)
        .slice(
          query.params.length - 1,
          args.findLastIndex((arg) =>
            queries.find((query) => query.name == arg)
          )
        )
        .join(" ");
      const secondSubQuery = getArgs(inpValue)
        .slice(
          args.findLastIndex((arg) =>
            queries.find((query) => query.name == arg)
          )
        )
        .join(" ");
      if (!validateInput(firstSubQuery, true)) return false;
      if (!validateInput(secondSubQuery, true)) return false;
    } else {
      const subQueryInput = getArgs(inpValue)
        .slice(query.params.length)
        .join(" ");

      if (!validateInput(subQueryInput, true)) return false;
    }
  } else if (args.length - 1 > possibleArgs.length) {
    // Exceeds param limit
    addErrorResponse(
      `Given ${isSubQuery ? "sub-" : ""}query ${args[0]} expected at most ${
        possibleArgs.length
      } (${possibleArgs
        .map((arg) => arg.name)
        .join(", ")}) arguments, but received ${args.length - 1}.`
    );
    return false;
  }

  let hasError = false; // Handles return true / false
  args.slice(1).forEach((arg, idx) => {
    if (hasError) return; // Only display 1 error
    const param = query.params.at(idx);
    if (param == undefined) return false;
    switch (param.type) {
      case "int":
      case "number":
        if (Number.isNaN(Number(arg))) {
          addErrorResponse(
            `Given argument, ${param.name} in ${
              isSubQuery ? "sub-" : ""
            }query ${
              args[0]
            } expected to be type number but received "${arg}" (type NaN).`
          );
          hasError = true;
          return;
        }
        return;
      case "row":
        if (!arg.startsWith("`") || !arg.endsWith("`")) {
          addErrorResponse(
            `Given argument, ${param.name} in ${
              isSubQuery ? "sub-" : ""
            }query ${
              args[0]
            } expected to be type row but received "${arg}" (type string).`
          );
          hasError = true;
          return;
        }
        return;
      case "string":
        if (!arg.startsWith('"') || !arg.endsWith('"')) {
          addErrorResponse(
            `Given argument, ${param.name} in ${
              isSubQuery ? "sub-" : ""
            }query ${args[0]} expected to be type row but received "${arg}".`
          );
          hasError = true;
          return;
        }
        return;
      case "date":
        // Test for number
        if (arg.length == 1 || arg.length == 2) {
          // Ensure that it is a real number
          if (Number.isNaN(Number(arg))) {
            addErrorResponse(
              `Given argument, ${param.name} in ${
                isSubQuery ? "sub-" : ""
              }query ${
                args[0]
              } expected to be type date (as number) but received "${arg}" (type NaN).`
            );
            hasError = true;
            return;
          }
          // Check to make sure index is in bounds
          if (
            !(
              Number(arg) > -1 * dateValues.length &&
              Number(arg) < dateValues.length
            )
          ) {
            addErrorResponse(
              `Given argument, ${param.name} in ${
                isSubQuery ? "sub-" : ""
              }query ${
                args[0]
              } has a date index that is out of range (${arg}) expected to be between ${
                -1 * dateValues.length
              } and ${dateValues.length}.`
            );
            hasError = true;
            return;
          }
        } else if (arg.length == 10) {
          if (!new RegExp("^\\d{4}-\\d{2}-\\d{2}$").test(arg)) {
            addErrorResponse(
              `Given argument, ${param.name} in ${
                isSubQuery ? "sub-" : ""
              }query ${
                args[0]
              } expected to be type date (as format YYYY-MM-DD) but received "${arg}" (type string).`
            );
            hasError = true;
            return;
          }
        } else {
          addErrorResponse(
            `Given argument, ${param.name} in ${
              isSubQuery ? "sub-" : ""
            }query ${
              args[0]
            } expected to be type date, but was not formatted correctly, "${arg}" expected to have a length of 1, 2, or 10, but received ${
              arg.length
            }.`
          );
          hasError = true;
          return;
        }
        return;
      case "enum":
      case "subquery":
        return;
      default:
        addErrorResponse(
          `Unexpected argument type, ${param.name} in ${
            isSubQuery ? "sub-" : ""
          }query ${args[0]} type ${
            param.type
          } (with value ${arg}) was not implemented (Check console to see stack trace).`
        );
        console.trace();
        hasError = true;
        return;
    }
  });

  if (hasError) return false;

  // Passes checking
  return true;
}

/**
 *
 * @param {String} inpVal
 */
async function displayRequest(inpVal) {
  const request = document.createElement("div");
  request.className = "response";

  const requestIcon = document.createElement("img");
  requestIcon.src = "./icons/arrow-right.svg";
  requestIcon.className = "icon";
  request.appendChild(requestIcon);

  const text = document.createElement("span");
  text.textContent = inpVal ?? "";
  request.appendChild(text);

  const actions = document.createElement("div");
  actions.className = "actions";
  request.appendChild(actions);

  const editAction = document.createElement("button");
  editAction.className = "action";
  actions.appendChild(editAction);
  editAction.addEventListener("click", () => {
    input.value = inpVal;
    input.focus();
    displayEditingNotification(inpVal);
  });

  const editIcon = document.createElement("img");
  editIcon.src = "./icons/text-cursor.svg";
  editIcon.className = "icon";
  editAction.appendChild(editIcon);

  const copyAction = document.createElement("button");
  copyAction.className = "action";
  actions.appendChild(copyAction);
  copyAction.addEventListener("click", async () => {
    await navigator.clipboard.writeText(inpVal);
    displayCopiedNotification(inpVal);
  });

  const copyIcon = document.createElement("img");
  copyIcon.src = "./icons/clipboard-copy.svg";
  copyIcon.className = "icon";
  copyAction.appendChild(copyIcon);

  responses.appendChild(request);
}

/**
 *
 * @param {string} inpValue
 * @param {boolean} printResult
 * @param {string | object | undefined} providedOutput
 */
async function sendRequest(inpValue, printResult, providedOutput = undefined) {
  const args = getArgs(inpValue);
  const query = queries.find(
    (query) =>
      query.name == args[0] && (query.params[0]?.value ?? args[1]) == args[1]
  );

  if (!query) {
    console.error(
      "An unexpected error ocurred as type checking passed, but no query was found (Check console to see stack trace)."
    );
    if (printResult)
      addErrorResponse(
        `An unexpected error ocurred as type checking passed, but no query was found (Check console to see stack trace).`
      );
    console.trace();
    return undefined;
  }

  let request, response;

  switch (query.name) {
    default:
      console.error(
        `The query ${query.name} was not implemented into the sendRequest method (Check console to see stack trace).`
      );
      if (printResult)
        addErrorResponse(
          `The query ${query.name} was not implemented into the sendRequest method (Check console to see stack trace).`
        );
      return undefined;
    case "help":
      addHelpResponse();
      return;
    case "input":
      addInputDatasetResponse();
      return;
    case "clear":
      clearAllResponses();
      return;
    case "table":
      if (providedOutput) {
        addTableResponse(providedOutput);
        return;
      }
      request = await fetch("/api/input");
      response = await request.json();
      if (printResult) {
        addTableResponse(response.result);
      }
      return response.result;
    case "min":
    case "max":
    case "avg":
    case "value":
      if (providedOutput) {
        if (args[1] == "`weather_code`") {
          addWeatherCodeResponse(Number(providedOutput));
        } else {
          addGenericOutputResponse(
            providedOutput +
              responseUnits[args[1].replace(new RegExp("`", "g"), "")]
          );
        }
        return;
      }
      request = await fetch(
        `/api/${args.join("/").replace(new RegExp("`", "g"), "")}`
      );
      response = await request.json();
      if (printResult) {
        if (args[1] == "`weather_code`") {
          addWeatherCodeResponse(Number(response.result));
        } else {
          addGenericOutputResponse(
            response.result +
              responseUnits[args[1].replace(new RegExp("`", "g"), "")]
          );
        }
      }
      return response.result;
    case "histogram":
      if (providedOutput) {
        addHistogramOutputResponse(
          `Histogram of ${args[1]}`,
          args[1].replace(new RegExp("`", "g"), ""),
          providedOutput
        );
        return;
      }
      request = await fetch(
        `/api/${args.join("/").replace(new RegExp("`", "g"), "")}`
      );
      response = await request.json();
      if (printResult)
        addHistogramOutputResponse(
          `Histogram of ${args[1]}`,
          args[1].replace(new RegExp("`", "g"), ""),
          response.result
        );
      return response.result;
    case "compare":
      /**
       * @param {string} name
       */
      function expandName(name) {
        switch (name) {
          case "min":
            return "minimum";
          case "max":
            return "maximum";
          case "avg":
            return "average";
          default:
            return name;
        }
      }

      const isLatLong = args[1] == "coord";
      const isDataset = args[1] == "dataset";
      let lat = args[2];
      let long = args[3];
      const queryName = isLatLong && !isDataset ? args[4] : args[3];
      const rowName = (() => {
        if (isLatLong) {
          return args[5];
        } else if (isDataset) {
          return args[3];
        } else {
          return args[4];
        }
      })();
      const subQueryInput = args.slice(isLatLong ? 4 : 3).join(" ");
      const subQueryValue = await sendRequest(subQueryInput, false);

      if (providedOutput) {
        addGenericOutputResponse(providedOutput);
        return;
      }

      if (!isLatLong && !isDataset) {
        const url = new URL("https://api.radar.io/v1/geocode/forward");
        url.searchParams.append("query", args[2]);
        const result = await (
          await fetch(url, {
            headers: {
              Authorization: CLIENT_GEOCODE_API_KEY,
            },
          })
        ).json();
        lat = result.addresses[0]?.latitude ?? 0;
        long = result.addresses[0]?.longitude ?? 0;
      }

      let returnVal = "";

      if (!isDataset) {
        request = await fetch(
          `/api/external/${lat}/${long}/${args
            .slice(isLatLong ? 4 : 3)
            .join("/")
            .replace(new RegExp("`", "g"), "")}`
        );
        response = await request.json();

        returnVal = `In the given data the ${expandName(
          queryName
        )} of ${rowName.replace(
          new RegExp("`", "g"),
          ""
        )} in the dataset was ${subQueryValue}${
          responseUnits[rowName.replace(new RegExp("`", "g"), "") ?? ""]
        } which was ${(() => {
          if (subQueryValue == response.result) {
            return "equal to";
          } else if (subQueryValue > response.result) {
            return "greater than";
          } else {
            return "less than";
          }
        })()}, at latitude ${lat} and longitude ${long} the ${expandName(
          queryName
        )} of ${rowName.replace(new RegExp("`", "g"), "")} was ${
          response.result
        }${responseUnits[rowName.replace(new RegExp("`", "g"), "")] ?? ""}`;
      } else {
        const firstQuery = args
          .slice(
            2,
            args.findLastIndex((arg) =>
              queries.find((query) => query.name == arg)
            )
          )
          .join(" ");
        const secondQuery = args
          .slice(
            args.findLastIndex((arg) =>
              queries.find((query) => query.name == arg)
            )
          )
          .join(" ");
        const firstQueryRes = await sendRequest(firstQuery, false);
        const secondQueryRes = await sendRequest(secondQuery, false);
        returnVal = `In the first given query the ${expandName(
          queryName
        )} of ${rowName.replace(
          new RegExp("`", "g"),
          ""
        )} in the dataset was ${firstQueryRes}${
          responseUnits[rowName.replace(new RegExp("`", "g"), "") ?? ""]
        } which was ${(() => {
          if (firstQueryRes == secondQueryRes) {
            return "equal to";
          } else if (firstQueryRes > secondQueryRes) {
            return "greater than";
          } else {
            return "less than";
          }
        })()}, than the second query, the ${expandName(
          queryName
        )} of ${rowName.replace(
          new RegExp("`", "g"),
          ""
        )} was ${secondQueryRes}${
          responseUnits[rowName.replace(new RegExp("`", "g"), "")] ?? ""
        }`;
      }

      if (printResult) addGenericOutputResponse(returnVal);
      return returnVal;
  }
}

// Response generators

function clearAllResponses() {
  isClearBlocking = true;
  setTimeout(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
  }, 1);
  setTimeout(() => {
    isClearBlocking = false;
    responses.innerHTML = "";
    addEmptyOutput();
  }, 800);
}

function addEmptyOutput() {
  const response = document.createElement("div");
  response.className = "response empty";
  const responseIcon = document.createElement("img");
  responseIcon.src = "./icons/message-circle-dashed.svg";
  responseIcon.className = "icon";
  response.appendChild(responseIcon);
  const text = document.createElement("span");
  text.textContent = "No queries sent! Start typing to begin writing a query!";
  response.appendChild(text);
  const typeHelp = document.createElement("span");
  typeHelp.textContent = "Consider clicking on the help icon to get started";
  response.appendChild(typeHelp);
  responses.appendChild(response);
}

function addHelpResponse() {
  const response = document.createElement("div");
  response.className = "response";
  const responseIcon = document.createElement("img");
  responseIcon.src = "./icons/arrow-left.svg";
  responseIcon.className = "icon";
  response.appendChild(responseIcon);
  const text = document.createElement("span");
  // from markdown file, used markdown to html converter, then injected extra html for colorization
  text.innerHTML = `
<h2 id="how-to-use-">How to use?</h2>
<ol>
<li>At the bottom of the page, there is a text-box. This is where you can enter queries to request data that you would like to see. You can see a full list of queries below.</li>
<li>Upon clicking on this input, an autocomplete menu will appear with all the queries that you can access. You may start typing to reduce the list, using the arrow keys to change selection, and tab to insert the highlighted command. You may also use the mouse to click on the query you would like to insert.</li>
<li>After selecting a query, documentation will appear on how to complete a query. Depending on the query, you may not have any other parameters to enter, and at this time, you can run the query by hitting the <code>enter</code> button, or by clicking the up arrow.</li>
<li>If you choose a query that contains these parameters, the parameters will be color coded, the current parameter will be bolded, and suggestions will appear to help you complete the query.<ol>
<li>For example, when using the <code>min</code> query, the first parameter, <code>row</code>, will be bolded, and rows that exist in your dataset will appear, you can click on any of these options to autocomplete, and continue onto the next parameter.</li>
</ol>
</li>
<li>After completing all required arguments (indicated using square brackets <code>[]</code>) you may run the query with the enter button, or by clicking the up arrow.</li>
<li>After running, the autocomplete window will be hidden, and your result will be at the bottom of the history list. This is saved even after reloading the page.</li>
<li>You may clear the list by using the <code>clear</code> command.</li>
</ol>
<h2 id="parameter-types">Parameter Types</h2>
<ul>
<li><span class="arg red">Enum</span><ul>
<li>examples<ul>
<li>coord</li>
<li>zip</li>
<li>city</li>
</ul>
</li>
<li>cannot have spaces, must be of specified values</li>
<li>indicated by red color</li>
</ul>
</li>
<li><span class="arg pink">String</span><ul>
<li>examples<ul>
<li>&quot;Kansas City&quot;</li>
<li>&quot;Overland Park&quot;</li>
</ul>
</li>
<li>can contain spaces, must have double quotes (&quot;&quot;)</li>
<li>indicated by pink color</li>
</ul>
</li>
<li><span class="arg blue">Number</span><ul>
<li>examples<ul>
<li>66213</li>
<li>12</li>
<li>10.912</li>
</ul>
</li>
<li>must be a valid number, may contain decimal depending on usage</li>
<li>indicated by blue color</li>
</ul>
</li>
<li><span class="arg orange">Row</span><ul>
<li>examples<ul>
<li>\`weather_code\`</li>
<li>\`temperature_max\`</li>
</ul>
</li>
<li>must be in list, must be surrounded by grave accents / back ticks (\`\`)</li>
<li>indicated by orange color</li>
</ul>
</li>
<li><span class="arg green">Date</span><ul>
<li>examples<ul>
<li>2024-04-24</li>
<li>1</li>
</ul>
</li>
<li>must have a length of 1, 2, or 10, lengths 1 and 2 represent day index, length of 10 is expected to be ISO date</li>
<li>indicated by green color</li>
</ul>
</li>
<li><span class="arg purple">Sub-Query</span><ul>
<li>examples<ul>
<li>min \`weather_code\`</li>
<li>value \`temperature_max\` 2024-04-29</li>
</ul>
</li>
<li>expected to be a query that are described as being able to be sub-queried</li>
<li>indicated by purple color</li>
</ul>
</li>
</ul>
<h2 id="queries">Queries</h2>
<ul>
<li>Upload Dataset<ul>
<li>Usage: input</li>
<li>Parameters: none</li>
<li>Returns: an input box where you can upload custom dataset</li>
</ul>
</li>
<li>Clear<ul>
<li>Usage: clear</li>
<li>Parameters: none</li>
<li>Behavior: clears the history and deletes it from localStorage</li>
</ul>
</li>
<li>Min (can be sub-queried)<ul>
<li>Usage: min <span class="arg orange">[row]</span> <span class="arg green">(start)</span> <span class="arg green">(end)</span></li>
<li>Parameters:<ul>
<li><span class="arg orange">row (row)</span></li>
<li><span class="arg green">start (date)</span> - defaults to first date</li>
<li><span class="arg green">end (date)</span> - defaults to last date</li>
</ul>
</li>
<li>Returns: the min value of the given row between two dates</li>
</ul>
</li>
<li>Average (can be sub-queried)<ul>
<li>Usage: avg <span class="arg orange">[row]</span> <span class="arg green">(start)</span> <span class="arg green">(end)</span></li>
<li>Parameters:<ul>
<li><span class="arg orange">row (row)</span></li>
<li><span class="arg green">start (date)</span> - defaults to first date</li>
<li><span class="arg green">end (date)</span> - defaults to last date</li>
</ul>
</li>
<li>Returns: the average value of the given row between two dates</li>
</ul>
</li>
<li>Specific Point (can be sub-queried)<ul>
<li>Usage: value <span class="arg orange">[row]</span> <span class="arg green">[day]</span></li>
<li>Parameters:<ul>
<li><span class="arg orange">row (row)</span></li>
<li><span class="arg green">day (date)</span></li>
</ul>
</li>
<li>Returns: the specific value of the given row on a given day</li>
</ul>
</li>
<li>Get Dataset<ul>
<li>Usage: table</li>
<li>Parameters: none</li>
<li>Returns a formatted table of all the values and dates in the dataset</li>
</ul>
</li>
<li>Compare<ul>
<li>Usage: compare <span class="arg red">[location type]</span> (...more)</li>
<li>Parameters:<ul>
<li><span class="arg red">location type (enum)</span>, the rest of the parameters differ from this point</li>
</ul>
</li>
<li>Overloads:<ul>
<li>Via Coordinates<ul>
<li>compare coord <span class="arg blue">[latitude]</span> <span class="arg blue">[longitude]</span> <span class="arg purple">[subquery]</span></li>
<li>Parameters:<ul>
<li><span class="arg blue">latitude (number)</span></li>
<li><span class="arg blue">longitude (number)</span></li>
<li><span class="arg purple">subquery (sub-query)</span></li>
</ul>
</li>
<li>Returns: the given latitude and longitude</li>
</ul>
</li>
<li>Via Zip-Code<ul>
<li>compare zip <span class="arg blue">[zip]</span> <span class="arg purple">[subquery]</span></li>
<li>Parameters:<ul>
<li><span class="arg blue">zip (number, expected int)</span></li>
<li><span class="arg purple">subquery (sub-query)</span></li>
</ul>
</li>
<li>Returns: latitude and longitude at zip-code</li>
</ul>
</li>
<li>Via City Name<ul>
<li>compare city <span class="arg pink">[city]</span> <span class="arg purple">[subquery]</span></li>
<li>Parameters:<ul>
<li><span class="arg pink">city (string)</span></li>
<li><span class="arg purple">subquery (sub-query)</span></li>
</ul>
</li>
<li>Returns: latitude and longitude of a city</li>
</ul>
</li>
</ul>
</li>
<li>Behavior: uses the overloads to the latitude and longitude of a given location, then queries external API to receive historical data at location.</li>
<li>Returns: the External API value and the value from the dataset</li>
</ul>
</li>
<li>Histogram<ul>
<li>Usage: histogram <span class="arg orange">[row]</span> <span class="arg green">(start)</span> <span class="arg green">(end)</span></li>
<li>Parameters:<ul>
<li><span class="arg orange">row (row)</span></li>
<li><span class="arg green">start (date)</span> - defaults to first date</li>
<li><span class="arg green">end (date)</span> - defaults to last date</li>
</ul>
</li>
<li>Returns: a visual histogram chart of the provided row between two dates</li>
</ul>
</li>
</ul>
`;
  response.appendChild(text);
  responses.appendChild(response);
}

/**
 * A form that allows you to upload a dataset to a server.
 * @param {boolean} isSuccessful
 */
function addInputDatasetResponse(isSuccessful = false) {
  const response = document.createElement("div");
  response.className = "response";
  const responseIcon = document.createElement("img");
  responseIcon.src = "./icons/arrow-left.svg";
  responseIcon.className = "icon";
  response.appendChild(responseIcon);
  const label = document.createElement("label");
  label.className = "file-dropzone";
  const uploadIcon = document.createElement("img");
  uploadIcon.src = "./icons/upload.svg";
  uploadIcon.className = "icon";
  label.appendChild(uploadIcon);
  const labelText = document.createTextNode("Upload Dataset");
  label.appendChild(labelText);
  const input = document.createElement("input");
  input.type = "file";

  if (isSuccessful) {
    markSuccessful();
  }

  // When we have a file added to the input, update the server
  input.addEventListener("change", async (evt) => {
    const input = /** @type {HTMLInputElement} */ (evt.target);
    if (!input.files) {
      console.error("Input doesn't have files");
      return;
    }
    const file = input.files[0];
    const fileData = await file.text();

    markUploading();

    fetch("/api/input", {
      method: "POST",
      headers: new Headers({ "content-type": "multipart/form-data" }),
      body: fileData,
    })
      .then((res) => {
        // On Success
        if (!res.ok) throw new Error("Bad Request");
        markSuccessful();
        reloadDataset();
      })
      .catch(() => {
        // On Failure
        markUnsuccessful();
      });
  });
  label.appendChild(input);
  response.appendChild(label);
  responses.appendChild(response);

  // State updating functions
  function markUploading() {
    label.innerHTML = "";
    const loaderIcon = document.createElement("img");
    loaderIcon.src = "./icons/loader.svg";
    loaderIcon.className = "icon spin";
    label.appendChild(loaderIcon);
    const labelText = document.createTextNode("Uploading");
    label.appendChild(labelText);
  }

  function markSuccessful() {
    label.innerHTML = "";
    const checkIcon = document.createElement("img");
    checkIcon.src = "./icons/check.svg";
    checkIcon.className = "icon";
    label.appendChild(checkIcon);
    const labelText = document.createTextNode("Uploaded");
    label.appendChild(labelText);
  }

  function markUnsuccessful() {
    label.innerHTML = "";
    const responseIcon = document.createElement("img");
    responseIcon.src = "./icons/circle-alert.svg";
    responseIcon.className = "icon";
    label.appendChild(responseIcon);
    const text = document.createElement("span");
    text.textContent = "Hmm, something went wrong trying to upload";
    text.className = "error";
    label.appendChild(text);
  }
}

/**
 * New response for basic text results.
 *
 * @param {String} val
 */
function addGenericOutputResponse(val) {
  const response = document.createElement("div");
  response.className = "response";
  const responseIcon = document.createElement("img");
  responseIcon.src = "./icons/arrow-left.svg";
  responseIcon.className = "icon";
  response.appendChild(responseIcon);
  const text = document.createElement("span");
  text.textContent = val ?? "";
  response.appendChild(text);
  const actions = document.createElement("div");
  actions.className = "actions";
  response.appendChild(actions);

  const copyAction = document.createElement("button");
  copyAction.className = "action";
  actions.appendChild(copyAction);

  copyAction.addEventListener("click", async () => {
    await navigator.clipboard.writeText(val);
    displayCopiedNotification(val);
  });

  const copyIcon = document.createElement("img");
  copyIcon.src = "./icons/clipboard-copy.svg";
  copyIcon.className = "icon";
  copyAction.appendChild(copyIcon);

  responses.appendChild(response);
}

/**
 * Adds a specific output for a histogram
 *
 * @param {string} title
 * @param {string} yAxisLabelName
 * @param {Record<String,Number>} data
 */
function addHistogramOutputResponse(title, yAxisLabelName, data) {
  const response = document.createElement("div");
  response.className = "response";
  const responseIcon = document.createElement("img");
  responseIcon.src = "./icons/arrow-left.svg";
  responseIcon.className = "icon";
  response.appendChild(responseIcon);
  responses.appendChild(response);

  const maxY = Object.values(data)?.reduce(
    (prev, row) => (prev >= row ? prev : row),
    0
  );

  const newMax = Math.ceil((maxY / 5) * 100) / 100;

  const chart = document.createElement("div");
  chart.className = "chart";
  response.appendChild(chart);

  const titleLabel = document.createElement("span");
  titleLabel.className = "chart-label";
  titleLabel.textContent = title.replace(new RegExp("`", "g"), "");
  chart.appendChild(titleLabel);

  const xAxis = document.createElement("div");
  xAxis.className = "axis x-axis";
  chart.appendChild(xAxis);

  Object.keys(data).forEach((val) => {
    const axisLabel = document.createElement("span");
    axisLabel.className = "axis-value";
    axisLabel.textContent = val;
    xAxis.appendChild(axisLabel);
  });

  const xAxisLabel = document.createElement("span");
  xAxisLabel.className = "axis-label x-axis";
  xAxisLabel.textContent = "date";
  chart.appendChild(xAxisLabel);

  const yAxis = document.createElement("div");
  yAxis.className = "axis y-axis";
  chart.appendChild(yAxis);

  Array(6)
    .fill(0)
    .map((_, idx) => newMax * idx)
    .forEach((val) => {
      const axisLabel = document.createElement("span");
      axisLabel.className = "axis-value";
      axisLabel.textContent = Number(val).toFixed(2);
      yAxis.appendChild(axisLabel);
    });

  const yAxisLabel = document.createElement("span");
  yAxisLabel.className = "axis-label y-axis";
  yAxisLabel.textContent = yAxisLabelName;
  chart.appendChild(yAxisLabel);

  const chartData = document.createElement("div");
  chartData.className = "chart-data";
  chart.appendChild(chartData);

  Object.values(data).forEach((pt) => {
    const line = document.createElement("div");
    line.className = "data-line";
    line.style.height = `${(pt / 5 / newMax) * 100}%`;
    chartData.appendChild(line);
  });
}

/**
 * Shows a custom response when querying for all input values
 *
 * @param {Dataset} input
 */

function addTableResponse(input) {
  const response = document.createElement("div");
  response.className = "response";
  const responseIcon = document.createElement("img");
  responseIcon.src = "./icons/arrow-left.svg";
  responseIcon.className = "icon";
  response.appendChild(responseIcon);
  responses.appendChild(response);

  const table = document.createElement("table");
  response.appendChild(table);
  const trInHead = document.createElement("tr");
  table.appendChild(trInHead);
  const rowWidths = {
    date: "10rem",
    weather_code: "20rem",
    temperature_max: "10rem",
    temperature_min: "10rem",
    precipitation_sum: "10rem",
    wind_speed_max: "10rem",
    precipitation_probability_max: "16rem",
  };
  Object.keys(input?.at(0) ?? {}).forEach((row) => {
    const th = document.createElement("th");
    th.textContent = row;
    th.style.width = rowWidths[row];
    trInHead.appendChild(th);
  });
  input.forEach((row) => {
    const trInBody = document.createElement("tr");
    table.appendChild(trInBody);
    Object.entries(row).forEach(([row, val]) => {
      const td = document.createElement("td");
      if (row == "weather_code") {
        const weatherStatus = weatherCodes[Number(val)];
        const weatherIcon = document.createElement("img");
        weatherIcon.src = weatherStatus?.icon ?? "./icons/circle-alert.svg";
        weatherIcon.className = "icon";
        td.appendChild(weatherIcon);
        const text = document.createElement("span");
        text.textContent = val + " - " + (weatherStatus?.name ?? "Unknown");
        td.appendChild(text);
      } else {
        td.textContent = val + responseUnits[row];
      }
      td.style.width = rowWidths[row];
      trInBody.appendChild(td);
    });
  });
}

/**
 * Shows a custom response when querying for weather code
 *
 * @param {number} code
 */

function addWeatherCodeResponse(code) {
  const weatherStatus = weatherCodes[code];
  const response = document.createElement("div");
  response.className = "response";
  const responseIcon = document.createElement("img");
  responseIcon.src = "./icons/arrow-left.svg";
  responseIcon.className = "icon";
  response.appendChild(responseIcon);
  const weatherIcon = document.createElement("img");
  weatherIcon.src = weatherStatus?.icon ?? "./icons/circle-alert.svg";
  weatherIcon.className = "icon";
  response.appendChild(weatherIcon);
  const text = document.createElement("span");
  text.textContent = code + " - " + (weatherStatus?.name ?? "Unknown");
  response.appendChild(text);
  const actions = document.createElement("div");
  actions.className = "actions";
  response.appendChild(actions);

  const copyAction = document.createElement("button");
  copyAction.className = "action";
  actions.appendChild(copyAction);

  copyAction.addEventListener("click", async () => {
    await navigator.clipboard.writeText(String(code));
    displayCopiedNotification(String(code));
  });

  const copyIcon = document.createElement("img");
  copyIcon.src = "./icons/clipboard-copy.svg";
  copyIcon.className = "icon";
  copyAction.appendChild(copyIcon);
  responses.appendChild(response);
}

/**
 * New response when something bad happens.
 *
 * @param {string} val
 */
function addErrorResponse(val) {
  const response = document.createElement("div");
  response.className = "response error";
  const responseIcon = document.createElement("img");
  responseIcon.src = "./icons/circle-alert.svg";
  responseIcon.className = "icon";
  response.appendChild(responseIcon);
  const text = document.createElement("span");
  text.textContent = val ?? "";
  response.appendChild(text);
  responses.appendChild(response);
}

/** @type {NodeJS.Timer | null} */
let hideTimeout;

// Notifications to let the user know that copied occurred, or that we pasted the query

/**
 *
 * @param {String} val
 */
function displayCopiedNotification(val) {
  const wasOpen = hideTimeout != null;
  notification.className = "";
  if (hideTimeout) clearTimeout(hideTimeout);
  hideTimeout = null;
  const exec = () => {
    notification.innerHTML = "";
    const response = document.createElement("div");
    const responseIcon = document.createElement("img");
    responseIcon.src = "./icons/clipboard-copy.svg";
    responseIcon.className = "icon";
    response.appendChild(responseIcon);
    const text = document.createElement("div");
    text.className = "text";
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = "Copied to clipboard";
    const description = document.createElement("span");
    description.className = "description";
    description.textContent = `copied "${val}"`;
    text.appendChild(title);
    text.appendChild(description);
    response.appendChild(text);
    notification.appendChild(response);

    notification.className = "visible";
    hideTimeout = setTimeout(() => {
      notification.className = "";
    }, 3000);
  };
  if (wasOpen) {
    setTimeout(exec, 200);
  } else {
    exec();
  }
}

/**
 *
 * @param {String} val
 */
function displayEditingNotification(val) {
  const wasOpen = hideTimeout != null;
  notification.className = "";
  if (hideTimeout) clearTimeout(hideTimeout);
  hideTimeout = null;
  const exec = () => {
    notification.innerHTML = "";
    const response = document.createElement("div");
    const responseIcon = document.createElement("img");
    responseIcon.src = "./icons/text-cursor.svg";
    responseIcon.className = "icon";
    response.appendChild(responseIcon);
    const text = document.createElement("div");
    text.className = "text";
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = "Editing Command";
    const description = document.createElement("span");
    description.className = "description";
    description.textContent = `pasted command "${val}" into query input`;
    text.appendChild(title);
    text.appendChild(description);
    response.appendChild(text);
    notification.appendChild(response);

    notification.className = "visible";
    hideTimeout = setTimeout(() => {
      notification.className = "";
    }, 3000);
  };
  if (wasOpen) {
    setTimeout(exec, 200);
  } else {
    exec();
  }
}
