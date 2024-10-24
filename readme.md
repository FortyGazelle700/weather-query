# WeatherQuery

This is a project for the KU Design Challenge 2024, created by Drake Semchyshyn. This codebase contains all the code necessary to run the program, with little dependencies. 

## About This Codebase
This is a server-side JavaScript application that hosts a web-server and api routes. The JavaScript Runtime of choice is [Bun](https://bun.sh/), for its ease of use. Bun is the only required dependency to run this application. Some features that have been used include the [HTTP](https://bun.sh/docs/api/http) and [File IO](https://bun.sh/docs/api/file-io) libraries provided by Bun. In addition, the front-end UI was created using vanilla HTML, CSS, and JS, to reduce learning curve and some complexity with learning UI Libraries. The UI contains icons from [Lucide](https://lucide.dev/).

## APIs
- [radar.io](https://radar.io) - Used for geocoding
- [Open Meteo](https://open-meteo.com) - Used for historical data

## File Structure
- root (/)
	- readme.md (this file)
	- package.json (used to manage packages and scripts)
	- bun.lockb (lock file to check installed dependencies)
	- dataset.txt (the file of which data is read from)
	- node_modules (where dependencies are saved)
	- src
		- server.js (entry point to the server, contains all logic to serve frontend and api routes)
		- frontend (server.js defaults to looking in this folder to serve pages)
			- index.html (HTML page that you see when going to localhost:5000)
			- index.css (CSS StyleSheet to style the HTML page)
			- index.old.css (CSS StyleSheet meant for older browsers, although not used, can be replaced in index.html to add this support)
			- index.js (JS that handles logic and pre-populates data)
			- query-constants.js (JS that handles specific constants with the dataset (units, rowValues, and schema))
			- icons (where all used Lucide Icons are saved locally)

## How to start?

To run this application, ensure that you have [Bun](https://bun.sh/) installed locally, and continue by running:
```sh
bun run start
```

The server should start on port `5000`, and should log something along the lines of:
```sh
> bun run start
$ bun ./src/server.js
 UP Started server on http://localhost:5000
```

Open page [http://localhost:5000](http://localhost:5000) to view the application in your browser.

### How to start in Development Mode

Development mode is slightly different than the start command, as it enables hot reloading on the server side, meaning any changes you make, will be reflected immediately, and the front-end can be simply reloaded to see reflected changes.

To run this application, ensure that you have [Bun](https://bun.sh/) installed locally, and continue by running:
```sh
bun run dev
```

The development server should start on port `5000`, and should log something along the lines of:
```sh
> bun run dev
$ bun --watch ./src/server.js
 UP Started server on http://localhost:5000
```

Open page [http://localhost:5000](http://localhost:5000) to view the application in your browser.

Any changes made will be reflected on refresh and server changes will occur immediately.

## How to use?
1. At the bottom of the page, there is a text-box. This is where you can enter queries to request data that you would like to see. You can see a full list of queries [here](#queries).
2. Upon clicking on this input, an autocomplete menu will appear with all the queries that you can access. You may start typing to reduce the list, using the arrow keys to change selection, and tab to insert the highlighted command. You may also use the mouse to click on the query you would like to insert.
3. After selecting a query, documentation will appear on how to complete a query. Depending on the query, you may not have any other parameters to enter, and at this time, you can run the query by hitting the `enter` button, or by clicking the up arrow.
4. If you choose a query that contains these parameters, the parameters will be color coded, the current parameter will be bolded, and suggestions will appear to help you complete the query.
	1. For example, when using the `min` query, the first parameter, `row`, will be bolded, and rows that exist in your dataset will appear, you can click on any of these options to autocomplete, and continue onto the next parameter.
5. After completing all required arguments (indicated using square brackets `[]`) you may run the query with the enter button, or by clicking the up arrow.
6. After running, the autocomplete window will be hidden, and your result will be at the bottom of the history list. This is saved even after reloading the page.
7. You may clear the list by using the `clear` command.

## Parameter Types
- Enum
	- examples
		- coord
		- zip
		- city
	- cannot have spaces, must be of specified values
	- indicated by red color
- String
	- examples
		- "Kansas City"
		- "Overland Park"
	- can contain spaces, must have double quotes ("")
	- indicated by pink color
- Number
	- examples
		- 66213
		- 12
		- 10.912
	- must be a valid number, may contain decimal depending on usage
	- indicated by blue color
- Row
	- examples
		- \`weather_code\`
		- \`temperature_max\`
	- must be in list, must be surrounded by grave accents / back ticks (\`\`)
	- indicated by orange color
- Date
	- examples
		- 2024-04-24
		- 1
	- must have a length of 1, 2, or 10, lengths 1 and 2 represent day index, length of 10 is expected to be ISO date
	- indicated by green color
- Sub-Query
	- examples
		- min \`weather_code\`
		- value \`temperature_max\` 2024-04-29
	- expected to be a [query](#queries) that are described as being able to be sub-queried
	- indicated by purple color

## Queries
- Help
	- Usage: help
	- Parameters: none
	- Returns: a snippet of the readme to show documentation
- Upload Dataset
	- Usage: input
	- Parameters: none
	- Returns: an input box where you can upload custom dataset
- Clear
	- Usage: clear
	- Parameters: none
	- Behavior: clears the history and deletes it from localStorage
- Min (can be sub-queried)
	- Usage: min \[row] (start) (end)
	- Parameters:
		- row (row)
		- start (date) - defaults to first date
		- end (date) - defaults to last date
	- Returns: the min value of the given row between two dates
- Average (can be sub-queried)
	- Usage: avg \[row] (start) (end)
	- Parameters:
		- row (row)
		- start (date) - defaults to first date
		- end (date) - defaults to last date
	- Returns: the average value of the given row between two dates
- Specific Point (can be sub-queried)
	- Usage: value \[row] \[day]
	- Parameters:
		- row (row)
		- day (date)
	- Returns: the specific value of the given row on a given day
- Get Dataset
	- Usage: table
	- Parameters: none
	- Returns a formatted table of all the values and dates in the dataset
- Compare
	- Usage: compare \[location type] (...more)
	- Parameters:
		- location type (enum),  the rest of the parameters differ from this point
	- Overloads:
		- Via Coordinates
			- compare coord \[latitude] \[longitude] \[subquery]
			- Parameters:
				- latitude (number)
				- longitude (number)
				- subquery (sub-query)
			- Returns: the given latitude and longitude
		- Via Zip-Code
			- compare zip \[zip] \[subquery]
			- Parameters:
				- zip (number, expected int)
				- subquery (sub-query)
			- Returns: latitude and longitude at zip-code
		- Via City Name
			- compare city \[city] \[subquery]
			- Parameters:
				- city (string)
				- subquery (sub-query)
			- Returns: latitude and longitude of a city
	- Behavior: uses the overloads to the latitude and longitude of a given location, then queries external API to receive historical data at location.
	- Returns: the External API value and the value from the dataset
- Histogram
	- Usage: histogram \[row] (start) (end)
	- Parameters:
		- row (row)
		- start (date) - defaults to first date
		- end (date) - defaults to last date
	- Returns: a visual histogram chart of the provided row between two dates

## Known Issues
1. Depending on WiFi Provider, [Open Meteo API](https://open-meteo.com) may not be able to be accessed.